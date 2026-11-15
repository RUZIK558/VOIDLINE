import { test } from "node:test";
import assert from "node:assert/strict";
import { recoilFor, shotSpread } from "../public/shared.mjs";
test("Shooting: recoil grows, horizontal spray is patterned, moving and airborne shots lose accuracy", () => {
  assert.equal(recoilFor("rifle", 0).pitch, 0);
  assert.ok(recoilFor("rifle", 10).pitch > recoilFor("rifle", 3).pitch);
  assert.notEqual(recoilFor("rifle", 7).yaw, recoilFor("rifle", 13).yaw);
  assert.deepEqual(recoilFor("rifle", 7), recoilFor("rifle", 7));
  const standing = shotSpread("rifle");
  assert.ok(shotSpread("rifle", { movement: 1 }) > standing);
  assert.ok(shotSpread("rifle", { airborne: true }) > shotSpread("rifle", { movement: 1 }));
});

import { startServer } from "../server.mjs";
import { WebSocket } from "ws";
test("Pistol is semi-automatic: holding fire consumes one round, a new press consumes another", async () => {
  const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 3500 } });
  await server.createMatch({ bots: [0, 0] });
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  let latest, id;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn) => {
    for (let i = 0; i < 250; i++) {
      if (fn()) return;
      await wait(20);
    }
    throw Error("state timeout");
  };
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "welcome") id = m.id;
    if (m.type === "state") latest = m;
  });
  try {
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ type: "join", name: "SEMI-TEST" }));
    await until(() => latest?.phase === "live");
    ws.send(JSON.stringify({ type: "input", yaw: 0, pitch: 0, weapon: "pistol", fire: true }));
    await until(() => latest.players.find((p) => p.id === id)?.ammo === 11);
    const timer = setInterval(
      () => ws.send(JSON.stringify({ type: "input", yaw: 0, pitch: 0, fire: true })),
      80,
    );
    await wait(700);
    clearInterval(timer);
    assert.equal(latest.players.find((p) => p.id === id).ammo, 11);
    ws.send(JSON.stringify({ type: "input", fire: false }));
    await wait(40);
    ws.send(JSON.stringify({ type: "input", fire: true }));
    await until(() => latest.players.find((p) => p.id === id).ammo === 10);
  } finally {
    ws.terminate();
    server.close();
  }
});
