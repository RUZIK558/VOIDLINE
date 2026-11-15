import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizeSettings,
  rebind,
  actionDown,
  renderSize,
  validKey,
  DEFAULTS,
  ACTIONS,
} from "../public/settings-schema.mjs";
import { createSettingsStore } from "../settings-store.mjs";
import {
  createDisplayController,
  parseXrandr,
} from "../display-controller.mjs";
test("settings normalize finite bounds, enum whitelist and reject prototype/key injection", () => {
  const s = normalizeSettings({
    sensitivity: Infinity,
    handX: 99,
    bob: -4,
    hand: "../../bad",
    shadows: "ultra",
    frameCap: 143,
    bindings: { forward: "Escape", back: "KeyS", left: "KeyS" },
  });
  assert.equal(s.sensitivity, 1);
  assert.equal(s.handX, 0.15);
  assert.equal(s.bob, 0);
  assert.equal(s.hand, "right");
  assert.equal(s.shadows, "medium");
  assert.equal(s.frameCap, 144);
  assert.equal(
    new Set(Object.values(s.bindings)).size,
    Object.keys(ACTIONS).length,
  );
  assert.equal(validKey("Escape"), false);
  assert.equal(validKey("KeyT"), true);
});
test("binding conflict swaps and drives real action state; defaults never mutated", () => {
  const s = rebind(DEFAULTS, "forward", "KeyS");
  assert.equal(s.bindings.back, "KeyW");
  assert.equal(s.bindings.forward, "KeyS");
  assert.equal(DEFAULTS.bindings.forward, "KeyW");
  assert.equal(actionDown({ KeyS: true }, s, "forward"), true);
  assert.equal(actionDown({ KeyW: true }, s, "forward"), false);
  assert.throws(() => rebind(s, "__proto__", "KeyT"));
  assert.throws(() => rebind(s, "reload", "Escape"));
});
test("render resolution and scale produce bounded, deterministic framebuffer sizes", () => {
  const huge=renderSize(normalizeSettings({renderScale:1.5}),7680,4320,2);
  assert.ok(huge.width<=4096&&huge.width*huge.height<=8294400);
  const phone=renderSize(normalizeSettings({renderScale:1.5}),2560,1440,2,2073600);
  assert.ok(phone.width*phone.height<=2073600);
  assert.deepEqual(renderSize(normalizeSettings(null), 1440, 900, 1), {
    width: 1440,
    height: 900,
  });
  assert.deepEqual(
    renderSize(
      normalizeSettings({ renderResolution: "1920x1080", renderScale: 0.75 }),
      800,
      600,
      2,
    ),
    { width: 1440, height: 810 },
  );
  assert.deepEqual(renderSize(normalizeSettings({}), 100, 60, 1), {
    width: 320,
    height: 180,
  });
});
test("settings stored independently from skins, atomic queued saves and corrupt-file fallback", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vl-settings-"));
  try {
    const store = createSettingsStore(dir);
    await writeFile(path.join(dir, "loadout.json"), "untouched");
    await Promise.all([
      store.save({ sensitivity: 2 }),
      store.save({
        ...rebind(DEFAULTS, "reload", "KeyT"),
        hand: "left",
        frameCap: 240,
      }),
    ]);
    const result = await createSettingsStore(dir).load();
    assert.equal(result.hand, "left");
    assert.equal(result.frameCap, 240);
    assert.equal(result.bindings.reload, "KeyT");
    assert.equal(
      await readFile(path.join(dir, "loadout.json"), "utf8"),
      "untouched",
    );
    await assert.rejects(() => store.save(null));
    await writeFile(path.join(dir, "settings.json"), "{");
    assert.equal((await store.load()).hand, "right");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
const query = `DP-1 connected primary 1920x1080+0+0\n   1920x1080  144.00*+ 60.00\n   1280x720 60.00\nHDMI-1 connected 1280x720+1920+0\n   1280x720 75.00*\n`;
test("X11 parser reads primary only and current starred refresh", () => {
  const d = parseXrandr(query);
  assert.equal(d.output, "DP-1");
  assert.equal(d.current.hz, 144);
  assert.equal(d.modes.length, 3);
  assert.equal(
    d.modes.some((m) => m.hz === 75),
    false,
  );
  assert.equal(parseXrandr("DP-1 disconnected").supported, false);
});
test("display controller rejects unadvertised modes and uses argument arrays without shell", async () => {
  const calls = [];
  const execute = async (cmd, args) => {
    calls.push([cmd, args]);
    return { stdout: query };
  };
  const d = createDisplayController({
    platform: "linux",
    env: { DISPLAY: ":1" },
    execute,
  });
  await assert.rejects(() => d.apply({ width: 1920, height: 1080, hz: 999 }));
  await d.apply({ width: 1920, height: 1080, hz: 60 });
  assert.deepEqual(calls.at(-1), [
    "xrandr",
    ["--output", "DP-1", "--mode", "1920x1080", "--rate", "60"],
  ]);
  assert.equal((await d.confirm()).confirmed, true);
  await d.close();
});
test("unconfirmed display mode rolls back; confirmed display mode is retained", async () => {
  let applied = [];
  const execute = async (_, args) => {
    if (args[0] !== "--query") applied.push(args);
    return { stdout: query };
  };
  const d = createDisplayController({
    platform: "linux",
    env: { DISPLAY: ":1" },
    execute,
    timeoutMs: 30,
  });
  await d.apply({ width: 1920, height: 1080, hz: 60 });
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(applied.at(-1).at(-1), "144");
  await d.apply({ width: 1280, height: 720, hz: 60 });
  await d.confirm();
  const count = applied.length;
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(applied.length, count);
  await d.close();
});
test("Wayland and unsupported platforms do not invent monitor refresh support", async () => {
  let ran = false;
  const d = createDisplayController({
    platform: "linux",
    env: { DISPLAY: ":1", WAYLAND_DISPLAY: "wayland-0" },
    execute: () => {
      ran = true;
    },
  });
  assert.equal((await d.info()).supported, false);
  await assert.rejects(() => d.apply({ width: 1920, height: 1080, hz: 144 }));
  assert.equal(ran, false);
});
