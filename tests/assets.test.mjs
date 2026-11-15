import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
function glb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const size = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + size).toString());
}
for (const [file, expected, bones] of [
  ["kestrel-rig.glb", ["idle", "walk", "crouch", "jump"], 15],
  ["rifle-view-rig.glb", ["reload", "equip", "inspect", "fire"], 34],
  ["pistol-view-rig.glb", ["reload", "equip", "inspect", "fire"], 34],
])
  test(
    "GLB asset " + file + ": skeleton, animation, UV and embedded PBR maps",
    async () => {
      const data = glb(
        await readFile(new URL("../public/assets/" + file, import.meta.url)),
      );
      assert.ok(data.skins.length >= 3);
      assert.equal(data.skins[0].joints.length, bones);
      assert.deepEqual(
        data.animations.map((a) => a.name),
        expected,
      );
      for (const mesh of data.meshes)
        for (const p of mesh.primitives) {
          assert.notEqual(p.attributes.TEXCOORD_0, undefined);
          if (p.attributes.JOINTS_0 !== undefined)
            assert.notEqual(p.attributes.WEIGHTS_0, undefined);
        }
      assert.ok(
        data.materials.some(
          (m) =>
            m.normalTexture &&
            m.pbrMetallicRoughness?.baseColorTexture &&
            m.pbrMetallicRoughness?.metallicRoughnessTexture,
        ),
      );
      assert.ok(data.images.length > 0);
      for (const image of data.images) {
        assert.notEqual(image.bufferView, undefined);
        assert.equal(image.mimeType, "image/png");
      }
      for (const a of data.animations) assert.ok(a.channels.length > 10);
    },
  );
test("operator atlas albedo / normal / roughness are local 1024px textures", async () => {
  for (const name of ["albedo", "normal", "roughness"]) {
    const b = await readFile(
      new URL("../public/assets/operator-" + name + ".png", import.meta.url),
    );
    assert.equal(b.toString("ascii", 1, 4), "PNG");
    assert.equal(b.readUInt32BE(16), 1024);
    assert.equal(b.readUInt32BE(20), 1024);
  }
});
