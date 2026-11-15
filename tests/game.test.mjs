import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startServer } from "../server.mjs";
import { blocked, move, rayBox, direction } from "./legacy-fixture.mjs";
test("collision prevents walking through cover", () => {
  assert.equal(blocked(0, 0), true);
  assert.equal(blocked(0, 20), false);
  const p = { x: 0, z: 2.1 };
  move(p, 0, -0.5);
  // Substepped movement advances to the wall, but must not penetrate it.
  assert.ok(p.z <= 2.1 && p.z >= 1.86);
  assert.equal(blocked(p.x,p.z),false);
});
test("ray hits front surface and misses parallel geometry", () => {
  assert.equal(rayBox([0, 1, 5], [0, 0, -1], [-1, 0, -1], [1, 2, 1]), 4);
  assert.equal(rayBox([5, 1, 5], [0, 0, -1], [-1, 0, -1], [1, 2, 1]), Infinity);
  assert.deepEqual(direction(0, 0), [-0, 0, -1]);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
test("HTTP client, two real players, bots, rounds and authoritative state", async () => {
  const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 3500 } });
  let a, b;
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /VOIDLINE/);
    assert.equal(
      (await fetch(`http://127.0.0.1:${server.port}/vendor/three.module.js`)).status,
      200,
    );
    const join = async (name) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
      ws.states = [];
      ws.on("message", (buf) => {
        const m = JSON.parse(buf);
        if (m.type === "welcome") ws.id = m.id;
        if (m.type === "state") ws.states.push(m);
      });
      await new Promise((r) => ws.once("open", r));
      ws.send(JSON.stringify({ type: "join", name }));
      return ws;
    };
    a = await join("ALPHA");
    await wait(100);
    b = await join("BRAVO");
    await wait(120);
    let s = a.states.at(-1);
    assert.equal(s.players.filter((p) => !p.bot).length, 2);
    assert.equal(s.players.length, 4);
    assert.equal(s.phase, "freeze");
    assert.notEqual(
      s.players.find((p) => p.id === a.id).team,
      s.players.find((p) => p.id === b.id).team,
    );
    a.send(JSON.stringify({ type: "input", yaw: "bad", pitch: null, forward: 9999, hp: 9999 }));
    await wait(3600);
    s = a.states.at(-1);
    assert.equal(s.phase, "live");
    assert.ok(s.players.every((p) => Number.isFinite(p.x) && p.hp <= 100));
    let p = s.players.find((p) => p.id === a.id),
      before = p.z;
    const timer = setInterval(
      () =>
        a.send(
          JSON.stringify({ type: "input", yaw: 0, pitch: 0, forward: 1, side: 0, fire: true }),
        ),
      16,
    );
    await wait(500);
    clearInterval(timer);
    s = a.states.at(-1);
    p = s.players.find((p) => p.id === a.id);
    assert.ok(p.z < before);
    assert.ok(p.ammo < 24);
    a.send(JSON.stringify({ type: "input", yaw: 0, pitch: 0, forward: 0, reload: true }));
    await wait(2400);
    p = a.states.at(-1).players.find((p) => p.id === a.id);
    assert.equal(p.ammo, 12);
    assert.ok(p.reserve < 24);
    a.send(JSON.stringify({ type: "input", yaw: 0, pitch: 0, weapon: "pistol" }));
    await wait(100);
    p = a.states.at(-1).players.find((p) => p.id === a.id);
    assert.equal(p.weapon, "pistol");
    assert.equal(p.ammo, 12);
    assert.ok(s.players.every((p) => !blocked(p.x, p.z)));
  } finally {
    a?.close();
    b?.close();
    server.close();
  }
});
