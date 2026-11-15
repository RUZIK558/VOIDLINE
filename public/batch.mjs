import * as THREE from "/vendor/three.module.js";
import { mergeGeometries } from "./geometry-utils.mjs";
// Only direct, static meshes are merged; characters and weapons remain animated groups.
export function batchStatic(scene) {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const object of [...scene.children]) {
    if (!object.isMesh || Array.isArray(object.material)) continue;
    const key = object.material.uuid + ":" + object.castShadow;
    let batch = groups.get(key);
    if (!batch)
      groups.set(
        key,
        (batch = { material: object.material, shadow: object.castShadow, items: [] }),
      );
    batch.items.push(object);
  }
  for (const batch of groups.values()) {
    if (batch.items.length < 2) continue;
    const geometries = batch.items.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      return g;
    });
    const geometry = mergeGeometries(geometries, false);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.castShadow = batch.shadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
      for (const object of batch.items) {
        scene.remove(object);
        object.geometry.dispose();
      }
    }
    for (const g of geometries) g.dispose();
  }
}
