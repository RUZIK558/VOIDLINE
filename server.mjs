import {createVSAC} from './vsac.mjs';
import {createTacticalChannel} from "./tactical-channel.mjs";
import {route as mapRoute} from "./public/navigation.mjs";
import {getMap,validMap} from "./public/maps.mjs";
import http from "node:http";
import { SessionReservations } from "./net-session.mjs";
import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import {
  move,
  WEAPONS,
  blocked,
  wallDistance,
  direction,
  atSite,
} from "./public/shared.mjs";
import { TacticalMatch } from "./match.mjs";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
export async function startServer({
  port = 3080,
  host = "0.0.0.0",
  rules = {},
  onSecurity = ()=>{},
} = {}) {
  const vsac=createVSAC({onEvent:onSecurity,requireProtocol:process.env.VOIDLINE_VSAC_STRICT==='1'});
  const sessions = new SessionReservations();
  const players = new Map(),
    clients = new Map();
  let last = Date.now(),
    tick = 0,
    events = [];
  let tactical=null;
  const sendTacticalState=(ws,p,reset=false)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'tactical-state',team:p.team,reset,markers:tactical.snapshot(p.team)}));};
  const clearTactical=()=>{tactical?.clear();if(tactical)for(const[ws,id]of clients){const p=players.get(id);if(p)sendTacticalState(ws,p,true);}};
  const game = new TacticalMatch(players, (e) => {events.push(e);if(e.type==='round')clearTactical();}, rules);
  tactical=createTacticalChannel(()=>game);
  let lanApp = null,
    lanPort = null,
    botTargets = null,
    difficulty = "normal",
    closing = false;
  const make = (name, team, bot) => game.make(name, team, bot);
  const resetSpawns = () => game.resetSpawns();
  const startRound = () => game.startRound(Date.now());
  const handleRequest = async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://local").pathname);
      let f;
      if (p === "/vendor/three.module.js")
        f = path.join(ROOT, "node_modules/three/build/three.module.js");
      else if (p === "/vendor/three.core.js")
        f = path.join(ROOT, "node_modules/three/build/three.core.js");
      else if (p === "/vendor/GLTFExporter.js")
        f = path.join(
          ROOT,
          "node_modules/three/examples/jsm/exporters/GLTFExporter.js",
        );
      else if (p === "/vendor/GLTFLoader.js")
        f = path.join(
          ROOT,
          "node_modules/three/examples/jsm/loaders/GLTFLoader.js",
        );
      else if (p === "/utils/BufferGeometryUtils.js")
        f = path.join(
          ROOT,
          "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js",
        );
      else {
        f = path.resolve(ROOT, "public", "." + (p === "/" ? "/index.html" : p));
        if (!f.startsWith(path.join(ROOT, "public") + path.sep))
          throw Error("path");
      }
      let data = await readFile(f);
      if (
        [
          "/vendor/GLTFExporter.js",
          "/vendor/GLTFLoader.js",
          "/utils/BufferGeometryUtils.js",
        ].includes(p)
      )
        data = Buffer.from(
          data
            .toString("utf8")
            .replace(/from 'three'/g, "from '/vendor/three.module.js'"),
        );
      res.writeHead(200, {
        "Content-Type": f.endsWith(".html")
          ? "text/html; charset=utf-8"
          : f.endsWith(".css")
            ? "text/css"
            : f.endsWith(".js") || f.endsWith(".mjs")
              ? "text/javascript"
              : f.endsWith(".jpg") || f.endsWith(".jpeg")
                ? "image/jpeg"
              : f.endsWith(".png")
                ? "image/png"
                : f.endsWith(".svg")
                  ? "image/svg+xml"
                  : f.endsWith(".wav")
                    ? "audio/wav"
                  : f.endsWith(".json")
                    ? "application/json"
                  : f.endsWith(".glb")
                    ? "model/gltf-binary"
                    : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:;",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
  const app = http.createServer(handleRequest);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
  const attach = (listener, lan) =>
    listener.on("upgrade", (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.fromLAN = lan;
        wss.emit("connection", ws, req);
      });
    });
  attach(app, false);
  wss.on("error", () => {});
  function botCounts() {
    return [0, 1].map(
      (t) => [...players.values()].filter((p) => p.bot && p.team === t).length,
    );
  }
  function balanceBots() {
    for (let t = 0; t < 2; t++) {
      const humans = [...players.values()].filter(
        (p) => !p.bot && p.team === t,
      ).length;
      const desired = Math.min(
        5 - humans,
        botTargets ? botTargets[t] : Math.max(0, 2 - humans),
      );
      const bots = [...players.values()].filter((p) => p.bot && p.team === t);
      while (bots.length > desired) game.remove(bots.pop());
      while (bots.length < desired) {
        const names = ["KESTREL", "VANTA", "CIPHER", "ROOK", "NOVA"];
        const used = new Set([...players.values()].map((p) => p.name));
        const name = names.find((n) => !used.has(n + "-" + (t + 1))) || "DRONE";
        const bot = make(name + "-" + (t + 1), t, true);
        bots.push(bot);
        if (
          game.phase === "live" ||
          game.phase === "end" ||
          game.phase === "match"
        ) {
          bot.alive = false;
          bot.roundActive = false;
          bot.hp = 0;
        }
      }
    }
  }
  function manageBots(action, team, id) {
    if (!["add", "remove", "clear"].includes(action))
      throw Error("Неизвестное действие");
    botTargets = botCounts();
    if (action === "clear") botTargets = [0, 0];
    else if (action === "add") {
      if (![0, 1].includes(team)) throw Error("Выбери команду");
      if ([...players.values()].filter((p) => p.team === team).length >= 5)
        throw Error("В команде уже 5 участников");
      botTargets[team]++;
    } else {
      const bot = players.get(id);
      if (!bot?.bot) throw Error("Этот бот уже вышел");
      botTargets[bot.team]--;
      game.remove(bot);
    }
    balanceBots();
    if (game.phase === "freeze" || game.phase === "waiting") resetSpawns();
    return getStatus();
  }
  function getStatus() {
    const addresses = [];
    if (lanApp)
      for (const list of Object.values(networkInterfaces()))
        for (const net of list || []) {
          if (net.family === "IPv4" && !net.internal)
            addresses.push(`${net.address}:${lanPort}`);
        }
    return {
      lan: !!lanApp,
      port: lanPort,
      addresses: [...new Set(addresses)],
      difficulty,
      antiCheat:vsac.status(),
      mode: game.mode,
      mapId: game.map.id,
      attackTeam: game.attackTeam,
      botCounts: botCounts(),
      players: [...players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        bot: p.bot,
      })),
      connections: clients.size,
      maxPerTeam: 5,
    };
  }
  async function openLan(port = 3080) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error("Порт должен быть от 1024 до 65535");
    if (lanApp) {
      if (port !== lanPort)
        throw Error("Сначала закрой текущий сетевой доступ");
      return getStatus();
    }
    const listener = http.createServer(handleRequest);
    attach(listener, true);
    try {
      await new Promise((resolve, reject) => {
        listener.once("error", reject);
        listener.listen(port, "0.0.0.0", resolve);
      });
    } catch (err) {
      listener.close();
      throw Error(
        err.code === "EADDRINUSE"
          ? "Порт занят. Выбери другой, например 3081."
          : err.message,
      );
    }
    lanApp = listener;
    lanPort = listener.address().port;
    return getStatus();
  }
  async function closeLan() {
    const listener = lanApp;
    lanApp = null;
    lanPort = null;
    if (listener) {
      for (const ws of wss.clients) if (ws.fromLAN) ws.terminate();
      await new Promise((resolve) => {
        listener.close(resolve);
        listener.closeAllConnections();
      });
    }
    return getStatus();
  }
  async function createMatch({ bots = [1, 2], level = "normal", mode = "classic", mapId = "terminal" } = {}) {
    if (
      !Array.isArray(bots) ||
      bots.length !== 2 ||
      !bots.every((n) => Number.isInteger(n) && n >= 0 && n <= 4)
    )
      throw Error("Выбери от 0 до 4 ботов на команду");
    if (!["easy", "normal", "hard"].includes(level))
      throw Error("Неизвестная сложность");
    if (!["classic","events"].includes(mode)) throw Error("Неизвестный режим");
    if(!validMap(mapId)) throw Error("Неизвестная карта");
    await closeLan();
    await Promise.all(
      [...wss.clients].map(
        (ws) =>
          new Promise((resolve) => {
            ws.once("close", resolve);
            ws.terminate();
          }),
      ),
    );
    clients.clear();
    sessions.clear();
    players.clear();
    events = [];
    game.map = getMap(mapId);
    game.reset();
    game.mode = mode;
    difficulty = level;
    botTargets = [...bots];
    balanceBots();
    return getStatus();
  }
  function route(p,t,lane=0){return mapRoute(game.map,p,t,lane);}

  wss.on("connection", (ws) => {
    if(wss.clients.size>64){ws.close(1013,'VSAC: server busy');return;}
    const guard=vsac.open({send:m=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));},close:(code,reason)=>ws.close(code,reason)});ws.vsac=guard;
    ws.send(JSON.stringify({type:'ac-info',vsac:1,protocol:1}));
    const connectedAt=Date.now();
    let p = null, sessionToken=null,lastChat=0;
    ws.isAlive=true;ws.on("pong",()=>ws.isAlive=true);
    ws.on("message", (raw,isBinary) => {
      const m=guard.inspect(raw,isBinary);
      if(!m){const r=guard.rejection();if(r?.code==='current-protocol-required'&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:'join-error',error:'VSAC: требуется клиент с текущим протоколом защиты (1.0.8+)'}));ws.close(1008,'VSAC: current protocol required');return;}if(ws.readyState===WebSocket.OPEN&&r?.type==='buy')ws.send(JSON.stringify({type:'purchase',ok:false,error:'VSAC: недопустимая команда покупки'}));if(ws.readyState===WebSocket.OPEN&&r?.type==='tactical')ws.send(JSON.stringify({type:'tactical-error',error:'VSAC: недопустимая команда'}));return;}
      if(m.type==='ac-report'){guard.report(m);return;}
      if(m.type === "match-info"){
        const sides={};for(const side of ['CT','T']){const team=side==='T'?game.attackTeam:1-game.attackTeam;const list=[...players.values()].filter(p=>p.team===team);sides[side]={humans:list.filter(p=>!p.bot).length,bots:list.filter(p=>p.bot).length};}
        ws.send(JSON.stringify({type:'match-info',mapId:game.map.id,mode:game.mode,sides}));return;
      }
      if(m.type === "ping"){ws.send(JSON.stringify({type:"pong",sent:m.sent,time:Date.now()}));return;}
      if (m.type === "join" && !p) {
        const resumedId=sessions.resume(m.resume), existing=players.get(resumedId);
        if(existing){p=existing;sessionToken=m.resume;p.input={};p.inputAt=0;p.disconnected=false;clients.set(ws,p.id);ws.send(JSON.stringify({type:"welcome",id:p.id,resume:sessionToken,reconnected:true}));guard.bind(p.id);sendTacticalState(ws,p);return;}

        if (clients.size >= 10) {
          ws.close(1008, "Server full");
          return;
        }
        const n =
          (typeof m.name === "string" ? m.name : "OPERATOR")
            .replace(/[^\p{L}\p{N}_ -]/gu, "")
            .trim()
            .slice(0, 16) || "OPERATOR";
        let counts = [0, 0];
        for (const q of players.values()) if (!q.bot) counts[q.team]++;
        const team = m.team === "T" ? game.attackTeam : m.team === "CT" ? 1-game.attackTeam : counts[0]<=counts[1]?0:1;
        if (counts[team]>=5) { ws.send(JSON.stringify({type:"join-error",error:"Выбранная сторона заполнена"})); ws.close(1008,"Team full"); return; }
        const bot = [...players.values()].find(q=>q.bot&&q.team===team);
        if ([...players.values()].filter(q=>q.team===team).length>=5 && bot) game.remove(bot);
        p = make(n,team);
        if (m.loadout) game.setLoadout(p, m.loadout);
        clients.set(ws, p.id);
        balanceBots();
        sessionToken=sessions.create(p.id);
        ws.send(JSON.stringify({ type: "welcome", id: p.id, resume:sessionToken }));
        if (game.phase === "waiting") startRound();
        else if (game.phase === "freeze") {
          game.spawn(
            p,
            [...players.values()].filter((q) => q.team === p.team).length - 1,
          );
          if (game.bomb.state === "dropped" && p.team === game.attackTeam)
            game.bomb = { state: "carried", carrier: p.id };
        } else {
          p.alive = false;
          p.roundActive = false;
          p.hp = 0;
        }
        guard.bind(p.id);sendTacticalState(ws,p);
      }
      if(p && m.type==='tactical'){
        const result=tactical.handle(p,m);
        if(result.error){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'tactical-error',error:result.error}));}
        else for(const[client,id]of clients){const ally=players.get(id);if(ally?.team===p.team&&client.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'tactical',team:p.team,...result}));}
        return;
      }
      if(p && m.type === "voice-join"){
        ws.voiceReady=true;const peers=[...clients].filter(([c])=>c!==ws&&c.voiceReady).map(([,id])=>id);
        ws.send(JSON.stringify({type:"voice-peers",peers}));
        for(const c of clients.keys())if(c!==ws&&c.voiceReady&&c.readyState===WebSocket.OPEN)c.send(JSON.stringify({type:"voice-peer",id:p.id}));
      }
      if(p && m.type === "voice-leave"){ws.voiceReady=false;for(const c of clients.keys())if(c!==ws&&c.voiceReady&&c.readyState===WebSocket.OPEN)c.send(JSON.stringify({type:"voice-left",id:p.id}));}
      if(p && ws.voiceReady && m.type === "voice-signal" && m.signal && typeof m.signal==="object" && JSON.stringify(m.signal).length<12000){
        for(const [c,id] of clients)if(id===m.target&&c.voiceReady&&c.readyState===WebSocket.OPEN)c.send(JSON.stringify({type:"voice-signal",from:p.id,signal:m.signal}));
      }
      if(m.type === "chat" && p && Date.now()-lastChat>750 && typeof m.text==="string"){
        lastChat=Date.now();const text=m.text.replace(/[\x00-\x1f]/g,"").trim().slice(0,180);
        if(text)for(const c of clients.keys())if(c.readyState===WebSocket.OPEN)c.send(JSON.stringify({type:"chat",id:p.id,name:p.name,text,team:p.team}));
      }
      if (m.type === "input" && p) game.input(p, m, Date.now());
      if (m.type === "cosmetics" && p) {
        const error = game.setLoadout(p, m.loadout);
        ws.send(JSON.stringify({ type: "cosmetics", ok: !error, error }));
      }
      if (m.type === "buy" && p) {
        const error = game.buy(p, m.item);
        ws.send(
          JSON.stringify({ type: "purchase", item: m.item, ok: !error, error }),
        );
      }
    });
    const guardTimer=setInterval(()=>{guard.tick();if(!p&&Date.now()-connectedAt>120000)ws.close(1008,'Join timeout');},1000);guardTimer.unref();
    ws.on("close", () => {
      clearInterval(guardTimer);guard.close();
      clients.delete(ws);
      if(p)for(const c of clients.keys())if(c.voiceReady&&c.readyState===WebSocket.OPEN)c.send(JSON.stringify({type:"voice-left",id:p.id}));
      if (p) { p.input={};p.wantShot=false;p.triggerHeld=false;p.disconnected=true;game.releaseBomb(p);sessions.disconnect(sessionToken); }
      if (!closing) balanceBots();
      if (!clients.size && !sessions.tokens.size) {
        game.phase = "waiting";
        game.reset();
      }
    });
    ws.on("error", () => {});
  });

  function botThink(p, now, dt) {
    const enemies = [...players.values()]
      .filter((q) => q.alive && q.team !== p.team)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      );
    const target = enemies.find((t) => {
      const dx = t.x - p.x,
        dz = t.z - p.z,
        range = Math.hypot(dx, dz);
      return (
        range < (game.roundEvent.sight || 30) &&
        !(p.flash && p.flash.until > now && p.flash.peak > 0.15) &&
        !game.smokeObscures([p.x, p.y, p.z], [t.x, t.y, t.z]) &&
        wallDistance(
          [p.x, p.y, p.z],
          direction(Math.atan2(-dx, -dz), Math.atan2(t.y - p.y, range)), game.map.boxes,
        ) > range
      );
    });
    const b = game.bomb,
      defender = p.team !== game.attackTeam;
    let objective = null,
      interact = false;
    if (b.state === "planted") {
      objective = b;
      if (defender) interact = Math.hypot(p.x - b.x, p.z - b.z) < 1.65;
      else if (Math.hypot(p.x - b.x, p.z - b.z) < 6) objective = null;
    } else if (b.state === "carried" && b.carrier === p.id) {
      p.botObjective ||= game.map.sites[(p.botSlot + game.round) % game.map.sites.length];
      objective = p.botObjective;
      interact = !!atSite(p, game.map.sites);
    } else if (b.state === "dropped" && !defender) {
      objective = b;
      if (Math.hypot(p.x - b.x, p.z - b.z) < 1.8) game.pickup(p);
    } else if (!defender) {
      const c = players.get(b.carrier);
      // Only the close escort follows the carrier; others pressure a different site.
      const site=game.map.sites[(p.botSlot+game.round)%game.map.sites.length];
      objective = p.botSlot%3===0 && c ? {x:c.x+(p.botSlot%2?2:-2),z:c.z+2} : site;
    } else {
      const site=game.map.sites[(p.botSlot+game.round)%game.map.sites.length];
      objective=target || {x:site.x+(p.botSlot%2?2:-2),z:site.z+(p.botSlot%3-1)*2};
    }
    if (interact) {
      p.vx = p.vz = 0;
      game.objective(p, { interact: true }, now);
      return;
    }
    game.objective(p, {}, now);
    if (target) {
      const dx = target.x - p.x,
        dz = target.z - p.z,
        range = Math.hypot(dx, dz);
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = Math.atan2(target.y - p.y, range);
      if (p.seenTarget !== target.id) {
        p.seenTarget = target.id;
        p.reactionAt = now + { easy: 1000, normal: 550, hard: 260 }[difficulty];
      }
      if (
        range > 8 &&
        range < 22 &&
        p.grenades.he &&
        now > (p.throwAt || 0) &&
        now > p.reactionAt
      ) {
        const old = p.pitch;
        p.pitch = 0.3;
        game.throwGrenade(p, "he", false, now);
        p.pitch = old;
        p.blockFireUntilRelease = false;
      }
      if (now > Math.max(p.botShot || 0, p.reactionAt || 0)) {
        game.fire(p, now, difficulty);
        p.botShot =
          now +
          ({ easy: 700, normal: 350, hard: 180 }[difficulty] +
          Math.random() * 250) * game.roundEvent.cadence;
      }
      if ((!objective && range > 12) || (WEAPONS[p.weapon]?.melee && range > 1.5)) objective = target;
    } else p.seenTarget = null;
    if (!objective) {
      p.vx = p.vz = 0;
      return;
    }
    if (now > (p.routeAt || 0) || p.path.length === 0) {
      p.path = route(p, objective, p.botLane);
      if(p.stuckFor>.65){p.botLane=(p.botLane+1)%3;p.path=route(p,objective,p.botLane);p.stuckFor=0;}
      p.routeAt = now + 900;
    }
    const v = p.path[0] || [objective.x, objective.z];
    const x = v[0] - p.x,
      z = v[1] - p.z,
      l = Math.hypot(x, z),
      oldX = p.x,
      oldZ = p.z;
    if (l < 0.2) p.path.shift();
    else {
      if (!target) {
        p.yaw = Math.atan2(-x, -z);
        p.pitch = 0;
      }
      let sx=0,sz=0;
      for(const q of players.values())if(q!==p&&q.alive){const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(d>0.01&&d<1.15){sx+=dx/d*(1.15-d)*2;sz+=dz/d*(1.15-d)*2;}}
      const mx=x/l*3+sx,mz=z/l*3+sz,cap=Math.max(1,Math.hypot(mx,mz)/3.6);
      move(p,mx/cap*dt*game.roundEvent.speed,mz/cap*dt*game.roundEvent.speed,game.map.boxes);
    }
    p.stuckFor = l>.3 && Math.hypot(p.x-oldX,p.z-oldZ)<.005 ? (p.stuckFor||0)+dt : 0;
    p.vx = (p.x - oldX) / dt;
    p.vz = (p.z - oldZ) / dt;
    if (b.state === "dropped" && !defender) game.pickup(p);
  }
  const timer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for(const id of sessions.expire(now)){const p=players.get(id);if(p?.disconnected)game.remove(p);}
    if(!clients.size && !sessions.tokens.size){game.phase="waiting";return;}
    if(tick%600===0)for(const ws of clients.keys()){if(!ws.isAlive)ws.terminate();else{ws.isAlive=false;ws.ping();}}
    if (!clients.size) return;
    game.tick(now, dt, difficulty, botThink);
    if (++tick % 2 === 0) {
      const state = JSON.stringify({
        type: "state",
        ...game.snapshot(now),
        difficulty,
        serverTime: now,
        events,
      });
      for (const ws of clients.keys())
        if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 128000)
          ws.send(state);
      events = [];
    }
  }, 1000 / 60);
  await new Promise((resolve, reject) => {
    app.once("error", (err) => {
      clearInterval(timer);
      reject(err);
    });
    app.listen(port, host, resolve);
  });
  return {
    port: app.address().port,
    getStatus,
    openLan,
    closeLan,
    manageBots,
    createMatch,
    restartMatch() {
      game.reset();
      startRound();
      return getStatus();
    },
    close() {
      closing = true;
      if (lanApp) {
        lanApp.close();
        lanApp.closeAllConnections();
        lanApp = null;
      }
      clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      app.close();
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const mode=process.env.VOIDLINE_MODE || "classic";
    if(!["classic","events"].includes(mode))throw Error("VOIDLINE_MODE: classic или events");
    const s = await startServer({ port: Number(process.env.PORT) || 3080,onSecurity:e=>console.warn('[VSAC]',JSON.stringify(e)) });
    if(mode==="events"||process.env.VOIDLINE_MAP)await s.createMatch({mode,bots:[1,2],mapId:process.env.VOIDLINE_MAP||"terminal"});
    console.log(
      `VOIDLINE server → http://localhost:${s.port} (LAN: http://YOUR-IP:${s.port})`,
    );
  } catch (err) {
    console.error("Cannot start VOIDLINE server:", err.message);
    process.exit(1);
  }
}
