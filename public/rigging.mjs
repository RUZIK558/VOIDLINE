import * as THREE from "/vendor/three.module.js";
export function skeletonFrom(spec) {
  const bones = [],
    lookup = {};
  for (const [name, parent, pos] of spec) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...pos);
    if (parent) lookup[parent].add(b);
    bones.push(b);
    lookup[name] = b;
  }
  return { bones, lookup, skeleton: new THREE.Skeleton(bones) };
}
export function bakeSkinned(source, rig, influences) {
  source.updateMatrixWorld(true);
  const buckets = new Map(),
    v = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    nm = new THREE.Matrix3();
  source.traverse((node) => {
    if (!node.isMesh) return;
    const original = node.geometry;
    const geometry = original.index
      ? original.toNonIndexed()
      : original.clone();
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    nm.getNormalMatrix(node.matrixWorld);
    const pos = geometry.attributes.position,
      n = geometry.attributes.normal,
      uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      let mi = 0;
      for (const group of geometry.groups)
        if (i >= group.start && i < group.start + group.count) {
          mi = group.materialIndex;
          break;
        }
      const mat = mats[mi] || mats[0];
      if (!buckets.has(mat))
        buckets.set(mat, { p: [], n: [], uv: [], si: [], sw: [] });
      const b = buckets.get(mat);
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      normal.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      b.p.push(...v);
      b.n.push(...normal);
      b.uv.push(uv?.getX(i) || 0, uv?.getY(i) || 0);
      const weights = influences(node, v, rig.lookup);
      let total = weights.reduce((a, w) => a + w[1], 0);
      for (let j = 0; j < 4; j++) {
        const w = weights[j];
        b.si.push(w ? rig.bones.indexOf(rig.lookup[w[0]]) : 0);
        b.sw.push(w ? w[1] / total : 0);
      }
    }
    geometry.dispose();
  });
  const root = new THREE.Group();
  for (const b of rig.bones) if (!b.parent) root.add(b);
  for (const [material, b] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(b.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(b.sw, 4));
    const mesh = new THREE.SkinnedMesh(g, material);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(rig.skeleton);
    mesh.frustumCulled = false;
  }
  root.userData.rig = rig;
  return root;
}
export function atlasUV(g, tile = 0) {
  g.computeBoundingBox();
  const box = g.boundingBox,
    size = box.getSize(new THREE.Vector3()),
    p = g.attributes.position,
    n = g.attributes.normal;
  const uv = [];
  for (let i = 0; i < p.count; i++) {
    const a = Math.abs(n.getX(i)),
      b = Math.abs(n.getY(i)),
      c = Math.abs(n.getZ(i));
    let u, v;
    if (a > b && a > c) {
      u = (p.getZ(i) - box.min.z) / (size.z || 1);
      v = (p.getY(i) - box.min.y) / (size.y || 1);
    } else if (b > c) {
      u = (p.getX(i) - box.min.x) / (size.x || 1);
      v = (p.getZ(i) - box.min.z) / (size.z || 1);
    } else {
      u = (p.getX(i) - box.min.x) / (size.x || 1);
      v = (p.getY(i) - box.min.y) / (size.y || 1);
    }
    uv.push(
      ((tile % 4) + 0.04 + 0.92 * u) / 4,
      (Math.floor(tile / 4) + 0.04 + 0.92 * v) / 4,
    );
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
export const smooth = (a, b, t) => {
  t = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function clip(name, seconds, tracks) {
  return new THREE.AnimationClip(
    name,
    seconds,
    tracks.map(([path, times, values, size = 1]) =>
      size === 3
        ? new THREE.VectorKeyframeTrack(
            path,
            times.map((t) => t * seconds),
            values,
          )
        : new THREE.NumberKeyframeTrack(
            path,
            times.map((t) => t * seconds),
            values,
          ),
    ),
  );
}
