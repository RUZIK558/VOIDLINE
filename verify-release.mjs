import * as asar from "@electron/asar";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { pathToFileURL } from "node:url";
const roots = [
  "electron.cjs",
  "server.mjs",
  "net-session.mjs",
  "preload.cjs",
  "host-controller.mjs",
  "p2p.mjs",
  "README.md",
  "match.mjs",
  "profile-store.mjs",
  "settings-store.mjs",
  "display-controller.mjs",
  "build/native/display.ps1",
];
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
    );
}
const files = [...roots, ...walk("public")];
for (const platform of ["linux", "win"]) {
  const archive = `dist/${platform}-unpacked/resources/app.asar`;
  assert.equal(
    JSON.parse(asar.extractFile(archive, "package.json")).version,
    "0.10.1",
  );
  for (const f of files)
    assert.ok(
      asar.extractFile(archive, f).equals(fs.readFileSync(f)),
      `${platform} differs: ${f}`,
    );
  console.log(
    `${platform}: version 0.10.1 and ${files.length} application files match final source`,
  );
}
const dest = "/data/voidline-v0101-packaged-smoke";
fs.rmSync(dest, { recursive: true, force: true });
asar.extractAll("dist/linux-unpacked/resources/app.asar", dest);
const { startServer } = await import(
  pathToFileURL(path.join(dest, "server.mjs"))
);
const server = await startServer({
  port: 0,
  host: "127.0.0.1",
  rules: { buyMs: 100 },
});
let ws;
try {
  await server.createMatch({ bots: [0, 0], mode:"events" });
  for (const route of [
    "/",
    "/game.mjs",
    "/round-events.mjs",
    "/slot-cycle.mjs",
    "/input-policy.mjs",
    "/pointer-capture.mjs",
    "/utilities.mjs",
    "/cosmetics.mjs",
    "/inventory-ui.mjs",
    "/settings-ui.mjs",
    "/settings-schema.mjs",
    "/utility-fx.mjs",
    "/assets/kestrel-rig.glb",
    "/vendor/three.module.js",
  ]) {
    const res = await fetch(`http://127.0.0.1:${server.port}${route}`);
    assert.equal(res.status, 200, route);
    assert.ok((await res.text()).length > 50);
  }
  console.log("Extracted package: 14 HTTP routes returned 200");
  ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("packaged WS timeout")), 6000);
    let id;
    ws.on("error", reject);
    ws.on("open", () =>
      ws.send(
        JSON.stringify({
          type: "join",
          name: "RELEASE-QA",
          loadout: { rifle: "cobalt", pistol: "circuit" },
        }),
      ),
    );
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.type === "welcome") id = m.id;
      if (m.type === "state" && m.phase === "live") {
        const p = m.players.find((p) => p.id === id);
        if (p?.alive) {
          assert.equal(m.mode,"events");assert.notEqual(m.roundEvent.id,"standard");
          assert.equal(p.maxHp,m.roundEvent.hp);assert.equal(p.hp,p.maxHp);
          for(const id of ["butterfly","karambit","m9"])assert.ok(p.inventory.includes(id));
          if(!m.roundEvent.guns || m.roundEvent.guns.includes("pistol"))assert.equal(p.skins.pistol,"circuit");
          clearTimeout(timer);
          resolve();
        }
      }
    });
  });
  console.log(
    "Extracted package: real WebSocket join, live event, HP, three knives and applicable Circuit skin PASS",
  );
} finally {
  ws?.terminate();
  server.close();
}
