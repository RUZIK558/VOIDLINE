import * as THREE from "/vendor/three.module.js";
import { SKINS, validSkin } from "./cosmetics.mjs";
const cache = new Map();
export function skinMaterials(id) {
  if (!validSkin(id)) id = "standard";
  if (cache.has(id)) return cache.get(id);
  const s = SKINS[id],
    c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = s.colors[0];
  x.fillRect(0, 0, 256, 256);
  let seed = 173;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  if (s.pattern === "camo")
    for (let i = 0; i < 70; i++) {
      x.fillStyle = s.colors[1 + (i % 2)];
      x.beginPath();
      let px = rnd() * 256,
        py = rnd() * 256;
      for (let j = 0; j < 6; j++)
        x.lineTo(px + Math.sin(j) * 20 * (1 + rnd()), py + Math.cos(j) * 20 * (1 + rnd()));
      x.fill();
    }
  if (s.pattern === "diagonal")
    for (let i = -256; i < 512; i += 44) {
      x.fillStyle = s.colors[1];
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 16, 0);
      x.lineTo(i + 272, 256);
      x.lineTo(i + 256, 256);
      x.fill();
      x.strokeStyle = s.colors[2];
      x.beginPath();
      x.moveTo(i + 24, 0);
      x.lineTo(i + 280, 256);
      x.stroke();
    }
  if (s.pattern === "circuit") {
    x.strokeStyle = s.colors[1];
    x.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = rnd() * 256,
        b = rnd() * 256;
      x.beginPath();
      x.moveTo(a, b);
      x.lineTo(a + 32, b);
      x.lineTo(a + 32, b + 32);
      x.lineTo(a + 64, b + 32);
      x.stroke();
      x.fillStyle = s.colors[2];
      x.fillRect(a - 2, b - 2, 5, 5);
    }
  }
  if (s.pattern === "weave")
    for (let a = 0; a < 256; a += 8)
      for (let b = 0; b < 256; b += 8) {
        x.fillStyle = s.colors[(a / 8 + b / 8) % 2 ? 1 : 0];
        x.fillRect(a, b, 7, 7);
        x.fillStyle = s.colors[2];
        x.fillRect(a, b, 1, 6);
      }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);
  const rough = document.createElement("canvas");
  rough.width = rough.height = 128;
  const r = rough.getContext("2d");
  r.fillStyle = "#bbb";
  r.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    r.fillStyle = rnd() > 0.5 ? "#999" : "#eee";
    r.fillRect(rnd() * 128, rnd() * 128, 1, 1);
  }
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(5, 5);
  const body = new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: s.roughness,
    metalness: s.metalness,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: s.colors[2],
    roughness: s.roughness * 0.85,
    metalness: s.metalness,
  });
  const result = { body, trim };
  cache.set(id, result);
  return result;
}
export function applyWeaponSkin(weapon, id = "standard") {
  if (!weapon || weapon.userData.skin === id) return;
  const mat = id === "standard" ? weapon.userData.factory : skinMaterials(id);
  if (!mat) return;
  weapon.traverse((o) => {
    if (o.isMesh && o.userData.paintRole) o.material = mat[o.userData.paintRole];
  });
  weapon.userData.skin = id;
}
