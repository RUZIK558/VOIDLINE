import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { createPeerService } from "../p2p.mjs";
async function port() {
  const n = net.createServer();
  await new Promise((r) => n.listen(0, "127.0.0.1", r));
  const p = n.address().port;
  await new Promise((r) => n.close(r));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 80; i++) {
    if (await fn()) return;
    await wait(30);
  }
  throw Error("P2P state timed out");
}
const code = (s) =>
  "VLF1." +
  Buffer.from(
    JSON.stringify({ v: 1, id: s.id, name: s.name, host: "127.0.0.1", port: s.port }),
  ).toString("base64url");
test("Two real TLS peers exchange pinned invitations, encrypted messages, delivery ACKs and persistent history", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "voidline-peers-"));
  let a, b;
  try {
    a = await createPeerService({ directory: path.join(dir, "a") });
    b = await createPeerService({ directory: path.join(dir, "b") });
    let sa = (await a.invoke("open", { port: await port() })).result,
      sb = (await b.invoke("open", { port: await port() })).result;
    assert.ok(sa.id !== sb.id);
    assert.equal((await a.invoke("add", { code: code(sa) })).ok, false);
    assert.equal((await a.invoke("add", { code: "garbage" })).ok, false);
    assert.equal((await a.invoke("add", { code: code(sb) })).ok, true);
    assert.equal((await b.invoke("add", { code: code(sa) })).ok, true);
    assert.equal((await a.invoke("connect", { id: sb.id })).ok, true);
    assert.equal(
      (await a.invoke("send", { id: sb.id, text: "Привет! <script>не HTML</script>" })).ok,
      true,
    );
    await until(async () => {
      const s = (await b.invoke("status")).result;
      return s.friends[0].messages.length === 1;
    });
    await until(
      async () => (await a.invoke("status")).result.friends[0].messages[0].delivery === "delivered",
    );
    assert.equal((await b.invoke("send", { id: sa.id, text: "Ответ через P2P" })).ok, true);
    await until(async () => (await a.invoke("status")).result.friends[0].messages.length === 2);
    assert.equal((await a.invoke("send", { id: sb.id, text: "x".repeat(2001) })).ok, false);
    assert.equal((await a.invoke("status")).result.friends[0].messages[1].text, "Ответ через P2P");
    const identity = sa.id;
    await a.close();
    a = await createPeerService({ directory: path.join(dir, "a") });
    assert.equal((await a.invoke("status")).result.id, identity);
    assert.equal((await a.invoke("status")).result.friends[0].messages.length, 2);
    assert.ok((await readFile(path.join(dir, "a", "social.json"), "utf8")).includes("Привет!"));
    assert.equal((await a.invoke("open", { port: 20 })).ok, false);
  } finally {
    await a?.close();
    await b?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
