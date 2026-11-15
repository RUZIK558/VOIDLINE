import { test } from "node:test";
import assert from "node:assert/strict";
import { TacticalMatch } from "./legacy-fixture.mjs";
import {
  advanceGrenade,
  lineVisible,
  flashPower,
  fireCells,
  smokeBlocks,
  UTILITY,
  utilityCount,
} from "./legacy-fixture.mjs";
import { SKINS, validLoadout, normalizeProfile } from "../public/cosmetics.mjs";
function fixture() {
  const events = [],
    game = new TacticalMatch(new Map(), (e) => events.push(e));
  const a = game.make("A", 0),
    d = game.make("D", 1);
  game.startRound(1000);
  return { game, a, d, events };
}
const ball = (x = 0, y = 2, z = 20, vx = 0, vy = 0, vz = 0) => ({ x, y, z, vx, vy, vz });
test("physics: gravity, floor restitution and sleeping, bounded integration", () => {
  const g = ball();
  advanceGrenade(g, 0.05);
  assert.ok(g.y < 2 && g.vy < 0);
  let bounced = false;
  for (let i = 0; i < 500; i++) {
    const previous = g.vy;
    advanceGrenade(g, 0.016);
    if (previous < 0 && g.vy > 0) bounced = true;
    assert.ok(g.y >= 0.0949);
  }
  assert.equal(bounced, true);
  assert.equal(g.sleeping, true);
  assert.equal(g.vx, 0);
  assert.ok(g.y < 0.11);
});
test("physics: swept sphere cannot tunnel through wall at high velocity; cover top has a real collision", () => {
  const g = ball(17, 2, 7, 180, 0, 0);
  advanceGrenade(g, 0.05);
  assert.ok(g.x < 18.5);
  assert.ok(g.vx < 0);
  const top = ball(0, 3, 0, 0, -5, 0);
  for (let i = 0; i < 300; i++) advanceGrenade(top, 0.016);
  assert.ok(top.y >= 1.99);
  assert.equal(top.sleeping, true);
});
test("shop: finite utility slots, two flash maximum, one of other types, debit only on success", () => {
  const { game, a } = fixture();
  a.money = 10000;
  assert.equal(game.buy(a, "flash"), null);
  assert.equal(game.buy(a, "flash"), null);
  const money = a.money;
  assert.ok(game.buy(a, "flash"));
  assert.equal(a.money, money);
  assert.equal(game.buy(a, "he"), null);
  assert.equal(game.buy(a, "smoke"), null);
  assert.equal(utilityCount(a), 4);
  assert.ok(game.buy(a, "fire"));
  assert.equal(a.grenades.fire, 0);
});
test("throw: ownership, phase, alive, action/reload and cooldown are authoritative; underhand is slower", () => {
  const { game, a } = fixture();
  assert.equal(game.throwGrenade(a, "he", false, 2000), false);
  game.buy(a, "he");
  assert.equal(game.throwGrenade(a, "he", false, 2000), false);
  game.phase = "live";
  a.reload = 9999;
  assert.equal(game.throwGrenade(a, "he", false, 2000), false);
  a.reload = 0;
  a.action = { kind: "plant" };
  assert.equal(game.throwGrenade(a, "he", false, 2000), false);
  a.action = null;
  assert.equal(game.throwGrenade(a, "constructor", false, 2000), false);
  assert.equal(game.throwGrenade(a, "he", false, 2000), true);
  assert.equal(a.grenades.he, 0);
  assert.equal(game.projectiles.length, 1);
  const high = game.projectiles[0];
  a.grenades.he = 1;
  assert.equal(game.throwGrenade(a, "he", true, 2200), false);
  assert.equal(game.throwGrenade(a, "he", true, 2800), true);
  assert.ok(
    Math.hypot(high.vx, high.vz) > Math.hypot(game.projectiles[1].vx, game.projectiles[1].vz),
  );
});
test("trigger: grenade release consumes one item; holding fire cannot shoot the gun after the throw", () => {
  const { game, a } = fixture();
  game.buy(a, "he");
  game.phase = "live";
  game.input(a, { grenade: "he" }, 2000);
  game.input(a, { fire: true }, 2010);
  game.tick(2016, 0.016);
  assert.equal(a.grenades.he, 0);
  assert.equal(a.guns.pistol.ammo, 12);
  assert.equal(game.projectiles.length, 1);
  for (let n = 0; n < 30; n++) {
    game.input(a, { fire: true }, 2020 + n * 20);
    game.tick(2020 + n * 20, 0.02);
  }
  assert.equal(a.guns.pistol.ammo, 12);
  game.input(a, { fire: false }, 2700);
  game.input(a, { fire: true }, 2750);
  game.tick(2750, 0.016);
  assert.equal(a.guns.pistol.ammo, 11);
});
test("HE: distance falloff, armor, self damage, teammate immunity and solid cover", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  a.x = 0;
  a.z = 20;
  d.x = 1;
  d.z = 20;
  const mate = game.make("MATE", 0);
  mate.x = 2;
  mate.z = 20;
  d.armor = 100;
  game.detonate({ kind: "he", owner: a.id, team: 0, x: 1, y: 1, z: 20 }, 2000);
  assert.ok(a.hp < 100);
  assert.ok(d.hp < 100 && d.hp > 0);
  assert.ok(d.armor < 100);
  assert.equal(mate.hp, 100);
  d.x = 0;
  d.z = -3;
  d.hp = 100;
  game.detonate({ kind: "he", owner: a.id, team: 0, x: 0, y: 1, z: 3 }, 2100);
  assert.equal(d.hp, 100);
});
test("flash: forward-facing victim has stronger blindness than looking away; walls prevent it", () => {
  const p = { x: 0, y: 1.65, z: 20, yaw: 0, pitch: 0 },
    g = { x: 0, y: 1.65, z: 17 };
  const front = flashPower(p, g),
    back = flashPower({ ...p, yaw: Math.PI }, g);
  assert.ok(front > back * 3);
  assert.ok(front > 0.7);
  assert.equal(flashPower({ ...p, x: 0, z: 3 }, { x: 0, y: 1, z: -3 }), 0);
  const { game, a } = fixture();
  game.phase = "live";
  a.x = 0;
  a.z = 20;
  game.detonate({ kind: "flash", ...g }, 2000);
  assert.ok(a.flash.until > 3000);
  assert.ok(a.flash.peak > 0.7);
});
test("smoke: physical area blocks line of sight, not bullets or HP, expires on server clock", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  a.x = 0;
  a.z = 20;
  d.x = 0;
  d.z = 16;
  a.yaw = 0;
  a.pitch = 0;
  game.detonate({ id: "S", kind: "smoke", x: 0, y: 0.095, z: 18 }, 2000);
  assert.equal(game.zones.length, 1);
  assert.equal(a.hp, 100);
  assert.equal(game.smokeObscures([0, 1.65, 20], [0, 1.65, 16]), true);
  assert.equal(smokeBlocks(game.zones, [10, 1.65, 20], [0, 0, -1], 8), false);
  game.fire(a, 2100);
  assert.ok(d.hp < 100);
  game.updateUtilities(16001, 0.016);
  assert.equal(game.zones.length, 0);
});
test("fire: floor patches do not spread through crates or on a different elevation; damage is time based", () => {
  const { game, a, d } = fixture();
  game.phase = "live";
  a.x = -4;
  a.z = 20;
  d.x = 0;
  d.z = 20;
  const cells = fireCells({ x: 0, y: 0.095, z: 3 });
  assert.ok(cells.length > 0);
  assert.equal(
    cells.some((c) => Math.abs(c.x) < 2.5 && Math.abs(c.z) < 1.5),
    false,
  );
  game.detonate({ id: "F", kind: "fire", owner: a.id, team: 0, x: 0, y: 0.095, z: 20 }, 2000);
  for (let i = 0; i < 60; i++) game.updateUtilities(2016 + (i * 1000) / 60, 1 / 60);
  assert.ok(d.hp >= 65 && d.hp <= 66);
  assert.equal(d.armor, 0);
});
test("smoke extinguishes actual fire cells; fire thrown into smoke cannot keep damaging players", () => {
  const { game, a, d, events } = fixture();
  game.phase = "live";
  a.x = -6;
  a.z = 20;
  d.x = 0;
  d.z = 20;
  game.detonate({ id: "F", kind: "fire", owner: a.id, team: 0, x: 0, y: 0.095, z: 20 }, 2000);
  game.detonate({ id: "S", kind: "smoke", x: 0, y: 0.095, z: 20 }, 2050);
  game.updateUtilities(2060, 0.016);
  assert.equal(
    game.zones.some((z) => z.kind === "fire"),
    false,
  );
  assert.equal(d.hp, 100);
  assert.ok(events.some((e) => e.type === "extinguish"));
});
test("utility inventory: drop/death/pickup respects capacity and does not duplicate grenades", () => {
  const { game, a, d } = fixture();
  game.buy(a, "flash");
  game.buy(a, "flash");
  a.utility = "flash";
  game.drop(a);
  assert.equal(a.grenades.flash, 1);
  assert.equal(game.drops[0].kind, "utility");
  d.x = a.x;
  d.z = a.z;
  game.pickup(d);
  assert.equal(d.grenades.flash, 1);
  assert.equal(game.drops.length, 0);
  game.phase = "live";
  game.kill(a, d, 2000);
  assert.equal(a.grenades.flash, 0);
  assert.equal(game.drops.filter((x) => x.kind === "utility").length, 1);
  game.pickup(d);
  assert.equal(d.grenades.flash, 2);
  game.pickup(d);
  assert.equal(d.grenades.flash, 2);
});
test("new rounds and restart clear airborne and area effects; survivors keep unspent grenades", () => {
  const { game, a } = fixture();
  game.buy(a, "smoke");
  game.phase = "live";
  game.projectiles.push({ id: "fake" });
  game.zones.push({ id: "fake" });
  game.startRound(9000);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.zones.length, 0);
  assert.equal(a.grenades.smoke, 1);
  game.reset();
  assert.equal(a.grenades.smoke, 0);
});
test("cosmetic catalogue: only known full loadouts are accepted, profile defaults are copied", () => {
  assert.equal(Object.keys(SKINS).length, 6);
  assert.equal(validLoadout({ rifle: "cobalt", pistol: "arctic" }), true);
  for (const bad of [
    null,
    [],
    { rifle: "constructor", pistol: "arctic" },
    { rifle: "cobalt", pistol: "arctic", url: "bad" },
  ])
    assert.equal(validLoadout(bad), false);
  const a = normalizeProfile(null),
    b = normalizeProfile(null);
  a.loadout.rifle = "carbon";
  assert.equal(b.loadout.rifle, "standard");
});
test("skins: server replicates equipped guns, dropped and captured skins persist; loadout cannot repaint stolen gun", () => {
  const { game, a, d } = fixture();
  assert.equal(game.setLoadout(a, { rifle: "ember", pistol: "cobalt" }), null);
  assert.equal(a.guns.pistol.skin, "cobalt");
  game.drop(a);
  d.x = a.x;
  d.z = a.z;
  game.drop(d);
  game.pickup(d);
  assert.equal(d.guns.pistol.skin, "cobalt");
  assert.equal(d.guns.pistol.owner, a.id);
  game.setLoadout(d, { rifle: "arctic", pistol: "carbon" });
  assert.equal(d.guns.pistol.skin, "cobalt");
  const state = game.snapshot(2000);
  assert.equal(state.players.find((p) => p.id === d.id).skins.pistol, "cobalt");
  assert.equal(state.drops[0].skin, "standard");
});
test("loadout changes during combat apply to own guns on the next preparation, not mid-shot; invalid skin cannot affect stats", () => {
  const { game, a } = fixture();
  game.phase = "live";
  const old = { ...a.guns.pistol };
  game.setLoadout(a, { rifle: "carbon", pistol: "ember" });
  assert.equal(a.guns.pistol.skin, "standard");
  game.startRound(9000);
  assert.equal(a.guns.pistol.skin, "ember");
  assert.equal(a.guns.pistol.ammo, old.ammo);
  assert.ok(game.setLoadout(a, { rifle: "data:bad", pistol: "ember" }));
});
test("a full click between server frames is latched once for pistol and for underhand grenade", () => {
  const { game, a } = fixture();
  game.buy(a, "flash");
  game.phase = "live";
  game.input(a, { fire: true }, 2000);
  game.input(a, { fire: false }, 2002);
  game.tick(2016, 0.016);
  assert.equal(a.guns.pistol.ammo, 11);
  game.input(a, { grenade: "flash" }, 2100);
  game.input(a, { altFire: true }, 2101);
  game.input(a, { altFire: false }, 2103);
  game.tick(2116, 0.016);
  assert.equal(a.grenades.flash, 0);
  assert.equal(game.projectiles.length, 1);
  assert.ok(Math.abs(game.projectiles[0].vz) < 7);
});
test("fuses: all four thrown grenades resolve, disappear from flight, and never detonate twice", () => {
  for (const kind of Object.keys(UTILITY)) {
    const { game, a, events } = fixture();
    game.phase = "live";
    a.grenades[kind] = 1;
    game.throwGrenade(a, kind, false, 2000);
    for (let i = 1; i < 360; i++) game.updateUtilities(2000 + (i * 1000) / 60, 1 / 60);
    assert.equal(game.projectiles.length, 0, kind);
    assert.equal(events.filter((e) => e.type === "detonate" && e.kind === kind).length, 1, kind);
  }
});
