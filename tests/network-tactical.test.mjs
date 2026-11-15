import {MAPS} from '../public/maps.mjs';
import {route} from '../public/navigation.mjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startServer } from "../server.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 6000) {
  const at = Date.now();
  while (!fn()) {
    if (Date.now() - at > timeout) throw Error("network tactical timeout");
    await sleep(20);
  }
}
async function join(port, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.purchases = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "welcome") ws.id = m.id;
    if (m.type === "state") ws.state = m;
    if (m.type === "purchase") ws.purchases.push(m);
  });
  ws.sendJSON = (m) => ws.send(JSON.stringify(m));
  ws.player = () => ws.state?.players.find((p) => p.id === ws.id);
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  ws.sendJSON({ type: "join", name });
  await until(() => ws.id && ws.state);
  return ws;
}
async function walk(ws, x, z) {
  const at = Date.now();
  while (true) {
    const p = ws.player(),
      dx = x - p.x,
      dz = z - p.z,
      l = Math.hypot(dx, dz);
    if (l < 0.28) break;
    assert.equal(p.alive, true, "player alive while navigating");
    if (Date.now() - at > 14000)
      throw Error(`navigation stuck at ${p.x},${p.z} heading to ${x},${z}`);
    ws.sendJSON({
      type: "input",
      yaw: Math.atan2(-dx, -dz),
      pitch: 0,
      forward: Math.min(1, l / 0.6),
    });
    await sleep(35);
  }
  ws.sendJSON({ type: "input", forward: 0, side: 0 });
  await sleep(380);
}
async function goSite(ws){
 const m=MAPS[ws.state.mapId],site=m.sites[0],path=route(m,ws.player(),site),corners=[];
 for(let i=0;i<path.length;i++){const a=path[i-1]||[ws.player().x,ws.player().z],b=path[i],c=path[i+1];if(!c||(b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]))corners.push(b);}
 for(const [x,z]of corners)await walk(ws,x,z);
}

test(
  "real WebSockets: buy → drop → pickup → navigate map → plant → explosion → payout → purchase rifle next round",
  { timeout: 100000 },
  async () => {
    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
      rules: { buyMs: 1500, plantMs: 220, bombMs: 800, endMs: 1000 },
    });
    let a, d;
    try {
      await server.createMatch({ bots: [0, 0] });
      a = await join(server.port, "ATTACK");
      d = await join(server.port, { toString: "malformed" });
      a.sendJSON({ type: "buy", item: "armor" });
      a.sendJSON({ type: "buy", item: "constructor" });
      a.sendJSON({ type: "buy", item: { toString: "bad" } });
      await until(() => a.purchases.length === 3 && a.player().armor === 100);
      assert.equal(a.player().money, 150);
      assert.equal(a.purchases[1].ok, false);
      assert.equal(a.purchases[2].ok, false);
      a.sendJSON({ type: "input", drop: true });
      await until(() => a.player().weapon === "butterfly");
      assert.equal(a.state.drops.length, 1);
      a.sendJSON({ type: "input", pickup: true });
      await until(() => a.player().weapon === "pistol");
      assert.equal(a.player().ammo, 12);
      await until(() => a.state.phase === "live");
      a.sendJSON({ type: "buy", item: "armor" });
      await until(() => a.purchases.length === 4);
      assert.equal(a.purchases.at(-1).ok, false);
      await goSite(a);
      const hold = setInterval(() => a.sendJSON({ type: "input", interact: true }), 40);
      try {
        await until(() => a.state.bomb.state === "planted");
        assert.equal(d.state.bomb.site, "A");
        await until(() => a.state.reason === "exploded");
      } finally {
        clearInterval(hold);
      }
      assert.deepEqual(a.state.score, [1, 0]);
      assert.equal(a.player().money, 3700);
      assert.equal(a.player().alive, false);
      await until(() => a.state.round === 2 && a.state.phase === "freeze");
      a.sendJSON({ type: "buy", item: "rifle" });
      await until(() => a.player().weapon === "rifle");
      assert.equal(a.player().money, 1000);
      assert.equal(a.player().ammo, 30);
      server.restartMatch();
      await until(() => a.state.round === 1 && a.state.score[0] === 0);
      assert.equal(a.player().money, 800);
      assert.equal(a.player().weapon, "pistol");
    } finally {
      a?.terminate();
      d?.terminate();
      server.close();
    }
  },
);
test(
  "real WebSockets: defense buys kit, travels to site, interrupts then completes a defuse",
  { timeout: 100000 },
  async () => {
    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
      rules: { buyMs: 800, plantMs: 200, bombMs: 12000, defuseMs: 900, kitMs: 450, endMs: 2000 },
    });
    let a, d;
    try {
      await server.createMatch({ bots: [0, 0] });
      a = await join(server.port, "PLANTER");
      d = await join(server.port, "DEFUSER");
      d.sendJSON({ type: "buy", item: "kit" });
      await until(() => d.player().kit);
      await until(() => a.state.phase === "live");
      await Promise.all([
        (async () => {
          await goSite(a);
        })(),
        (async () => {
          await goSite(d);
        })(),
      ]);
      let timer = setInterval(() => a.sendJSON({ type: "input", interact: true }), 35);
      await until(() => a.state.bomb.state === "planted");
      clearInterval(timer);
      a.sendJSON({ type: "input" });
      d.sendJSON({ type: "input", interact: true });
      await until(() => d.player().action?.kind === "defuse");
      d.sendJSON({ type: "input", interact: false });
      await until(() => !d.player().action);
      assert.equal(d.state.bomb.state, "planted");
      timer = setInterval(() => d.sendJSON({ type: "input", interact: true }), 35);
      try {
        await until(() => d.state.reason === "defused");
      } finally {
        clearInterval(timer);
      }
      assert.deepEqual(d.state.score, [0, 1]);
      assert.equal(d.player().money, 3950);
      assert.equal(d.state.bomb.state, "defused");
    } finally {
      a?.terminate();
      d?.terminate();
      server.close();
    }
  },
);
test(
  "real bot collects a dropped bomb, navigates cover and plants it without a human command",
  { timeout: 100000 },
  async () => {
    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
      rules: { buyMs: 800, plantMs: 250, bombMs: 1000 },
    });
    let human;
    try {
      await server.createMatch({ bots: [1, 0] });
      human = await join(server.port, "OBSERVER");
      await until(() => human.state.phase === "live");
      human.sendJSON({ type: "input", drop: true, bombOnly: true });
      await until(
        () => human.state.bomb.state === "carried" && human.state.bomb.carrier !== human.id,
        12000,
      );
      assert.equal(human.state.players.find((p) => p.id === human.state.bomb.carrier).bot, true);
      await until(() => human.state.bomb.state === "planted", 65000);
      assert.ok(["A", "B"].includes(human.state.bomb.site), "bot may select either site according to its round role");
      await until(() => human.state.reason === "exploded");
    } finally {
      human?.terminate();
      server.close();
    }
  },
);
