import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { WebSocket } from "ws";
import { startServer } from "../server.mjs";
import { createHostController } from "../host-controller.mjs";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 3000) {
  const at = Date.now();
  while (!fn()) {
    if (Date.now() - at > timeout) throw Error("Timed out waiting for state");
    await wait(20);
  }
}
async function freePort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "0.0.0.0", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}
async function join(port, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.latest = null;
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "welcome") ws.id = m.id;
    if (m.type === "state") ws.latest = m;
  });
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  ws.send(JSON.stringify({ type: "join", name }));
  await until(() => ws.id && ws.latest);
  return ws;
}
test("Host can create, add/remove bots, preserve their IDs, enforce limits and reject unsafe commands", async () => {
  const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 3500 } }),
    host = createHostController(server);
  let owner, guest;
  try {
    let r = await host.invoke("create", { bots: [1, 2], level: "easy" });
    assert.equal(r.ok, true);
    assert.equal(r.result.lan, false);
    assert.deepEqual(r.result.botCounts, [1, 2]);
    owner = await join(server.port, "HOST");
    const original = server
      .getStatus()
      .players.filter((p) => p.bot)
      .map((p) => p.id);
    guest = await join(server.port, "GUEST");
    for (const id of original) assert.ok(server.getStatus().players.some((p) => p.id === id));
    const before = server.getStatus().players.length;
    guest.send(JSON.stringify({ type: "bot-add", team: 1 }));
    guest.send(JSON.stringify({ type: "host", command: "bot-clear" }));
    await wait(80);
    assert.equal(server.getStatus().players.length, before);
    r = await host.invoke("bot-add", { team: 0 });
    assert.deepEqual(r.result.botCounts, [2, 2]);
    let bot = r.result.players.find((p) => p.bot && p.team === 0);
    r = await host.invoke("bot-remove", { id: bot.id });
    assert.deepEqual(r.result.botCounts, [1, 2]);
    assert.equal((await host.invoke("bot-remove", { id: owner.id })).ok, false);
    assert.equal((await host.invoke("bot-add", { team: 9 })).ok, false);
    assert.equal((await host.invoke("exec", { command: "anything" })).ok, false);
    assert.equal((await host.invoke("create", { bots: [-1, 2], level: "easy" })).ok, false);
    await host.invoke("bot-add", { team: 0 });
    await host.invoke("bot-add", { team: 0 });
    r = await host.invoke("bot-add", { team: 0 });
    assert.equal(r.ok, true);
    assert.equal((await host.invoke("bot-add", { team: 0 })).ok, false);
    await host.invoke("bot-clear");
    guest.close();
    await wait(100);
    assert.deepEqual(server.getStatus().botCounts, [0, 0]);
    // Forged weapon names must not corrupt server-owned weapon state.
    owner.send(JSON.stringify({ type: "input", weapon: "constructor", fire: true }));
    await wait(100);
    assert.equal(owner.latest.players.find((p) => p.id === owner.id).weapon, "pistol");
  } finally {
    owner?.terminate();
    guest?.terminate();
    server.close();
  }
});
test("LAN opens the SAME match; occupied port is handled; closing LAN kicks guests but not owner; reopen works", async () => {
  const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 3500 } }),
    host = createHostController(server);
  let owner, guest;
  const occupied = net.createServer();
  await new Promise((r) => occupied.listen(0, "0.0.0.0", r));
  const occupiedPort = occupied.address().port;
  try {
    await host.invoke("create", { bots: [1, 2], level: "normal" });
    owner = await join(server.port, "HOST");
    let r = await host.invoke("lan-open", { port: occupiedPort });
    assert.equal(r.ok, false);
    assert.match(r.error, /Порт занят/);
    assert.equal(server.getStatus().lan, false);
    assert.equal((await host.invoke("lan-open", { port: 80 })).ok, false);
    const port = await freePort();
    r = await host.invoke("lan-open", { port });
    assert.equal(r.ok, true);
    assert.equal(r.result.port, port);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
    guest = await join(port, "LAN-GUEST");
    await until(() => owner.latest.players.some((p) => p.id === guest.id));
    assert.equal(guest.latest.round, owner.latest.round);
    const before = owner.latest.round;
    await host.invoke("lan-close");
    await until(() => guest.readyState === WebSocket.CLOSED);
    assert.equal(owner.readyState, WebSocket.OPEN);
    assert.equal(server.getStatus().lan, false);
    assert.equal(owner.latest.round, before);
    r = await host.invoke("lan-open", { port });
    assert.equal(r.ok, true);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
    r = await host.invoke("stop");
    assert.equal(r.ok, true);
    await until(() => owner.readyState === WebSocket.CLOSED);
    assert.equal(server.getStatus().lan, false);
  } finally {
    owner?.terminate();
    guest?.terminate();
    await new Promise((r) => occupied.close(r));
    server.close();
  }
});
test("Bots added in a live round wait for restart, then spawn; restart preserves LAN settings", async () => {
  const server = await startServer({ port: 0, host: "127.0.0.1", rules: { buyMs: 3500 } }),
    host = createHostController(server);
  let owner;
  try {
    await host.invoke("create", { bots: [0, 0], level: "hard" });
    owner = await join(server.port, "HOST");
    await until(() => owner.latest.phase === "live", 5000);
    const r = await host.invoke("bot-add", { team: 1 }),
      bot = r.result.players.find((p) => p.bot);
    await until(() => owner.latest.players.some((p) => p.id === bot.id));
    assert.equal(owner.latest.players.find((p) => p.id === bot.id).alive, false);
    const port = await freePort();
    await host.invoke("lan-open", { port });
    await host.invoke("restart");
    await until(() => owner.latest.phase === "freeze");
    assert.equal(owner.latest.players.find((p) => p.id === bot.id).alive, true);
    assert.equal(server.getStatus().port, port);
    assert.deepEqual(owner.latest.score, [0, 0]);
  } finally {
    owner?.terminate();
    server.close();
  }
});
