import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startServer } from "../server.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, time = 6000) {
  const at = Date.now();
  while (!fn()) {
    if (Date.now() - at > time) throw Error("utility network timeout");
    await sleep(20);
  }
}
async function join(port, name, loadout) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.events = [];
  ws.replies = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "welcome") ws.id = m.id;
    if (m.type === "state") {
      ws.state = m;
      ws.events.push(...m.events);
    }
    if (["cosmetics", "purchase"].includes(m.type)) ws.replies.push(m);
  });
  ws.sendJSON = (m) => ws.send(JSON.stringify(m));
  ws.player = () => ws.state?.players.find((p) => p.id === ws.id);
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  ws.sendJSON({ type: "join", name, loadout });
  await until(() => ws.state);
  return ws;
}
test(
  "real network: skins replicate, persist through drop/capture, profile forgery rejected; HE and smoke have synchronized physics/effects",
  { timeout: 18000 },
  async () => {
    const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 1800 } });
    let a, d, m;
    try {
      await server.createMatch({ bots: [0, 0] });
      a = await join(server.port, "PAINT", { rifle: "ember", pistol: "cobalt" });
      d = await join(server.port, "OTHER", { rifle: "arctic", pistol: "carbon" });
      m = await join(server.port, "CAPTURE", { rifle: "standard", pistol: "standard" });
      await until(() => d.state.players.find((p) => p.id === a.id)?.skins.pistol === "cobalt");
      a.sendJSON({ type: "buy", item: "he" });
      a.sendJSON({ type: "buy", item: "smoke" });
      await until(() => a.player().grenades.smoke === 1);
      assert.equal(a.player().money, 200);
      a.sendJSON({ type: "cosmetics", loadout: { rifle: "constructor", pistol: "cobalt" } });
      await until(() => a.replies.some((r) => r.type === "cosmetics"));
      assert.equal(a.replies.find((r) => r.type === "cosmetics").ok, false);
      a.sendJSON({ type: "input", drop: true });
      await until(() => a.state.drops.length === 1);
      assert.equal(d.state.drops[0].skin, "cobalt");
      m.sendJSON({ type: "input", drop: true });
      await until(() => m.player().weapon === "butterfly");
      await until(() => a.state.phase === "live");
      const moving = setInterval(
        () => m.sendJSON({ type: "input", yaw: Math.PI / 2, forward: 1 }),
        40,
      );
      try {
        await until(() => Math.abs(m.player().x - a.player().x) < 1.0);
      } finally {
        clearInterval(moving);
      }
      m.sendJSON({ type: "input", pickup: true });
      await until(() => m.player().skins.pistol === "cobalt");
      assert.equal(m.player().ammo, 12);
      a.sendJSON({ type: "input", grenade: "he", yaw: 0, pitch: 0.1 });
      await sleep(50);
      a.sendJSON({ type: "input", fire: true, yaw: 0, pitch: 0.1 });
      await until(() => a.state.projectiles.some((g) => g.kind === "he"));
      assert.equal(a.player().grenades.he, 0);
      await until(() => d.events.some((e) => e.type === "detonate" && e.kind === "he"));
      assert.ok(a.events.some((e) => e.type === "bounce"));
      a.sendJSON({ type: "input", fire: false });
      await sleep(50);
      a.sendJSON({ type: "input", grenade: "smoke", yaw: 0, pitch: -0.6 });
      await sleep(50);
      a.sendJSON({ type: "input", altFire: true, yaw: 0, pitch: -0.6 });
      await until(() => a.state.zones.some((z) => z.kind === "smoke"), 6500);
      await until(() => d.state.zones.some((z) => z.kind === "smoke"));
      assert.equal(a.state.zones[0].id, d.state.zones[0].id);
      assert.equal(a.player().grenades.smoke, 0);
    } finally {
      a?.terminate();
      d?.terminate();
      m?.terminate();
      server.close();
    }
  },
);
