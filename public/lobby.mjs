import { batchStatic } from "./batch.mjs";
import * as THREE from "/vendor/three.module.js";
import { buildOperator } from "./models.mjs";
export function createLobby() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c8d6d9");
  scene.fog = new THREE.Fog("#d6d2bd", 10, 45);
  scene.add(new THREE.HemisphereLight("#e3f4ff", "#9c8864", 2.5));
  const sun = new THREE.DirectionalLight("#fff0d5", 4.1);
  sun.position.set(-6, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 1,
    far: 45,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(
    36,
    innerWidth / innerHeight,
    0.1,
    70,
  );
  camera.position.set(0.3, 1.27, 4.2);
  camera.lookAt(0.3, 1, 0);
  function plaster(color) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    let seed = 44;
    for (let i = 0; i < 12000; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256,
        y = Math.floor(seed / 256) % 256;
      ctx.fillStyle = i % 2 ? "#0000000a" : "#ffffff12";
      ctx.fillRect(x, y, 2, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.96 });
  }
  const cream = plaster("#d1c4a8"),
    ochre = plaster("#b7a07d"),
    white = plaster("#ded9c9"),
    road = plaster("#939b98"),
    trim = new THREE.MeshStandardMaterial({
      color: "#666f62",
      roughness: 0.86,
    }),
    metal = new THREE.MeshStandardMaterial({
      color: "#414e4e",
      metalness: 0.5,
      roughness: 0.6,
    });
  const box = (x, y, z, w, h, d, m) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  box(0, -0.13, -5, 15, 0.2, 30, road);
  for (const side of [-1, 1]) {
    box(side * 4, -0.015, -5, 1.6, 0.25, 29, white);
    for (let z = -17; z < 10; z += 0.65)
      box(side * 3.2, 0.04, z, 0.2, 0.28, 0.59, z % 2 > 0 ? cream : white);
  }
  for (let z = -13; z < 5; z += 0.9)
    for (let x = -3; x < 3; x += 1.1) {
      box(x, -0.02, z, 1.08, 0.03, 0.88, road);
    }
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const x = side * (5.8 + (i % 2) * 0.2),
        z = -i * 5 + 1,
        h = 6 + (i % 3) * 1.3;
      box(x, h / 2, z, 3.9, h, 4.8, [cream, ochre, white][i % 3]);
      box(x, h, z, 4.05, 0.15, 4.9, white);
      for (let floor = 0; floor < 3; floor++)
        for (const dz of [-1.25, 1.25]) {
          const y = 1.7 + floor * 1.8;
          box(x - side * 1.98, y, z + dz, 0.08, 1.15, 0.76, trim);
          for (const d of [-0.42, 0.42])
            box(x - side * 2.04, y, z + dz + d, 0.12, 1.3, 0.08, white);
          box(x - side * 2.06, y + 0.65, z + dz, 0.14, 0.08, 0.95, white);
          for (let k = -0.45; k < 0.5; k += 0.15)
            box(x - side * 2.06, y + k, z + dz, 0.09, 0.035, 0.73, metal);
        }
      box(x - side * 2.1, 3.6, z, 0.75, 0.12, 4, white);
      for (let k = -1.8; k < 2; k += 0.35)
        box(x - side * 2.4, 4, z + k, 0.045, 0.8, 0.045, metal);
      box(x - side * 2.4, 4.4, z, 0.05, 0.06, 4, metal);
      box(x - side * 2.08, 1, z, 0.08, 2, 1.15, trim);
      box(x - side * 2.15, 0.5, z, 0.1, 0.05, 1.15, white);
      box(x - side * 2.15, 1, z, 0.1, 0.05, 1.15, white);
      for (let y = 0.2; y < h; y += 0.8)
        box(x - side * 2.03, y, z + 2, 0.07, 0.02, 4.5, ochre);
    }
  // Lamp cables, drain covers and planted street-side greenery.
  for (const z of [-4, -10, -16]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, 5, z),
      new THREE.Vector3(0, 4.5, z),
      new THREE.Vector3(4, 5, z),
    ]);
    scene.add(
      new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.015, 5, false), metal),
    );
    box(0, 4.4, z, 0.45, 0.09, 0.22, metal);
  }
  for (const x of [-2.5, 2.6])
    for (const z of [-3, -11]) {
      box(x, 0.19, z, 0.48, 0.4, 0.48, ochre);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.07, 2.1, 8),
        trim,
      );
      stem.position.set(x, 1.4, z);
      scene.add(stem);
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9,
          leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 1.5, 5),
            new THREE.MeshStandardMaterial({
              color: "#657f4b",
              roughness: 0.9,
            }),
          );
        leaf.position.set(x + Math.sin(a) * 0.45, 2.3, z + Math.cos(a) * 0.45);
        leaf.rotation.set(Math.cos(a) * 1, 0, Math.sin(a) * -1);
        scene.add(leaf);
      }
    }
  batchStatic(scene);
  const operator = buildOperator(0);
  operator.rotation.y = Math.PI - 0.13;
  operator.position.set(0.28, 0.02, 0);
  scene.add(operator);
  return {
    scene,
    camera,
    operator,
    update(t, dt = 1 / 60) {
      operator.userData.update(dt, { speed: 0 });
      operator.rotation.y = Math.PI - 0.13 + Math.sin(t * 0.18) * 0.035;
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
