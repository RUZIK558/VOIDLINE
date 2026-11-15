import { test } from "node:test";
import assert from "node:assert/strict";
import { TacticalMatch } from "./legacy-fixture.mjs";
import {
  accelerate,
  hitPlayer,
  damageFor,
  shotSpread,
  SITES,
  atSite,
  blocked,
} from "./legacy-fixture.mjs";
function fixture(rules = {}) {
  const players = new Map(),
    events = [],
    game = new TacticalMatch(players, (e) => events.push(e), rules);
  const a = game.make("A", 0),
    d = game.make("D", 1);
  game.startRound(1000);
  return { game, a, d, players, events };
}
function plant(game, a, now = 2000) {
  game.phase = "live";
  a.x = SITES[0].x;
  a.z = SITES[0].z;
  a.y = 1.65;
  a.vx = a.vz = 0;
  game.bomb = { state: "carried", carrier: a.id };
  game.objective(a, { interact: true }, now);
  game.objective(a, { interact: true }, now + game.rules.plantMs);
  return now + game.rules.plantMs;
}
test("movement: acceleration, diagonal cap, collision and counter-strafe brake", () => {
  const start = () => ({ x: 0, z: 20, yaw: 0, vx: 0, vz: 0 });
  const p = start();
  accelerate(p, { side: 1 }, 0.016);
  assert.ok(p.vx > 0 && p.vx < 5.2);
  for (let i = 0; i < 25; i++) accelerate(p, { side: 1 }, 0.016);
  const coast = { ...p },
    counter = { ...p };
  accelerate(coast, {}, 0.05);
  accelerate(counter, { side: -1 }, 0.05);
  assert.ok(Math.abs(counter.vx) < Math.abs(coast.vx));
  const diagonal = start();
  for (let i = 0; i < 25; i++) accelerate(diagonal, { side: 1, forward: 1 }, 0.016);
  assert.ok(Math.hypot(diagonal.vx, diagonal.vz) <= 5.200001);
  const crouch = start();
  for (let i = 0; i < 25; i++) accelerate(crouch, { side: 1, crouch: true }, 0.016);
  assert.ok(crouch.vx <= 1.7);
  const wall = { x: 0, z: 2.1, yaw: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 30; i++) accelerate(wall, { forward: 1 }, 0.016);
  assert.equal(blocked(wall.x, wall.z), false);
});
test("anatomical hit regions and crouch hitbox height; armor and helmet absorb server damage", () => {
  const p = { x: 0, z: 0, y: 1.65, crouch: false, armor: 100, helmet: false };
  assert.equal(hitPlayer([0, 1.7, 5], [0, 0, -1], p).region, "head");
  assert.equal(hitPlayer([0, 1, 5], [0, 0, -1], p).region, "body");
  assert.equal(hitPlayer([0, 0.3, 5], [0, 0, -1], p).region, "legs");
  assert.equal(damageFor(p, "rifle", "head").hp, 132);
  assert.ok(damageFor({ ...p, helmet: true }, "rifle", "head").hp < 132);
  assert.ok(damageFor(p, "rifle", "body").hp < 33);
  assert.equal(damageFor(p, "rifle", "legs").armor, 0);
  assert.ok(damageFor({ ...p, armor: 1 }, "rifle", "body").hp > damageFor(p, "rifle", "body").hp);
  p.crouch = true;
  p.y = 1.05;
  assert.equal(hitPlayer([0, 1.7, 5], [0, 0, -1], p).distance, Infinity);
  assert.equal(hitPlayer([0, 1.1, 5], [0, 0, -1], p).region, "head");
});
test("buying validates phase, price, ownership, role, armor prerequisites, prototypes and cap", () => {
  const { game, a, d } = fixture();
  assert.equal(a.money, 800);
  assert.ok(game.buy(a, "rifle"));
  assert.equal(a.money, 800);
  assert.ok(game.buy(a, "helmet"));
  assert.equal(game.buy(a, "armor"), null);
  assert.equal(a.armor, 100);
  assert.equal(a.money, 150);
  assert.ok(game.buy(a, "armor"));
  assert.ok(game.buy(a, "kit"));
  assert.equal(game.buy(d, "kit"), null);
  assert.equal(d.kit, true);
  assert.ok(game.buy(d, "constructor"));
  assert.ok(game.buy(d, { toString: "x" }));
  a.money = 10000;
  assert.equal(game.buy(a, "helmet"), null);
  assert.equal(game.buy(a, "rifle"), null);
  assert.ok(game.buy(a, "rifle"));
  game.phase = "live";
  const before = a.money;
  assert.ok(game.buy(a, "ammo"));
  assert.equal(a.money, before);
  game.phase = "freeze";
  a.x = 12;
  assert.ok(game.buy(a, "ammo"));
});
test("drop/pickup preserves magazine and reserve, blocks duplicates and range, clears reload", () => {
  const { game, a, d } = fixture();
  a.guns.rifle = { ammo: 7, reserve: 31 };
  a.weapon = "rifle";
  a.reload = 9999;
  game.drop(a);
  assert.equal(a.weapon, "pistol");
  assert.equal(a.reload, 0);
  assert.equal(game.drops.length, 1);
  assert.equal(a.guns.rifle, undefined);
  game.pickup(d);
  assert.equal(d.guns.rifle, undefined);
  d.x = a.x;
  d.z = a.z;
  game.pickup(d);
  assert.deepEqual(d.guns.rifle, { ammo: 7, reserve: 31, skin: "standard", owner: null });
  assert.equal(game.drops.length, 0);
  game.pickup(d);
  assert.equal(game.drops.length, 0);
  game.drop(d);
  assert.equal(game.drops.length, 1);
  game.pickup(d);
  assert.equal(game.drops.length, 0);
});
test("plant needs correct carrier, site, stillness and continuous hold; cancellation resets timer", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  game.objective(a, { interact: true }, 2000);
  assert.equal(a.action, null);
  a.x = -15;
  a.z = -7;
  game.objective(d, { interact: true }, 2000);
  assert.equal(d.action, null);
  game.objective(a, { interact: true }, 2000);
  assert.equal(a.action.kind, "plant");
  game.objective(a, {}, 4000);
  assert.equal(a.action, null);
  game.objective(a, { interact: true }, 4500);
  game.objective(a, { interact: true }, 7000);
  assert.equal(game.bomb.state, "carried");
  game.objective(a, { interact: true }, 7500);
  assert.equal(game.bomb.state, "planted");
  assert.equal(game.bomb.site, "A");
  assert.equal(a.money, 1100);
});
test("plant is interrupted by movement, jump, firing, reloading; expired inputs release defuse ownership", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  a.x = -15;
  a.z = -7;
  for (const input of [{ forward: 1 }, { jump: true }, { fire: true }]) {
    game.objective(a, { interact: true }, 2000);
    game.objective(a, { interact: true, ...input }, 2500);
    assert.equal(a.action, null);
  }
  a.reload = 9999;
  game.objective(a, { interact: true }, 2000);
  assert.equal(a.action, null);
  a.reload = 0;
  plant(game, a);
  d.x = -15;
  d.z = -7;
  d.inputAt = 5100;
  game.input(d, { interact: true }, 5100);
  game.tick(5100, 0.016);
  assert.equal(d.action.kind, "defuse");
  game.tick(5500, 0.016);
  assert.equal(d.action, null);
  assert.equal(game.bomb.actor, undefined);
});
test("defuse: team/range, one active operator, kit halves time and interrupts safely", () => {
  const { game, a, d } = fixture();
  const t = plant(game, a);
  assert.equal(game.bomb.state, "planted");
  game.objective(d, { interact: true }, t);
  assert.equal(d.action, null);
  d.x = a.x;
  d.z = a.z;
  game.objective(a, { interact: true }, t);
  assert.equal(a.action, null);
  game.objective(d, { interact: true }, t);
  assert.equal(d.action.duration, 10000);
  const second = game.make("D2", 1);
  second.x = a.x;
  second.z = a.z;
  game.objective(second, { interact: true }, t + 10);
  assert.equal(second.action, null);
  game.objective(d, {}, t + 1000);
  d.kit = true;
  game.objective(d, { interact: true }, t + 1200);
  assert.equal(d.action.duration, 5000);
  game.objective(d, { interact: true }, t + 6199);
  assert.equal(game.phase, "live");
  game.objective(d, { interact: true }, t + 6200);
  assert.equal(game.phase, "end");
  assert.equal(game.reason, "defused");
  assert.deepEqual(game.score, [0, 1]);
});
test("planted bomb survives attack elimination, explodes after deadline, cannot be defused late", () => {
  const { game, a, d } = fixture();
  const t = plant(game, a);
  game.kill(a, d, t + 1);
  game.tick(t + 10, 0.016);
  assert.equal(game.phase, "live");
  d.x = a.x;
  d.z = a.z;
  game.input(d, { interact: true }, game.bomb.explodeAt - 5);
  game.tick(game.bomb.explodeAt - 5, 0.016);
  assert.equal(d.action.kind, "defuse");
  game.tick(game.bomb.explodeAt, 0.016);
  assert.equal(game.reason, "exploded");
  assert.deepEqual(game.score, [1, 0]);
  assert.equal(game.bomb.state, "exploded");
  assert.equal(d.alive, false);
});
test("round timeout belongs to defense; elimination and payouts occur only once", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  game.until = 3000;
  game.tick(3000, 0.016);
  assert.equal(game.reason, "timeout");
  assert.equal(d.money, 4050);
  assert.equal(a.money, 2200);
  game.finish(1, "timeout", 3100);
  assert.deepEqual(game.score, [0, 1]);
  assert.equal(d.money, 4050);
  game.startRound(8000);
  game.phase = "live";
  game.kill(d, a, 8100);
  game.tick(8200, 0.016);
  assert.equal(game.roundWinner, 0);
  assert.equal(a.kills, 1);
  assert.equal(a.money, 5750);
});
test("death and disconnect release the carried bomb for a surviving teammate; pickup is role/range checked", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  const mate = game.make("A2", 0);
  mate.x = a.x;
  mate.z = a.z;
  game.kill(a, d, 2000);
  assert.equal(game.bomb.state, "dropped");
  game.pickup(d);
  assert.equal(game.bomb.state, "dropped");
  game.pickup(mate);
  assert.equal(game.bomb.carrier, mate.id);
  game.remove(mate);
  assert.equal(game.bomb.state, "dropped");
});
test("survivors keep weapons and armor, dead players respawn with pistol; half switches roles, resets money not score", () => {
  const { game, a, d } = fixture();
  a.guns.rifle = { ammo: 9, reserve: 21 };
  a.armor = 70;
  game.phase = "live";
  game.kill(d, a, 2000);
  game.finish(0, "elimination", 2000);
  game.startRound(7000);
  assert.deepEqual(a.guns.rifle, { ammo: 9, reserve: 21 });
  assert.equal(a.armor, 70);
  assert.deepEqual(Object.keys(d.guns).filter(w=>!["butterfly","karambit","m9"].includes(w)), ["pistol"]);
  game.round = 6;
  game.startRound(8000);
  assert.equal(game.round, 7);
  assert.equal(game.attackTeam, 1);
  assert.equal(a.z, -20);
  assert.equal(d.z, 20);
  assert.equal(a.money, 800);
  assert.deepEqual(Object.keys(a.guns).filter(w=>!["butterfly","karambit","m9"].includes(w)), ["pistol"]);
  assert.deepEqual(game.score, [1, 0]);
});
test("first seven wins ends the match, does not silently reset; explicit restart resets everything", () => {
  const { game, a } = fixture();
  for (let n = 0; n < 7; n++) {
    game.phase = "live";
    game.finish(0, "elimination", 2000 + n * 100);
    if (n < 6) game.startRound(2100 + n * 100);
  }
  assert.equal(game.phase, "match");
  assert.deepEqual(game.score, [7, 0]);
  const round = game.round;
  game.tick(999999, 0.016);
  assert.equal(game.phase, "match");
  assert.equal(game.round, round);
  game.reset();
  game.startRound(2000000);
  assert.deepEqual(game.score, [0, 0]);
  assert.equal(game.round, 1);
  assert.equal(a.money, 800);
  assert.equal(a.kills, 0);
});
test("input rejects forged weapons and numbers; crouching changes camera and collision volume authoritatively", () => {
  const { game, a } = fixture();
  game.phase = "live";
  game.input(
    a,
    { weapon: "constructor", yaw: "bad", pitch: Infinity, forward: 999, crouch: true },
    2000,
  );
  game.tick(2016, 0.016);
  assert.equal(a.weapon, "pistol");
  assert.equal(a.y, 1.05);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.yaw));
  assert.equal(a.input.forward, 1);
  game.input(a, { crouch: false }, 2032);
  game.tick(2032, 0.016);
  assert.equal(a.y, 1.65);
  assert.ok(shotSpread("rifle", { movement: Math.hypot(a.vx, a.vz) / 5.2 }) > shotSpread("rifle"));
});
test("authoritative fire hits the actual head volume, consumes ammo, applies helmet, and cannot shoot through cover", () => {
  const { game, a, d, events } = fixture();
  game.phase = "live";
  a.x = 0;
  a.z = 20;
  a.y = 1.65;
  a.yaw = 0;
  a.pitch = 0;
  a.weapon = "rifle";
  a.guns.rifle = { ammo: 24, reserve: 120 };
  d.x = 0;
  d.z = 18;
  d.armor = 100;
  d.helmet = true;
  game.fire(a, 2000);
  assert.equal(a.guns.rifle.ammo, 23);
  assert.ok(d.hp > 0 && d.hp < 100);
  assert.ok(d.armor < 100);
  assert.equal(events.at(-1).region, "head");
  d.hp = 100;
  d.armor = 0;
  d.helmet = false;
  game.fire(a, 2200);
  assert.equal(d.alive, false);
  assert.equal(a.kills, 1);
  assert.equal(a.money, 1100);
  const f = fixture();
  f.game.phase = "live";
  f.a.x = f.d.x = 0;
  f.a.z = 4;
  f.d.z = -4;
  f.a.yaw = 0;
  f.a.pitch = 0;
  f.game.fire(f.a, 2000);
  assert.equal(f.d.hp, 100);
});
test("bomb, planted actions and dropped guns cannot be recovered through solid cover", () => {
  const { game, a } = fixture();
  game.phase = "live";
  a.x = 0;
  a.z = 2;
  a.y = 1.65;
  game.bomb = { state: "dropped", x: 0, z: 1 };
  game.pickup(a);
  assert.equal(game.bomb.state, "dropped");
  game.drops = [{ id: "through-wall", x: 0, z: 1, weapon: "rifle", ammo: 24, reserve: 120 }];
  game.pickup(a);
  assert.equal(a.guns.rifle, undefined);
});
test("a late joining spectator is not counted as an eliminated active team", () => {
  const players = new Map();
  const game = new TacticalMatch(players);
  game.make("SOLO", 0);
  game.startRound(1000);
  game.phase = "live";
  const spectator = game.make("LATE", 1);
  spectator.alive = false;
  spectator.hp = 0;
  spectator.roundActive = false;
  game.tick(2000, 0.016);
  assert.equal(game.phase, "live");
  assert.deepEqual(game.score, [0, 0]);
});
