import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {normalizeProfile} from "../public/cosmetics.mjs";
import { createProfileStore } from "../profile-store.mjs";
test("profile persists in a stable directory across sessions and concurrent saves are atomic", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voidline-profile-"));
  try {
    const store = createProfileStore(dir);
    assert.equal((await store.load()).loadout.rifle, "standard");
    await Promise.all([
      store.save({ loadout: { rifle: "cobalt", pistol: "arctic" } }),
      store.save({ loadout: { rifle: "carbon", pistol: "circuit" } }),
    ]);
    const reopened = createProfileStore(dir);
    assert.deepEqual((await reopened.load()).loadout, normalizeProfile({loadout:{ rifle: "carbon", pistol: "circuit" }}).loadout);
    assert.equal(JSON.parse(await readFile(path.join(dir, "loadout.json"), "utf8")).version, 2);
    await assert.rejects(() => store.save({ loadout: { rifle: "constructor", pistol: "arctic" } }));
    assert.equal((await reopened.load()).loadout.rifle, "carbon");
    await writeFile(path.join(dir, "loadout.json"), "{ corrupt");
    assert.equal((await reopened.load()).loadout.rifle, "standard");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
