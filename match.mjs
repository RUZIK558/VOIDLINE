import {purchaseError} from "./public/purchase.mjs";
import { randomUUID } from "node:crypto";
import {
  WEAPONS, KNIVES, weaponSlot, ROUND_EVENTS,
  SHOP,
  clamp,
  wallDistance,
  direction,
  recoilFor,
  shotSpread,
  accelerate,
  eyeHeight,
  feetY, isGrounded, verticalStep, blocked, supportAt,
  hitPlayer,
  damageFor,
  atSite,
} from "./public/shared.mjs";
import {shuffledEventIds} from "./public/round-events.mjs";
import {getMap} from "./public/maps.mjs";
import { validLoadout, normalizeProfile } from "./public/cosmetics.mjs";
import {
  UTILITY,
  validUtility,
  utilityCount,
  advanceGrenade,
  lineVisible,
  flashPower,
  fireCells,
  smokeBlocks,
} from "./public/utilities.mjs";
export const DEFAULT_RULES = Object.freeze({
  buyMs: 12000,
  roundMs: 90000,
  endMs: 4500,
  bombMs: 40000,
  plantMs: 3000,
  defuseMs: 10000,
  kitMs: 5000,
  halfRounds: 6,
  winScore: 7,
});
export class TacticalMatch {
  constructor(players, emit = () => {}, rules = {}) {
    this.players = players;
    this.emit = emit;
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.map = getMap("terminal");
    this.mode = "classic";
    this.history = [];
    this.roundEvent = ROUND_EVENTS[0];
    this.reset();
  }
  reset() {
    this.history = [];
    this.eventDeck = [];
    this.roundEvent = ROUND_EVENTS[0];
    this.score = [0, 0];
    this.losses = [0, 0];
    this.round = 0;
    this.phase = "waiting";
    this.until = 0;
    this.roundWinner = null;
    this.reason = "";
    this.drops = [];
    this.projectiles = [];
    this.zones = [];
    this.bomb = { state: "idle" };
    this.attackTeam = 0;
    for (const p of this.players.values()) {
      p.money = 800;
      p.kills = 0;
      p.deaths = 0;
      this.equip(p);
    }
  }
  equip(p) {
    delete p._eventOriginal;
    delete p.eventGrantRound;
    p.loadout = normalizeProfile({loadout:p.loadout}).loadout;
    p.guns = {
      pistol: {
        ammo: WEAPONS.pistol.mag,
        reserve: WEAPONS.pistol.reserve,
        skin: p.loadout.pistol,
        owner: p.id,
      },
    };
    for(const id of Object.keys(KNIVES))p.guns[id]={ammo:1,reserve:0,skin:p.loadout[id],owner:p.id};
    p.grenades = { he: 0, flash: 0, smoke: 0, fire: 0 };
    p.utility = null;
    p.weapon = "pistol";
    p.armor = 0;
    p.helmet = false;
    p.kit = false;
    p.reload = 0;
    p.nextShot = 0;
    p.recoilHeat = 0;
    p.lastFire = 0;
  }
  make(name, team, bot = false) {
    const p = { id: randomUUID().slice(0, 8), name, team, bot, kills: 0, deaths: 0, money: 800 };
    this.equip(p);
    this.spawn(p, this.players.size);
    this.players.set(p.id, p);
    return p;
  }
  spawn(p, i) {
    const origin=this.map.spawns[p.team===this.attackTeam?"T":"CT"];
    p.x = origin[0]+[-6, 6, -3, 3, 0][i % 5];
    p.z = origin[1];
    p.y = 1.65;
    p.crouch = false;
    p.vy = 0;
    p.vx = 0;
    p.vz = 0;
    p.yaw = p.team === this.attackTeam ? 0 : Math.PI;
    p.pitch = 0;
    p.hp = 100;
    p.alive = true;
    p.roundActive = true;
    p.input = {};
    p.path = [];
    p.botLane = i % 3;
    p.botSlot = i % 5;
    p.patrolIndex = 0;
    p.seenTarget = null;
    p.reactionAt = 0;
    p.routeAt = 0;
    p.botShot = 0;
    p.reload = 0;
    p.nextShot = 0;
    p.recoilHeat = 0;
    p.triggerHeld = false;
    p.wantShot = false;
    p.action = null;
    p.botObjective = null;
    p.jumpHeld = false;
    p.utility = null;
    p.throwAt = 0;
    p.flash = null;
    p.scoped = false;
    p.fireDamage = 0;
    p.blockFireUntilRelease = false;
    this.paintOwned(p);
    if (!Object.keys(p.guns).some(id=>weaponSlot(id)==="secondary"))
      p.guns.pistol = { ammo: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve, skin: p.loadout.pistol, owner: p.id };
    p.weapon = Object.hasOwn(p.guns,p.weapon) && !WEAPONS[p.weapon]?.melee ? p.weapon : Object.keys(p.guns).find(w => weaponSlot(w) === "primary") || Object.keys(p.guns).find(w=>weaponSlot(w)==="secondary") || Object.keys(p.guns)[0];
    this.applyRoundEvent(p);
  }
  nextEvent() {
    if (!this.eventDeck.length) {
      this.eventDeck = shuffledEventIds();
      const last = this.eventDeck.length-1;
      if (this.eventDeck[last] === this.roundEvent.id)
        [this.eventDeck[0],this.eventDeck[last]]=[this.eventDeck[last],this.eventDeck[0]];
    }
    const id=this.eventDeck.pop();
    return ROUND_EVENTS.find(e=>e.id===id) || ROUND_EVENTS[0];
  }
  restoreEventGear(p) {
    if (p._eventOriginal && p.alive) Object.assign(p,p._eventOriginal);
    delete p._eventOriginal;
    delete p.eventGrantRound;
  }
  applyRoundEvent(p) {
    const e=this.roundEvent;
    p.maxHp=e.hp; p.hp=e.hp; p.eventSpeed=e.speed; p.eventAcceleration=e.acceleration;
    p.lastDamageAt=0; p.regenCarry=0; p.nextRefill=0;
    if(p.eventGrantRound===this.round){
      if(e.guns){for(const id of Object.keys(p.guns))if(!WEAPONS[id].melee && !e.guns.includes(id))delete p.guns[id];
        if(!p.guns[p.weapon])p.weapon=e.guns[0]||Object.keys(p.guns)[0];}
      return;
    }
    p.eventGrantRound=this.round;
    if(e.guns || e.armor!==undefined || e.kit || e.utilities || e.noUtility){
      p._eventOriginal=structuredClone({
        ...(e.guns?{guns:p.guns}:{}),
        ...(e.utilities||e.noUtility?{grenades:p.grenades}:{}),
        ...(e.armor!==undefined?{armor:p.armor,helmet:p.helmet}:{}),
        ...(e.kit?{kit:p.kit}:{})
      });
    }
    p.money=Math.min(16000,p.money+e.cash);
    if(e.guns){
      const knives=Object.fromEntries(Object.entries(p.guns).filter(([id])=>WEAPONS[id]?.melee));
      p.guns={...knives};
      for(const id of e.guns){const w=WEAPONS[id];p.guns[id]={ammo:w.mag,reserve:w.reserve,skin:p.loadout[id],owner:p.id};}
      p.weapon=e.guns[0]||Object.keys(knives)[0];
    }
    if(e.armor!==undefined){p.armor=e.armor;p.helmet=!!e.helmet;}
    if(e.kit && p.team!==this.attackTeam)p.kit=true;
    if(e.noUtility)p.grenades={he:0,flash:0,smoke:0,fire:0};
    if(e.utilities){
      // Replace, rather than stack with carried gear: always respects the four-slot limit.
      p.grenades={he:0,flash:0,smoke:0,fire:0,...e.utilities};
    }
  }
  heal(p,amount) { if(p?.alive && amount>0)p.hp=Math.min(p.maxHp||100,p.hp+amount); }
  damageHeal(p,actual) { this.heal(p,Math.floor(actual*this.roundEvent.vampire)); }
  resetSpawns() {
    const counts = [0, 0];
    for (const p of this.players.values()) this.spawn(p, counts[p.team]++);
  }
  startRound(now = Date.now()) {
    for(const p of this.players.values())this.restoreEventGear(p);
    this.round++;
    this.attackTeam = this.round > this.rules.halfRounds ? 1 : 0;
    const half = this.round === this.rules.halfRounds + 1;
    for (const p of this.players.values()) {
      if (half) {
        this.equip(p);
        p.money = 800;
      } else if (!p.alive) this.equip(p);
    }
    if (half) this.losses = [0, 0];
    this.roundWinner = null;
    this.reason = "";
    this.phase = "freeze";
    this.until = now + this.rules.buyMs;
    this.drops = [];
    this.projectiles = [];
    this.zones = [];
    this.roundEvent = this.mode === "events" ? this.nextEvent() : ROUND_EVENTS[0];
    this.history = [];
    this.resetSpawns();

    const carrier =
      [...this.players.values()].find((p) => p.team === this.attackTeam && !p.bot) ||
      [...this.players.values()].find((p) => p.team === this.attackTeam);
    this.bomb = carrier
      ? { state: "carried", carrier: carrier.id }
      : { state: "dropped", x: this.map.spawns.T[0], z: this.map.spawns.T[1] };
    this.emit({ type: "round", round: this.round, half });
    for (const p of this.players.values())
      if (p.bot) {
        this.buy(p, "armor");
        this.buy(p, "rifle");
        if (p.team !== this.attackTeam) this.buy(p, "kit");
        this.buy(p, "helmet");
        this.buy(p, "ammo");
        this.buy(p, "he");
        this.buy(p, "smoke");
      }
  }
  finish(winner, reason, now = Date.now()) {
    if (this.phase !== "live") return;
    this.score[winner]++;
    this.roundWinner = winner;
    this.projectiles = [];
    this.reason = reason;
    this.losses[winner] = 0;
    this.losses[1 - winner] = Math.min(4, this.losses[1 - winner] + 1);
    for (const p of this.players.values()) {
      const bonus = p.team === winner ? 3250 : 1400 + 500 * Math.max(0, this.losses[p.team] - 1);
      p.money = Math.min(16000, p.money + bonus);
      p.action = null;
      p.reload = 0;
    }
    this.phase = this.score[winner] >= this.rules.winScore ? "match" : "end";
    this.until = now + this.rules.endMs;
    this.emit({ type: "win", team: winner, reason, match: this.phase === "match" });
  }
  buy(p, item) {
    const error=purchaseError(p,item,{phase:this.phase,roundEvent:this.roundEvent,map:this.map,attackTeam:this.attackTeam});
    if(error)return error;
    const offer=SHOP[item],e=this.roundEvent,price=Math.round(offer.price*e.price);
    if (Object.hasOwn(WEAPONS,item)) {
      if (p.guns[item]) return "Оружие уже есть";
      const w = WEAPONS[item];
      const previous = Object.keys(p.guns).find(id => weaponSlot(id) === weaponSlot(item));
      if (previous) { const old = p.weapon; p.weapon = previous; this.drop(p); p.weapon = old; }
      p.guns[item] = { ammo: w.mag, reserve: w.reserve, skin: p.loadout[item], owner: p.id };
      p.weapon = item;
    } else if (item === "ammo") {
      const w = WEAPONS[p.weapon],
        g = p.guns[p.weapon];
      if (!g || g.reserve >= w.reserve) return "Резерв уже полный";
      g.reserve = w.reserve;
    } else if (validUtility(item)) {
      if (utilityCount(p) >= 4 || p.grenades[item] >= UTILITY[item].max)
        return "Лимит: четыре гранаты, не более двух FLASH и одной каждого другого типа";
      p.grenades[item]++;
    } else if (item === "armor") p.armor = 100;
    else if (item === "helmet") p.helmet = true;
    else if (item === "kit") p.kit = true;
    p.money -= price;
    return null;
  }
  drop(p, bombOnly = false) {
    if (!p.alive || !["freeze", "live"].includes(this.phase)) return;
    if (bombOnly) {
      this.releaseBomb(p);
      return;
    }
    if (p.utility && p.grenades[p.utility]) {
      this.drops.push({
        id: randomUUID().slice(0, 8),
        x: p.x,
        y:supportAt(p.x,p.z,this.map.boxes,feetY(p)+.03),
        z: p.z,
        kind: "utility",
        utility: p.utility,
      });
      p.grenades[p.utility]--;
      p.utility = null;
      return;
    }
    const g = p.guns[p.weapon];
    if (!g || WEAPONS[p.weapon]?.melee || this.roundEvent.guns) return;
    this.drops.push({ id: randomUUID().slice(0, 8), x: p.x, y:supportAt(p.x,p.z,this.map.boxes,feetY(p)+.03), z: p.z, weapon: p.weapon, ...g });
    delete p.guns[p.weapon];
    p.weapon = Object.keys(p.guns).find(w=>weaponSlot(w)==="primary") || Object.keys(p.guns)[0] || null;
    p.reload = 0;
    p.action = null;
  }
  releaseBomb(p) {
    if (this.bomb.state === "carried" && this.bomb.carrier === p.id)
      this.bomb = { state: "dropped", x: p.x, y:supportAt(p.x,p.z,this.map.boxes,feetY(p)+.03), z: p.z };
    if (this.bomb.actor === p.id) {
      delete this.bomb.actor;
      delete this.bomb.startedAt;
    }
  }
  reachable(p, o, r = 1.8) {
    const dx = o.x - p.x,
      dz = o.z - p.z,
      dy = (o.y||0)+0.25 - p.y,
      length = Math.hypot(dx, dy, dz);
    return (
      Math.hypot(dx, dz) < r && Math.abs(feetY(p)-(o.y||0))<1.1 &&
      (length < 0.01 ||
        wallDistance([p.x, p.y, p.z], [dx / length, dy / length, dz / length], this.map.boxes) >= length - 0.05)
    );
  }
  pickup(p) {
    if (!p.alive || !["live", "freeze"].includes(this.phase)) return;
    if (
      this.bomb.state === "dropped" &&
      p.team === this.attackTeam &&
      this.reachable(p, this.bomb)
    ) {
      this.bomb = { state: "carried", carrier: p.id };
      return;
    }
    const d = this.drops
      .filter(
        (d) =>
          this.reachable(p, d) &&
          (d.kind === "utility"
            ? !this.roundEvent.noUtility && utilityCount(p) < 4 && p.grenades[d.utility] < UTILITY[d.utility].max
            : !this.roundEvent.guns && !Object.keys(p.guns).some(w=>weaponSlot(w)===weaponSlot(d.weapon))),
      )
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!d) return;
    if (d.kind === "utility") {
      p.grenades[d.utility]++;
      this.drops = this.drops.filter((x) => x.id !== d.id);
      return;
    }
    p.guns[d.weapon] = {
      ammo: d.ammo,
      reserve: d.reserve,
      skin: d.skin || "standard",
      owner: d.owner || null,
    };
    p.weapon = d.weapon;
    p.reload = 0;
    this.drops = this.drops.filter((x) => x.id !== d.id);
  }
  remove(p) {
    this.releaseBomb(p);
    this.players.delete(p.id);
  }
  kill(p, killer, now) {
    if (!p.alive) return;
    p.utility = null;
    for (const weapon of Object.keys(p.guns)) {
      p.weapon = weapon;
      this.drop(p);
    }
    for (const [utility, count] of Object.entries(p.grenades))
      for (let i = 0; i < count; i++)
        this.drops.push({ id: randomUUID().slice(0, 8), x: p.x, y:supportAt(p.x,p.z,this.map.boxes,feetY(p)+.03), z: p.z, kind: "utility", utility });
    this.releaseBomb(p);
    p.alive = false;
    p.hp = 0;
    p.deaths++;
    p.reload = 0;
    p.action = null;
    this.equip(p); // dead inventory cannot be recovered twice; default pistol on respawn
    if (killer) {
      killer.kills++;
      this.heal(killer,this.roundEvent.killHeal);
      if(this.roundEvent.killReload && killer.guns[killer.weapon] && !WEAPONS[killer.weapon].melee){
        const gun=killer.guns[killer.weapon],w=WEAPONS[killer.weapon];
        const n=Math.min(w.mag-gun.ammo,gun.reserve);gun.ammo+=n;gun.reserve-=n;killer.reload=0;
      }
      killer.money = Math.min(16000, killer.money + this.roundEvent.killCash);
    }
  }
  reload(p, now) {
    if(WEAPONS[p.weapon]?.melee)return;
    const w = WEAPONS[p.weapon],
      g = p.guns[p.weapon];
    if (
      p.alive &&
      this.phase === "live" &&
      g &&
      !p.reload &&
      g.ammo < w.mag &&
      g.reserve > 0 &&
      !p.action
    )
      p.reload = now + w.reload * 1000 * this.roundEvent.reload;
  }
  input(p, m, now) {
    if(!p.alive)return;
    const f = (n) => (Number.isFinite(n) ? clamp(n, -1, 1) : 0);
    const pressed = !!m.fire || (!!m.altFire && (!!p.utility || WEAPONS[p.weapon]?.melee));
    if (pressed && !p.triggerHeld) {
      p.meleeHeavy = !!m.altFire;
      p.wantShot = true;
      p.throwUnderhand = !!m.altFire;
    }
    p.triggerHeld = pressed;
    if (!pressed) p.blockFireUntilRelease = false;
    if (validUtility(m.grenade) && p.grenades[m.grenade] > 0 && !p.reload && !p.action) {
      p.utility = m.grenade;
      p.wantShot = false;
    }

    p.input = {
      forward: f(m.forward),
      side: f(m.side),
      fire: !!m.fire,
      altFire: !!m.altFire,
      jump: !!m.jump,
      slow: !!m.slow,
      crouch: !!m.crouch,
      interact: !!m.interact,
    };
    p.inputAt = now;
    // Timestamp is bounded to a server-owned 200 ms rewind window.
    p.shotTime = Number.isFinite(m.shotTime) ? clamp(m.shotTime,now-200,now) : now;
    p.scoped = !!m.scoped && !!WEAPONS[p.weapon]?.scope;
    if (Number.isFinite(m.yaw)) p.yaw = m.yaw % (Math.PI * 2);
    if (Number.isFinite(m.pitch)) p.pitch = clamp(m.pitch, -Math.PI/2+.01, Math.PI/2-.01);
    if (
      typeof m.weapon === "string" &&
      Object.hasOwn(p.guns, m.weapon) &&
      !p.reload &&
      !p.action &&
      (m.weapon !== p.weapon || p.utility)
    ) {
      p.weapon = m.weapon;
      p.utility = null;
      p.recoilHeat = 0;
      p.nextShot = now + 250;
    }
    if (m.reload) this.reload(p, now);
    if (m.drop) this.drop(p, !!m.bombOnly);
    if (m.pickup) this.pickup(p);
    if (m.throwGrenade) this.throwGrenade(p, p.utility, !!m.underhand, now);
  }
  fire(p, now, difficulty = "normal") {
    const w = WEAPONS[p.weapon],
      g = p.guns[p.weapon];
    if (
      !p.alive ||
      this.phase !== "live" ||
      !g ||
      p.reload ||
      p.action ||
      now < p.nextShot ||
      p.utility ||
      p.blockFireUntilRelease
    )
      return;
    if(w.melee){this.melee(p,now,p.wantShot ? !!p.meleeHeavy : !!p.input.altFire);return;}
    if (!g.ammo) {
      if(!g.reserve){this.emit({type:"dry",id:p.id});p.nextShot=now+200;}
      this.reload(p, now);
      return;
    }
    if(!this.roundEvent.infiniteAmmo)g.ammo--;
    p.lastFire = now;
    p.nextShot = now + w.delay * 1000 * this.roundEvent.cadence;
    const spread = (p.bot
      ? { easy: 0.13, normal: 0.065, hard: 0.025 }[difficulty]
      : shotSpread(p.weapon, {
          movement: Math.hypot(p.vx, p.vz) / 5.2,
          airborne: !isGrounded(p,this.map.boxes),
          heat: p.recoilHeat, scoped:p.scoped,
        }) * (p.crouch ? 0.75 : 1)) * this.roundEvent.spread;
    const recoil = p.bot ? { pitch: 0, yaw: 0 } : recoilFor(p.weapon, p.recoilHeat);
    recoil.pitch*=this.roundEvent.recoil;recoil.yaw*=this.roundEvent.recoil;
    const d = direction(
        p.yaw + recoil.yaw + (Math.random() - 0.5) * spread,
        p.pitch + recoil.pitch + (Math.random() - 0.5) * spread,
      ),
      o = [p.x, p.y, p.z];
    p.recoilHeat = Math.min(23, p.recoilHeat + 1);
    let dist = Math.min(wallDistance(o, d, this.map.boxes), d[1] < 0 ? -o[1] / d[1] : Infinity),
      target = null,
      region = null;
    for (const q of this.players.values())
      if (q.alive && q.team !== p.team) {
        const frame = !p.bot && this.history.length ? this.history.reduce((a,b)=>Math.abs(b.time-(p.shotTime||now))<Math.abs(a.time-(p.shotTime||now))?b:a) : null;
        const old = frame?.positions.get(q.id);
        const hit = hitPlayer(o, d, old && old.alive ? {...q,...old} : q);
        if (hit.distance < dist) {
          dist = hit.distance;
          target = q;
          region = hit.region;
        }
      }
    if (!Number.isFinite(dist)) dist = 90;
    this.emit({
      type: "shot",
      id: p.id,
      from: o,
      to: o.map((x, i) => x + d[i] * dist),
      weapon: p.weapon,
    });
    if (target) {
      const damage = damageFor(target, p.weapon, region, dist);
      if(this.roundEvent.headOnly && region!=="head")return;
      damage.hp = Math.round(damage.hp * this.roundEvent.damage);
      const actual=Math.min(target.hp,damage.hp);
      target.hp = Math.max(0, target.hp - damage.hp);
      target.lastDamageAt=now;
      this.damageHeal(p,actual);
      target.armor = Math.max(0, target.armor - damage.armor);
      this.emit({
        type: "hit",
        id: p.id,
        target: target.id,
        head: region === "head",
        region,
        damage: damage.hp,
      });
      if (!target.hp) {
        this.kill(target, p, now);
        this.emit({
          type: "kill",
          killer: p.name,
          victim: target.name,
          team: p.team,
          head: region === "head",
        });
      }
    }
  }
  melee(p,now,heavy=false){
    const w=WEAPONS[p.weapon],o=[p.x,p.y,p.z],d=direction(p.yaw,p.pitch);
    p.nextShot=now+(heavy?950:500);p.lastFire=now;
    this.emit({type:"melee",id:p.id,weapon:p.weapon,heavy});
    let nearest=Math.min(w.range,wallDistance(o,d,this.map.boxes)),target=null;
    for(const q of this.players.values())if(q.alive&&q.team!==p.team){
      const hit=hitPlayer(o,d,q);
      if(hit.distance<nearest){nearest=hit.distance;target=q;}
    }
    if(!target)return;
    const behind=Math.cos(p.yaw-target.yaw)>.5;
    const raw=Math.round((behind?(heavy?180:90):(heavy?65:40))*this.roundEvent.damage*(this.roundEvent.melee||1));
    const actual=Math.min(target.hp,raw);
    target.hp=Math.max(0,target.hp-raw);target.lastDamageAt=now;this.damageHeal(p,actual);
    this.emit({type:"hit",id:p.id,target:target.id,head:false,region:"body",damage:raw});
    if(!target.hp){this.kill(target,p,now);this.emit({type:"kill",killer:p.name,victim:target.name,team:p.team,head:false,weapon:p.weapon});}
  }
  objective(p, input, now) {
    const b = this.bomb;
    const still =
      Math.hypot(p.vx, p.vz) < 0.15 &&
      feetY(p) < 0.02 &&
      !input.forward &&
      !input.side &&
      !input.jump &&
      !input.fire &&
      !input.altFire &&
      !p.utility &&
      !p.reload;
    let kind = null,
      duration = 0;
    if (input.interact && still) {
      if (b.state === "carried" && b.carrier === p.id && atSite(p, this.map.sites)) {
        kind = "plant";
        duration = this.rules.plantMs * this.roundEvent.plant;
      }
      if (b.state === "planted" && p.team !== this.attackTeam && this.reachable(p, b)) {
        kind = "defuse";
        duration = (p.kit ? this.rules.kitMs : this.rules.defuseMs) * this.roundEvent.defuse;
      }
    }
    if (!kind) {
      if (b.actor === p.id) {
        delete b.actor;
        delete b.startedAt;
      }
      p.action = null;
      return;
    }
    if (b.actor && b.actor !== p.id) {
      p.action = null;
      return;
    }
    if (b.actor !== p.id || p.action?.kind !== kind) {
      b.actor = p.id;
      b.startedAt = now;
      p.action = { kind, startedAt: now, duration };
    }
    if (now - b.startedAt < duration) return;
    p.action = null;
    if (kind === "plant") {
      this.bomb = {
        state: "planted",
        x: p.x,
        y:supportAt(p.x,p.z,this.map.boxes,feetY(p)+.03),
        z: p.z,
        site: atSite(p, this.map.sites).id,
        explodeAt: now + this.rules.bombMs * this.roundEvent.fuse,
      };
      p.money = Math.min(16000, p.money + 300);
      this.emit({ type: "plant", site: this.bomb.site });
    } else {
      this.bomb = { ...b, state: "defused", actor: null };
      p.money = Math.min(16000, p.money + 300);
      this.finish(1 - this.attackTeam, "defused", now);
    }
  }
  tick(now, dt, difficulty = "normal", botThink = () => {}) {
    if (this.phase === "freeze" && now >= this.until) {
      this.phase = "live";
      this.until = now + this.rules.roundMs * this.roundEvent.round;
      this.liveStartedAt=now;
      for(const p of this.players.values())p.nextRefill=now+(this.roundEvent.refillSeconds||0)*1000;
    } else if (this.phase === "end" && now >= this.until) {
      this.startRound(now);
    }
    if (this.phase !== "live") return;
    this.history.push({time:now,positions:new Map([...this.players].map(([id,p])=>[id,{x:p.x,y:p.y,z:p.z,crouch:p.crouch,alive:p.alive}]))});
    this.history = this.history.filter(f=>now-f.time<=250);
    // Explosion wins a same-tick race; a late defuse cannot beat an expired fuse.
    if (this.bomb.state === "planted" && now >= this.bomb.explodeAt) {
      this.bomb.state = "exploded";
      for (const p of this.players.values())
        if (p.alive) {
          const distance = Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z);
          p.hp = Math.max(0, p.hp - Math.round(450 * Math.exp(-distance / 7)));
          if (!p.hp) this.kill(p, null, now);
        }
      this.finish(this.attackTeam, "exploded", now);
      return;
    }
    const actor = this.players.get(this.bomb.actor);
    if (this.bomb.actor && (!actor?.alive || (!actor.bot && now - (actor.inputAt || 0) > 300))) {
      if (actor) actor.action = null;
      delete this.bomb.actor;
      delete this.bomb.startedAt;
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const e=this.roundEvent;
      if(e.regen && now-(p.lastDamageAt||this.liveStartedAt||now)>=4000 && p.hp<p.maxHp){
        p.regenCarry=(p.regenCarry||0)+e.regen*dt;const n=Math.floor(p.regenCarry);
        p.regenCarry-=n;this.heal(p,n);
      }else p.regenCarry=0;
      if(e.refill && now >= (p.nextRefill||Infinity)){
        if(utilityCount(p)<4 && p.grenades[e.refill]<UTILITY[e.refill].max)p.grenades[e.refill]++;
        p.nextRefill=now+e.refillSeconds*1000;
      }
      if (now - p.lastFire > 240) p.recoilHeat = Math.max(0, p.recoilHeat - dt * 6);
      if (p.reload && now >= p.reload) {
        const g = p.guns[p.weapon],
          w = WEAPONS[p.weapon];
        if (g) {
          const n = Math.min(w.mag - g.ammo, g.reserve);
          g.ammo += n;
          g.reserve -= n;
        }
        p.reload = 0;
      }
      if (p.bot) {
        botThink(p, now, dt);
        verticalStep(p,dt,this.map.boxes,15*this.roundEvent.gravity);
        continue;
      }
      const input = now - (p.inputAt || 0) > 300 ? {} : p.input;
      const feet = feetY(p);
      p.crouch = !!input.crouch || (p.crouch && blocked(p.x,p.z,.36,this.map.boxes,feet,1.87));
      p.y = feet + eyeHeight(p);
      accelerate(p, input, dt, this.map.boxes);
      if (input.jump && !p.jumpHeld && isGrounded(p,this.map.boxes)) {
        p.vy = 5.2 * this.roundEvent.jump;
      }
      p.jumpHeld = !!input.jump;
      verticalStep(p,dt,this.map.boxes,15*this.roundEvent.gravity);
      this.objective(p, input, now);
      if (p.utility && p.wantShot) this.throwGrenade(p, p.utility, !!p.throwUnderhand, now);
      else if ((input.fire && WEAPONS[p.weapon]?.auto) || p.wantShot) this.fire(p, now, difficulty);
      p.wantShot = false;
    }
    if (this.phase !== "live") return;
    this.updateUtilities(now, dt);
    const alive = [0, 0],
      present = [0, 0];
    for (const p of this.players.values()) {
      if (p.roundActive !== false) present[p.team]++;
      if (p.alive) alive[p.team]++;
    }
    const a = this.attackTeam,
      d = 1 - a;
    // Allow private solo practice; real two-sided rounds use elimination.
    if (present[0] && present[1]) {
      if (!alive[d]) {
        this.finish(a, "elimination", now);
        return;
      }
      if (!alive[a] && this.bomb.state !== "planted") {
        this.finish(d, "elimination", now);
        return;
      }
    }
    if (now >= this.until && this.bomb.state !== "planted") this.finish(d, "timeout", now);
  }
  paintOwned(p) {
    for (const [w, g] of Object.entries(p.guns)) if (g.owner === p.id) g.skin = p.loadout[w];
  }
  setLoadout(p, value) {
    if (!validLoadout(value)) return "Неизвестная раскраска";
    p.loadout = normalizeProfile({loadout:value}).loadout;
    if (this.phase === "freeze" || this.phase === "waiting") this.paintOwned(p);
    return null;
  }
  throwGrenade(p, kind, underhand, now) {
    if (
      this.roundEvent.noUtility ||
      !validUtility(kind) ||
      !p.alive ||
      this.phase !== "live" ||
      p.reload ||
      p.action ||
      now < (p.throwAt || 0) ||
      !p.grenades[kind]
    )
      return false;
    const speed = (underhand ? 6.5 : 14) * this.roundEvent.grenadeSpeed,
      d = direction(p.yaw, p.pitch);
    const g = {
      id: randomUUID().slice(0, 8),
      kind,
      owner: p.id,
      team: p.team,
      x: p.x,
      y: p.y - 0.1,
      z: p.z,
      vx: d[0] * speed + p.vx * 0.5,
      vy: d[1] * speed + 2,
      vz: d[2] * speed + p.vz * 0.5,
      born: now,
      detonateAt: now + UTILITY[kind].fuse * this.roundEvent.grenadeFuse,
    };
    this.projectiles.push(g);
    p.grenades[kind]--;
    p.throwAt = now + 750;
    p.utility = null;
    p.blockFireUntilRelease = true;
    this.emit({ type: "throw", id: p.id, kind, x: g.x, y: g.y, z: g.z });
    return true;
  }
  hurtUtility(p, raw, source, now, armor = true) {
    if (!p.alive || raw <= 0 || (p.team === source.team && p.id !== source.owner)) return;
    const saved = armor ? Math.min(Math.ceil(raw * 0.35), p.armor * 2) : 0;
    p.hp = Math.max(0, p.hp - (raw - saved));
    p.lastDamageAt=now;
    p.armor = Math.max(0, p.armor - Math.ceil(saved / 2));
    if (!p.hp) {
      const killer = this.players.get(source.owner);
      this.kill(p, killer && killer.team !== p.team ? killer : null, now);
      this.emit({
        type: "kill",
        killer: killer?.name || "UTILITY",
        victim: p.name,
        team: source.team,
        head: false,
        weapon: source.kind,
      });
    }
  }
  detonate(g, now) {
    this.emit({ type: "detonate", kind: g.kind, x: g.x, y: g.y, z: g.z });
    if (g.kind === "he")
      for (const p of this.players.values())
        if (p.alive) {
          const dist = Math.hypot(p.x - g.x, p.y - 0.6 - g.y, p.z - g.z);
          if (dist >= 7.5) continue;
          const visible =
            [p.y, p.y - 0.5, Math.max(0.2, feetY(p) + 0.3)].filter((y) =>
              lineVisible([g.x, g.y, g.z], [p.x, y, p.z], this.map.boxes),
            ).length / 3;
          this.hurtUtility(p, Math.round(110 * (1 - dist / 7.5) * visible), g, now);
        }
    if (g.kind === "flash")
      for (const p of this.players.values())
        if (p.alive) {
          const peak = flashPower(p, g, this.map.boxes);
          if (peak < 0.025) continue;
          const current = p.flash
            ? Math.pow(Math.max(0, (p.flash.until - now) / (p.flash.until - p.flash.start)), 0.55) *
              p.flash.peak
            : 0;
          if (peak >= current) p.flash = { start: now, until: now + 600 + peak * 3400, peak };
        }
    if (g.kind === "smoke")
      this.zones.push({
        id: g.id,
        kind: "smoke",
        x: g.x,
        y: Math.max(0, g.y - 0.095),
        z: g.z,
        radius: 3.6,
        born: now,
        until: now + UTILITY.smoke.duration,
      });
    if (g.kind === "fire") {
      const cells = fireCells(g, this.map.boxes);
      if (cells.length)
        this.zones.push({
          id: g.id,
          kind: "fire",
          owner: g.owner,
          team: g.team,
          x: g.x,
          y: Math.max(0, g.y - 0.095),
          z: g.z,
          radius: 3.2,
          born: now,
          until: now + UTILITY.fire.duration,
          cells,
        });
    }
  }
  updateUtilities(now, dt) {
    const remaining = [];
    for (const g of this.projectiles) {
      const hits = advanceGrenade(g, dt, this.map.boxes);
      if (hits && now - (g.lastBounce || 0) > 100) {
        this.emit({ type: "bounce", kind: g.kind, x: g.x, y: g.y, z: g.z });
        g.lastBounce = now;
      }
      const landFire = g.kind === "fire" && g.onGround && now - g.born > 250;
      const settled = g.kind !== "smoke" || g.sleeping || now - g.born >= 4000;
      if (landFire || (now >= g.detonateAt && settled)) this.detonate(g, now);
      else remaining.push(g);
    }
    this.projectiles = remaining;
    this.zones = this.zones.filter((z) => z.until > now);
    const smoke = this.zones.filter((z) => z.kind === "smoke");
    for (const z of this.zones)
      if (z.kind === "fire") {
        const before = z.cells.length;
        z.cells = z.cells.filter(
          (c) =>
            !smoke.some(
              (s) => Math.hypot(c.x - s.x, c.z - s.z) < s.radius && Math.abs(c.y - s.y) < 3,
            ),
        );
        if (before && !z.cells.length) this.emit({ type: "extinguish", x: z.x, y: z.y, z: z.z });
      }
    this.zones = this.zones.filter((z) => z.kind !== "fire" || z.cells.length);
    for (const p of this.players.values())
      if (p.alive) {
        const fire = this.zones.find(
          (z) =>
            z.kind === "fire" &&
            (p.team !== z.team || p.id === z.owner) &&
            z.cells.some(
              (c) => Math.hypot(p.x - c.x, p.z - c.z) < 0.9 && Math.abs(feetY(p) - c.y) < 0.65,
            ),
        );
        if (fire) {
          p.fireDamage = (p.fireDamage || 0) + dt * 35;
          const n = Math.floor(p.fireDamage);
          p.fireDamage -= n;
          this.hurtUtility(p, n, fire, now, false);
        } else p.fireDamage = 0;
      }
  }
  smokeObscures(a, b) {
    const d = b.map((v, i) => v - a[i]),
      length = Math.hypot(...d);
    return (
      length > 0.01 &&
      smokeBlocks(
        this.zones,
        a,
        d.map((v) => v / length),
        length,
      )
    );
  }
  snapshot(now) {
    return {
      mode: this.mode,
      roundEvent:this.roundEvent,
      mapId: this.map.id,
      phase: this.phase,
      round: this.round,
      score: this.score,
      until: this.until,
      roundWinner: this.roundWinner,
      reason: this.reason,
      attackTeam: this.attackTeam,
      bomb: this.bomb,
      drops: this.drops,
      projectiles: this.projectiles,
      zones: this.zones,
      rules: this.rules,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        bot: p.bot,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vz: p.vz,
        crouch: p.crouch,
        grounded: isGrounded(p,this.map.boxes),
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        maxHp:p.maxHp||100,
        armor: p.armor,
        helmet: p.helmet,
        kit: p.kit,
        money: p.money,
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        weapon: p.weapon,
        inventory: Object.keys(p.guns),
        skins: Object.fromEntries(
          Object.entries(p.guns).map(([w, g]) => [w, g.skin || "standard"]),
        ),
        loadout: p.loadout,
        grenades: p.grenades,
        utility: p.utility,
        flash: p.flash,
        scoped: !!p.scoped,
        disconnected: !!p.disconnected,
        ammo: p.guns[p.weapon]?.ammo || 0,
        reserve: p.guns[p.weapon]?.reserve || 0,
        reload: p.reload,
        action: p.action,
        recoil: Object.fromEntries(Object.entries(recoilFor(p.weapon,p.recoilHeat)).map(([k,v])=>[k,v*this.roundEvent.recoil])),
        spread:
          shotSpread(p.weapon, {
            movement: Math.hypot(p.vx, p.vz) / 5.2,
            airborne: !isGrounded(p,this.map.boxes),
            heat: p.recoilHeat, scoped:p.scoped,
          }) * (p.crouch ? 0.75 : 1) * this.roundEvent.spread,
      })),
    };
  }
}
