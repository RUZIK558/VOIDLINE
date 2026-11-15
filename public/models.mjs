import {buildKnife,buildKnifeView} from "./knives.mjs";
import * as THREE from "/vendor/three.module.js";
import {WEAPONS,weaponBase} from "./shared.mjs";
import {
  skeletonFrom,
  bakeSkinned,
  atlasUV,
  smooth,
  clip,
} from "./rigging.mjs";
const ownedMaterial = m => {m.userData.instanceOwned=true;return m;};
const material = (color, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
let cached;
const teamFabrics=new Map();
function operatorFabrics(side){
 if(!teamFabrics.has(side)){
  const base=fabrics(), m={...base};
  const colors=side===0?{cloth:"#476d9c",armor:"#24354f",tan:"#456b96",strap:"#273d54"}:{cloth:"#c6a275",armor:"#6d4d30",tan:"#b8874e",strap:"#74573c"};
  for(const [key,color] of Object.entries(colors)){m[key]=base[key].clone();m[key].color.set(color);}
  teamFabrics.set(side,m);
 }return teamFabrics.get(side);
}
function fabrics() {
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#59644b";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 142;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 340; i++) {
    ctx.fillStyle = ["#394a3c", "#7a7a54", "#2d3830", "#95876b"][i % 4];
    ctx.beginPath();
    const x = r() * 512,
      y = r() * 512;
    for (let a = 0; a < 9; a++) {
      const t = (a * Math.PI) / 4.5,
        rad = 8 + r() * 34;
      ctx.lineTo(x + Math.sin(t) * rad, y + Math.cos(t) * rad);
    }
    ctx.fill();
  }
  for (let i = 0; i < 23000; i++) {
    ctx.fillStyle = `rgba(10,14,10,${r() * 0.15})`;
    ctx.fillRect(r() * 512, r() * 512, 1, 2);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const loader = new THREE.TextureLoader();
  const atlas = loader.load("./assets/operator-albedo.png");
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const normalMap = loader.load("./assets/operator-normal.png"),
    roughnessMap = loader.load("./assets/operator-roughness.png");
  const textile = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      map: atlas,
      normalMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap,
      roughness: 0.98,
    });
  return (cached = {
    cloth: textile("#bec7b6"),
    armor: textile("#9ba895"),
    strap: material("#8a8160", 0.9),
    black: new THREE.MeshStandardMaterial({
      color: "#303a3c",
      roughness: 0.65,
      metalness: 0.15,
      normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
    }),
    metal: material("#596165", 0.36, 0.8),
    tan: material("#b7a17b", 0.87),
    glass: new THREE.MeshStandardMaterial({
      color: "#36515a",
      metalness: 0.7,
      roughness: 0.18,
    }),
    skin: material("#9b8060", 0.9),
    rubber: material("#222926", 0.98),
  });
}
export function rounded(w, h, d, r = Math.min(w, h, d) * 0.12) {
  const shape = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - r * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: r * 0.4,
    bevelThickness: r,
    curveSegments: 3,
  });
  g.translate(0, 0, -d / 2 + r);
  return atlasUV(g, 2);
}
function mesh(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cube(g, x, y, z, w, h, d, mat) {
  return mesh(g, rounded(w, h, d), mat, x, y, z);
}
function tube(g, a, b, r, mat, r2 = r, segments = 16) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    v = end.clone().sub(start),
    length = v.length();
  let geometry;
  if (mat === fabrics().cloth) {
    const points = [],
      uv = [],
      indices = [],
      rings = 16;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings,
        base = THREE.MathUtils.lerp(r, r2, t),
        fold =
          1 +
          0.025 *
            (Math.sin(t * 21) + 0.3 * Math.sin(t * 39)) *
            Math.exp(-Math.pow((t - 0.7) / 0.25, 2)),
        rad = base * fold;
      for (let k = 0; k <= segments; k++) {
        const angle = (k / segments) * Math.PI * 2,
          bulge = 1 + 0.03 * Math.cos(angle * 4 + t * 7);
        points.push(
          Math.cos(angle) * rad * bulge,
          (t - 0.5) * length,
          Math.sin(angle) * rad * 0.9 * bulge,
        );
        uv.push(k / segments, t);
        if (j < rings && k < segments) {
          const q = j * (segments + 1) + k;
          indices.push(
            q,
            q + segments + 1,
            q + 1,
            q + 1,
            q + segments + 1,
            q + segments + 2,
          );
        }
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  } else geometry = new THREE.CylinderGeometry(r2, r, length, segments);
  const object = mesh(
    g,
    geometry,
    mat,
    ...start.clone().add(end).multiplyScalar(0.5).toArray(),
  );
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    v.normalize(),
  );
  return object;
}
function sphere(g, x, y, z, r, mat, scale = [1, 1, 1]) {
  const m = mesh(g, new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
  m.scale.set(...scale);
  return m;
}
export function buildWeapon(kind = "rifle") {
  if(WEAPONS[kind]?.melee)return buildKnife(kind);
  if (!["rifle","pistol"].includes(kind)) return buildArsenalWeapon(kind);
  const m = fabrics(),
    g = new THREE.Group(),
    pistol = kind === "pistol",
    body = material("#323c40", 0.48, 0.62),
    trim = material("#8d8269", 0.66, 0.35),
    dark = m.black;
  if (!pistol) {
    const profile = new THREE.Shape();
    profile.moveTo(-0.17, -0.025);
    for (const [x, y] of [
      [-0.14, -0.055],
      [0.095, -0.055],
      [0.16, -0.02],
      [0.16, 0.035],
      [0.12, 0.06],
      [-0.13, 0.06],
      [-0.17, 0.03],
    ])
      profile.lineTo(x, y);
    profile.closePath();
    const receiverGeo = new THREE.ExtrudeGeometry(profile, {
      depth: 0.076,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      steps: 1,
    });
    receiverGeo.translate(0, 0, -0.038);
    receiverGeo.rotateY(Math.PI / 2);
    mesh(g, atlasUV(receiverGeo, 2), body, 0, 0, 0);
    cube(g, 0.048, 0.005, -0.015, 0.008, 0.028, 0.09, dark);
    const bolt = cube(g, 0.055, 0.012, 0.005, 0.012, 0.016, 0.045, m.metal);
    bolt.name = "Bolt";
    g.userData.bolt = bolt;
    cube(g, 0, 0.06, -0.18, 0.074, 0.065, 0.31, trim);
    cube(g, 0, 0, -0.26, 0.073, 0.095, 0.26, body);
    tube(g, [0, 0.012, -0.37], [0, 0.012, -0.64], 0.014, m.metal);
    tube(g, [0, 0.012, -0.61], [0, 0.012, -0.69], 0.025, dark);
    tube(g, [0, 0.012, -0.685], [0, 0.012, -0.705], 0.018, m.metal);
    for (let i = 0; i < 9; i++) {
      cube(g, 0, 0.084, -0.29 + i * 0.042, 0.075, 0.017, 0.016, dark);
      for (const side of [-1, 1])
        cube(
          g,
          side * 0.039,
          0.012,
          -0.35 + i * 0.027,
          0.007,
          0.026,
          0.016,
          dark,
        );
    }
    const mag = cube(g, 0, -0.14, -0.035, 0.065, 0.2, 0.083, dark);
    mag.rotation.x = -0.16;
    g.userData.mag = mag;
    for (let i = 0; i < 4; i++)
      cube(mag, 0.033, 0.025 - i * 0.035, 0, 0.004, 0.012, 0.07, m.metal);
    cube(g, 0, -0.12, 0.1, 0.055, 0.15, 0.065, trim).rotation.x = -0.35;
    cube(g, 0, -0.035, 0.19, 0.063, 0.08, 0.15, body);
    cube(g, 0, -0.005, 0.31, 0.08, 0.15, 0.11, dark);
    cube(g, 0, -0.005, 0.365, 0.085, 0.16, 0.025, m.rubber);
    // Reflex optic: open frame and a small projected aiming dot, not a solid box.
    cube(g, 0, 0.112, -0.02, 0.065, 0.025, 0.055, dark);
    for (const s of [-1, 1])
      cube(g, s * 0.026, 0.147, -0.02, 0.008, 0.05, 0.018, m.metal);
    cube(g, 0, 0.174, -0.02, 0.06, 0.008, 0.018, m.metal);
    sphere(
      g,
      0,
      0.146,
      -0.027,
      0.0035,
      ownedMaterial(new THREE.MeshBasicMaterial({ color: "#ff7255" })),
    );
    cube(g, 0.048, -0.005, 0.03, 0.012, 0.027, 0.11, m.metal);
    cube(g, 0.055, 0.022, 0.06, 0.016, 0.013, 0.035, dark);
    for (const z of [-0.1, 0.02, 0.115])
      for (const side of [-1, 1])
        tube(
          g,
          [side * 0.047, 0, z],
          [side * 0.052, 0, z],
          0.007,
          m.metal,
          0.007,
          8,
        );
    const trigger = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.004, 6, 16, Math.PI * 1.65),
      dark,
    );
    trigger.position.set(0, -0.08, 0.06);
    trigger.rotation.y = Math.PI / 2;
    g.add(trigger);
    g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.71);
  } else {
    const slide = cube(g, 0, 0.012, -0.09, 0.074, 0.075, 0.25, body);
    slide.name = "Slide";
    g.userData.slide = slide;
    cube(g, 0.039, 0.026, -0.08, 0.008, 0.026, 0.045, dark);
    tube(g, [0, 0.013, -0.22], [0, 0.013, -0.245], 0.009, dark, 0.009, 18);
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++)
        cube(
          g,
          side * 0.037,
          0.012,
          -0.17 + j * 0.007,
          0.003,
          0.045,
          0.002,
          m.metal,
        );
    cube(g, 0, -0.045, -0.075, 0.064, 0.04, 0.22, trim);
    const grip = cube(g, 0, -0.13, 0.0, 0.062, 0.15, 0.085, dark);
    grip.rotation.x = -0.2;
    g.userData.mag = grip;
    for (let i = 0; i < 9; i++)
      cube(g, 0.038, 0.012, -0.04 + i * 0.009, 0.004, 0.048, 0.003, m.metal);
    tube(g, [0, 0.012, -0.21], [0, 0.012, -0.24], 0.014, m.metal);
    cube(g, 0, 0.056, -0.18, 0.01, 0.015, 0.018, dark);
    cube(g, 0, 0.058, 0.01, 0.045, 0.014, 0.014, dark);
    g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.25);
  }
  // Engraved receiver plate uses an original local texture, not a UI stand-in.
  const plateCanvas = document.createElement("canvas");
  plateCanvas.width = 256;
  plateCanvas.height = 64;
  const ink = plateCanvas.getContext("2d");
  ink.fillStyle = "#333e42";
  ink.fillRect(0, 0, 256, 64);
  ink.fillStyle = "#b6c5c7";
  ink.font = "bold 21px Arial";
  ink.fillText(pistol ? "USP-S" : "M4A4", 10, 27);
  ink.font = "12px monospace";
  ink.fillText("VOIDLINE    //    06", 10, 49);
  const plateMap = new THREE.CanvasTexture(plateCanvas);
  plateMap.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(pistol ? 0.072 : 0.12, 0.028),
    new THREE.MeshStandardMaterial({
      map: plateMap,
      roughness: 0.5,
      metalness: 0.5,
    }),
  );
  plate.position.set(
    pistol ? 0.039 : 0.048,
    pistol ? -0.026 : 0.008,
    pistol ? -0.06 : 0.07,
  );
  plate.rotation.y = Math.PI / 2;
  g.add(plate);
  plate.material.userData.ownedTextures=[plateMap];
  g.userData.privateMaterials=[plate.material];
  g.userData.factory = { body, trim };
  g.traverse((o) => {
    if (o.isMesh) {
      if (o.material === body) o.userData.paintRole = "body";
      if (o.material === trim) o.userData.paintRole = "trim";
    }
  });
  g.userData.skin = "standard";
  g.userData.kind = kind;
  g.userData.magBase = g.userData.mag.position.clone();
  return g;
}
function buildOperatorSource(team = 0) {
  const m = operatorFabrics(team),
    g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  mesh(
    body,
    new THREE.CapsuleGeometry(0.225, 0.28, 6, 16),
    m.cloth,
    0,
    1.25,
    0,
  ).scale.set(1.08, 1, 0.7);
  cube(body, 0, 1.22, -0.15, 0.42, 0.47, 0.11, m.armor);
  cube(body, 0, 1.23, 0.13, 0.39, 0.42, 0.12, m.armor);
  for (const side of [-1, 1]) {
    cube(
      body,
      side * 0.18,
      1.41,
      -0.09,
      0.065,
      0.27,
      0.08,
      m.strap,
    ).rotation.z = side * 0.18;
    cube(body, side * 0.21, 1.24, -0.05, 0.045, 0.35, 0.08, m.strap);
    cube(body, side * 0.25, 0.98, 0.025, 0.12, 0.16, 0.13, m.armor);
  }
  for (let x = -0.13; x <= 0.14; x += 0.13) {
    cube(body, x, 1.16, -0.24, 0.105, 0.19, 0.075, m.armor);
    cube(body, x, 1.24, -0.285, 0.105, 0.03, 0.015, m.strap);
    cube(body, x, 1.31, -0.225, 0.035, 0.05, 0.025, m.black);
  }
  for (let y = 1.1; y < 1.42; y += 0.065)
    cube(body, 0, y, -0.21, 0.35, 0.012, 0.018, m.strap);
  cube(body, 0, 0.94, -0.015, 0.45, 0.065, 0.33, m.black);
  cube(body, 0.03, 0.94, -0.19, 0.075, 0.06, 0.025, m.metal);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 0.93, 0);
    g.add(leg);
    tube(
      leg,
      [0, -0.03, 0],
      [side * 0.025, -0.39, -0.02],
      0.115,
      m.cloth,
      0.105,
    );
    tube(
      leg,
      [side * 0.025, -0.39, -0.02],
      [side * 0.025, -0.79, 0.015],
      0.091,
      m.cloth,
      0.08,
    );
    cube(leg, side * 0.025, -0.43, -0.09, 0.155, 0.18, 0.06, m.tan);
    cube(leg, side * 0.025, -0.43, -0.126, 0.12, 0.12, 0.015, m.armor);
    const boot = mesh(
      leg,
      new THREE.CapsuleGeometry(0.083, 0.105, 8, 20),
      m.rubber,
      side * 0.025,
      -0.82,
      -0.04,
    );
    boot.rotation.x = Math.PI / 2;
    boot.scale.set(1, 1, 0.8);
    const sole = mesh(
      leg,
      new THREE.CapsuleGeometry(0.085, 0.11, 6, 20),
      m.black,
      side * 0.025,
      -0.89,
      -0.04,
    );
    sole.rotation.x = Math.PI / 2;
    sole.scale.set(1.05, 1, 0.18);
    for (let j = 0; j < 4; j++)
      cube(leg, side * 0.025, -0.77, -0.14, 0.09, 0.012, 0.02, m.strap);
    cube(leg, side * 0.09, -0.18, 0.015, 0.11, 0.18, 0.11, m.armor);
    cube(leg, side * 0.095, -0.18, -0.055, 0.12, 0.033, 0.015, m.strap);
    if (side < 0) g.userData.leftLeg = leg;
    else g.userData.rightLeg = leg;
  }
  // Scarf, helmet shell, ballistic goggles, ear protection, mounts and radio mic.
  sphere(body, 0, 1.54, 0, 0.13, m.tan, [1.15, 0.62, 1.1]);
  sphere(body, 0, 1.69, 0, 0.145, m.black, [0.9, 1.12, 0.95]);
  sphere(body, 0, 1.79, 0.005, 0.17, m.armor, [1, 0.65, 1.08]);
  cube(body, 0, 1.77, -0.128, 0.24, 0.055, 0.045, m.tan);
  cube(body, 0, 1.7, -0.139, 0.28, 0.09, 0.045, m.black);
  for (const side of [-1, 1]) {
    cube(body, side * 0.064, 1.705, -0.168, 0.108, 0.055, 0.018, m.glass);
    cube(body, side * 0.064, 1.724, -0.18, 0.086, 0.003, 0.002, m.metal);
  }
  for (let j = 0; j < 6; j++)
    cube(body, -0.045 + j * 0.018, 1.6, -0.189, 0.003, 0.035, 0.003, m.strap);
  sphere(body, 0, 1.6, -0.115, 0.125, m.black, [0.95, 0.65, 0.6]);
  for (const side of [-1, 1]) {
    cube(body, side * 0.16, 1.71, 0.015, 0.065, 0.14, 0.11, m.black);
    cube(body, side * 0.17, 1.79, -0.015, 0.05, 0.055, 0.1, m.tan);
    cube(body, side * 0.13, 1.84, 0.035, 0.035, 0.03, 0.09, m.strap);
  }
  cube(body, 0, 1.87, -0.1, 0.085, 0.055, 0.055, m.tan);
  cube(body, 0, 1.88, -0.135, 0.035, 0.03, 0.02, m.black);
  tube(body, [-0.185, 1.67, -0.015], [-0.15, 1.59, -0.19], 0.008, m.black);
  sphere(body, -0.13, 1.59, -0.2, 0.017, m.black);
  tube(body, [-0.23, 1.42, 0.1], [-0.26, 1.94, 0.12], 0.004, m.black);
  // Defense has a broad ballistic visor; attack has a wrapped scarf silhouette.
  if(team===0) cube(body,0,1.71,-.192,.31,.115,.025,m.glass);
  else {cube(body,0,1.54,.015,.31,.10,.27,m.tan);cube(body,.10,1.42,.16,.13,.20,.045,m.tan);}
  const armStart = body.children.length;
  const accent = ownedMaterial(material(team === 0 ? "#80aab0" : "#d7a571", 0.8));
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.31, 1.4, 0],
      elbow = [side * 0.39, 1.15, -0.08],
      wrist = side < 0 ? [-0.07, 1.18, -0.4] : [0.15, 1.13, -0.16];
    tube(body, shoulder, elbow, 0.102, m.cloth, 0.085);
    tube(body, elbow, wrist, 0.084, m.cloth, 0.065);
    cube(body, side * 0.31, 1.39, -0.07, 0.115, 0.13, 0.035, m.armor);
    cube(body, side * 0.31, 1.4, -0.095, 0.08, 0.045, 0.012, accent);
    sphere(body, ...wrist, 0.075, m.black, [0.8, 1.1, 0.85]);
    for (let j = 0; j < 4; j++)
      tube(
        body,
        [wrist[0] - 0.036 + j * 0.023, wrist[1], wrist[2] - 0.03],
        [wrist[0] - 0.036 + j * 0.023, wrist[1] - 0.043, wrist[2] - 0.072],
        0.013,
        m.black,
      );
  }
  for (const part of body.children.slice(armStart))
    part.userData.armSide = part.position.x < 0 ? "L" : "R";
  const rifle = buildWeapon();
  rifle.position.set(0.08, 1.2, -0.29);
  rifle.rotation.set(-0.12, -0.3, -0.18);
  body.add(rifle);
  g.userData.body = body;
  g.userData.weapon = rifle;
  return g;
}
export function buildViewModel(id) {
  if(WEAPONS[id]?.melee)return buildKnifeView(id,buildHands("knife"));
  const kind = weaponBase(id);
  const root = new THREE.Group(),
    weapon = buildWeapon(id);
  weapon.name = "Weapon";
  weapon.position.set(0.22, -0.22, -0.49);
  weapon.rotation.y = 0.035;
  root.add(weapon);
  if (kind === "rifle") root.position.z = -0.25;
  const hands = buildHands(kind);
  root.add(hands);
  root.userData.hands = hands;
  root.userData.weapon = weapon;
  weapon.userData.mag.name = "Magazine";
  const magBase = weapon.userData.magBase;
  const reload = clip("reload", WEAPONS[id]?.reload || 1.9, [
    [
      "L_Arm.rotation[x]",
      [0, 0.15, 0.35, 0.65, 0.85, 1],
      [0, -0.25, -0.85, -0.6, -0.15, 0],
    ],
    ["L_Arm.rotation[z]", [0, 0.18, 0.38, 0.7, 1], [0, -0.3, -0.6, -0.3, 0]],
    ["R_Arm.rotation[x]", [0, 0.2, 0.7, 1], [0, -0.13, -0.13, 0]],
    ["Weapon.rotation[z]", [0, 0.18, 0.7, 1], [0, -0.28, -0.28, 0]],
    ...Array.from({ length: 5 }, (_, i) => [
      `L_Finger${i}_1.rotation[x]`,
      [0, 0.2, 0.4, 0.65, 0.9, 1],
      [0, 0, -0.55, -0.55, 0, 0],
    ]),
    [
      "Magazine.position[y]",
      [0, 0.2, 0.35, 0.55, 0.72, 1],
      [
        magBase.y,
        magBase.y,
        magBase.y - 0.22,
        magBase.y - 0.22,
        magBase.y,
        magBase.y,
      ],
    ],
  ]);
  const equip = clip("equip", 0.36, [
    ["Weapon.position[y]", [0, 1], [-0.55, -0.22]],
    ["R_Arm.rotation[x]", [0, 1], [-0.35, 0]],
    ["L_Arm.rotation[x]", [0, 1], [-0.35, 0]],
  ]);
  const inspect = clip("inspect", 2.4, [
    ["Weapon.rotation[y]", [0, 0.25, 0.65, 1], [0.035, 0.85, 0.85, 0.035]],
    ["Weapon.rotation[z]", [0, 0.25, 0.65, 1], [0, -0.35, -0.35, 0]],
    ["R_Arm.rotation[z]", [0, 0.25, 0.65, 1], [0, -0.2, -0.2, 0]],
    ["L_Arm.rotation[x]", [0, 0.25, 0.65, 1], [0, -0.65, -0.65, 0]],
  ]);
  const shot = clip("fire", 0.12, [
    ["Weapon.position[z]", [0, 0.25, 1], [-0.49, -0.455, -0.49]],
    ["Weapon.rotation[x]", [0, 0.25, 1], [0, 0.09, 0]],
    ["R_Finger0_1.rotation[x]", [0, 0.25, 1], [0, -0.45, 0]],
    ...(kind === "pistol"
      ? [["Slide.position[z]", [0, 0.25, 1], [-0.09, -0.055, -0.09]]]
      : [["Bolt.position[z]", [0, 0.25, 1], [0.005, 0.035, 0.005]]]),
  ]);
  const mixer = new THREE.AnimationMixer(root),
    actions = {};
  for (const c of [reload, equip, inspect, shot]) {
    const a = mixer.clipAction(c);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    actions[c.name] = a;
  }
  root.userData.animations = {
    mixer,
    actions,
    clips: [reload, equip, inspect, shot],
    play(name) {
      if (!actions[name]) return;
      if (name !== "fire") {
        for (const [k, a] of Object.entries(actions))
          if (k !== "fire") a.stop();
      }
      actions[name].reset().play();
    },
  };
  root.userData.muzzle = weapon.localToWorld(weapon.userData.muzzle.clone());
  return root;
}

export function buildGrenade(kind) {
  const g = new THREE.Group(),
    m = fabrics();
  const colors = {
    he: "#7c9144",
    flash: "#c3d4d7",
    smoke: "#688f9c",
    fire: "#784327",
  };
  const paint = material(colors[kind] || "#777", 0.55, 0.25);
  if (kind === "he")
    mesh(g, new THREE.SphereGeometry(0.09, 12, 10), paint, 0, 0, 0).scale.set(
      1,
      1.15,
      1,
    );
  else if (kind === "fire") {
    mesh(g, new THREE.CylinderGeometry(0.055, 0.065, 0.26, 12), paint, 0, 0, 0);
    mesh(
      g,
      new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10),
      m.tan,
      0,
      0.17,
      0,
    );
  } else
    mesh(g, new THREE.CylinderGeometry(0.065, 0.065, 0.24, 12), paint, 0, 0, 0);
  cube(g, 0, 0.13, 0, 0.09, 0.035, 0.07, m.black);
  cube(g, 0.055, 0.07, 0, 0.025, 0.17, 0.025, m.metal);
  const ring = mesh(
    g,
    new THREE.TorusGeometry(0.032, 0.006, 5, 12),
    m.metal,
    0.04,
    0.16,
    0.01,
  );
  ring.rotation.y = Math.PI / 2;
  cube(g, 0, -0.02, 0.065, 0.07, 0.025, 0.008, m.tan);
  g.userData.kind = kind;
  g.userData.privateMaterials = [paint];
  return g;
}
export function buildUtilityView(kind) {
  const root = new THREE.Group(),
    grenade = buildGrenade(kind),
    hands = buildHands("pistol");
  grenade.name = "Utility";
  grenade.position.set(0.22, -0.23, -0.53);
  root.add(grenade, hands);
  root.userData.hands = hands;
  const throwing = clip("throw", 0.4, [
    ["R_Arm.rotation[x]", [0, 0.15, 0.5, 1], [0, -0.2, 0.5, 0]],
    ["L_Arm.rotation[x]", [0, 0.2, 0.6, 1], [0, -0.35, -0.2, 0]],
  ]);
  const mixer = new THREE.AnimationMixer(root),
    action = mixer.clipAction(throwing);
  action.setLoop(THREE.LoopOnce, 1);
  root.userData.animations = {
    mixer,
    play() {
      action.reset().play();
    },
    update(dt) {
      mixer.update(dt);
      grenade.visible = !action.isRunning() || action.time < 0.1;
    },
  };
  return root;
}

// Original UV-mapped, weighted skeletal operator. Accessories share the same rig.
export function buildOperator(team = 0) {
  const source = buildOperatorSource(team),
    body = source.userData.body;
  body.remove(source.userData.weapon);
  const spec = [
    ["Hips", null, [0, 0.94, 0]],
    ["Spine", "Hips", [0, 0.3, 0]],
    ["Head", "Spine", [0, 0.45, 0]],
  ];
  for (const [side, sign] of [
    ["L", -1],
    ["R", 1],
  ]) {
    spec.push(
      [side + "_Thigh", "Hips", [sign * 0.13, -0.01, 0]],
      [side + "_Shin", side + "_Thigh", [sign * 0.025, -0.39, -0.02]],
      [side + "_Foot", side + "_Shin", [0, -0.4, 0.035]],
      [side + "_Shoulder", "Spine", [sign * 0.31, 0.16, 0]],
      [side + "_Elbow", side + "_Shoulder", [sign * 0.08, -0.25, -0.08]],
      [
        side + "_Wrist",
        side + "_Elbow",
        side === "L" ? [0.32, 0.03, -0.32] : [-0.24, -0.02, -0.08],
      ],
    );
  }
  const rig = skeletonFrom(spec);
  source.traverse((node) => {
    if (node.isMesh)
      atlasUV(
        node.geometry,
        node.material === operatorFabrics(team).cloth
          ? 0
          : node.material === operatorFabrics(team).armor
            ? 4
            : 2,
      );
  });
  const root = bakeSkinned(source, rig, (node, v) => {
    let ancestor = node,
      leg = null,
      side = null;
    while (ancestor && ancestor !== source) {
      if (ancestor === source.userData.leftLeg) leg = "L";
      if (ancestor === source.userData.rightLeg) leg = "R";
      if (ancestor.userData.armSide) side = ancestor.userData.armSide;
      ancestor = ancestor.parent;
    }
    if (leg) {
      if(node.material!==fabrics().cloth){const y=node.getWorldPosition(new THREE.Vector3()).y;return [[leg+(y<.25?'_Foot':y<.62?'_Shin':'_Thigh'),1]];}
      const upper = smooth(0.43, 0.62, v.y),
        foot = 1 - smooth(0.15, 0.26, v.y);
      return [
        [leg + "_Thigh", upper * (1 - foot)],
        [leg + "_Shin", (1 - upper) * (1 - foot)],
        [leg + "_Foot", foot],
      ];
    }
    if (side) {
      const center = node.getWorldPosition(new THREE.Vector3());
      const wrist =
        side === "L"
          ? new THREE.Vector3(-0.07, 1.18, -0.4)
          : new THREE.Vector3(0.15, 1.13, -0.16);
      const d = v.distanceTo(wrist),
        arm = smooth(0.13, 0.32, d),
        hand = 1 - smooth(0.045, 0.12, d);
      return [
        [side + "_Shoulder", arm],
        [side + "_Elbow", (1 - arm) * (1 - hand)],
        [side + "_Wrist", (1 - arm) * hand],
      ];
    }
    if (v.y > 1.54) return [["Head", 1]];
    const w = smooth(0.96, 1.16, v.y);
    return [
      ["Hips", 1 - w],
      ["Spine", w],
    ];
  });
  const attachments = new THREE.Group();
  root.add(attachments);
  const weapon = source.userData.weapon;
  weapon.position.set(0.08, 1.2, -0.29);
  weapon.rotation.set(-0.12, -0.3, -0.18);
  attachments.add(weapon);
  const idle = clip("idle", 3, [
    ["Spine.rotation[x]", [0, 0.5, 1], [0, 0.012, 0]],
    ["Head.rotation[y]", [0, 0.5, 1], [-0.025, 0.025, -0.025]],
  ]);
  const walk = clip("walk", 0.8, [
    ["L_Thigh.rotation[x]", [0, 0.25, 0.5, 0.75, 1], [0.5, 0, -0.5, 0, 0.5]],
    ["R_Thigh.rotation[x]", [0, 0.25, 0.5, 0.75, 1], [-0.5, 0, 0.5, 0, -0.5]],
    ["L_Shin.rotation[x]", [0, 0.25, 0.5, 0.75, 1], [0, -0.6, -0.1, 0, 0]],
    ["R_Shin.rotation[x]", [0, 0.25, 0.5, 0.75, 1], [-0.1, 0, 0, -0.6, -0.1]],
    [
      "Hips.position[y]",
      [0, 0.25, 0.5, 0.75, 1],
      [0.94, 0.965, 0.94, 0.965, 0.94],
    ],
  ]);
  const crouch = clip("crouch", 1, [
    ["Hips.position[y]", [0, 1], [0.28, 0.28]],
    ["L_Thigh.rotation[x]", [0, 1], [1.4, 1.4]],
    ["R_Thigh.rotation[x]", [0, 1], [1.4, 1.4]],
    ["L_Shin.rotation[x]", [0, 1], [-2.65, -2.65]],
    ["R_Shin.rotation[x]", [0, 1], [-2.65, -2.65]],
    ["L_Foot.rotation[x]", [0, 1], [1.25, 1.25]],
    ["R_Foot.rotation[x]", [0, 1], [1.25, 1.25]],
    ["Spine.rotation[x]", [0, 1], [-0.13, -0.13]],
  ]);
  const jump = clip("jump", 1, [
    ["L_Thigh.rotation[x]", [0, 1], [0.35, 0.35]],
    ["R_Thigh.rotation[x]", [0, 1], [-0.2, -0.2]],
    ["L_Shin.rotation[x]", [0, 1], [-0.65, -0.65]],
    ["R_Shin.rotation[x]", [0, 1], [-0.8, -0.8]],
  ]);
  const mixer = new THREE.AnimationMixer(root),
    actions = {
      jump: mixer.clipAction(jump).play(),
      idle: mixer.clipAction(idle).play(),
      walk: mixer.clipAction(walk).play(),
      crouch: mixer.clipAction(crouch).play(),
    };
  actions.walk.weight = actions.crouch.weight = actions.jump.weight = 0;
  Object.assign(root.userData, {
    body: attachments,
    weapon,
    animations: [idle, walk, crouch, jump],
    mixer,
    update(
      dt,
      {
        speed = 0,
        crouching = false,
        airborne = false,
        pitch = 0,
        reload = false,
        shot = 0,
      } = {},
    ) {
      const c = crouching ? 1 : 0,
        w = Math.min(1, speed / 3),
        j = airborne ? 1 : 0;
      actions.jump.weight = j;
      actions.idle.weight = (1 - j) * (1 - c) * (1 - w);
      actions.walk.weight = (1 - j) * (1 - c) * w;
      actions.walk.timeScale = Math.max(0.3, speed / 3.4);
      actions.crouch.weight = (1 - j) * c;
      // Remove last frame's procedural layer BEFORE the mixer evaluates its base pose.
      rig.lookup.Spine.rotation.x -= this.lastSpineOffset || 0;
      rig.lookup.L_Elbow.rotation.x -= this.lastElbowOffset || 0;
      mixer.update(dt);
      this.lastSpineOffset = THREE.MathUtils.clamp(pitch,-1.4,1.4) * .4 - shot * .12;
      this.lastElbowOffset = reload ? -.55 : 0;
      rig.lookup.Spine.rotation.x += this.lastSpineOffset;
      rig.lookup.L_Elbow.rotation.x += this.lastElbowOffset;
      attachments.position.y = THREE.MathUtils.damp(
        attachments.position.y,
        c ? -0.66 : 0,
        14,
        dt,
      );
      attachments.rotation.x = pitch * 0.12;
    },
  });
  source.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  return root;
}
function buildHands(kind) {
  const source = new THREE.Group(),
    m = fabrics(),
    spec = [],
    region = (mesh, bone) => {
      mesh.userData.bone = bone;
      return mesh;
    };
  for (const [side, start, wrist] of [
    ["R", [0.38, -0.54, -0.13], kind === "knife" ? [0.25,-0.20,-0.48] : [0.25, -0.29, -0.43]],
    [
      "L",
      kind === "rifle" ? [-0.1, -0.51, -0.18] : [-0.12, -0.48, -0.12],
      kind === "rifle" ? [0.17, -0.28, -0.73] : kind === "knife" ? [-0.22,-0.38,-0.5] : [0.17, -0.3, -0.46],
    ],
  ]) {
    spec.push(
      [side + "_Arm", null, start],
      [side + "_Hand", side + "_Arm", wrist.map((v, i) => v - start[i])],
    );
    const sleeve = tube(source, start, wrist, 0.057, m.cloth, 0.043, 20);
    sleeve.userData.arm = side;
    sleeve.geometry = atlasUV(sleeve.geometry, side === "R" ? 1 : 4);
    region(
      sphere(source, ...wrist, 0.052, m.black, [0.8, 1, 0.85]),
      side + "_Hand",
    );
    region(
      cube(
        source,
        wrist[0],
        wrist[1] + 0.022,
        wrist[2] + 0.01,
        0.065,
        0.018,
        0.065,
        m.armor,
      ),
      side + "_Hand",
    );
    for (let f = 0; f < 5; f++) {
      const isThumb = f === 4,
        x = wrist[0] + (isThumb ? -0.045 : (f - 1.5) * 0.019),
        y = wrist[1] - 0.012,
        z = wrist[2] - 0.026;
      let previous = side + "_Hand";
      for (let joint = 0; joint < 3; joint++) {
        const name = `${side}_Finger${f}_${joint}`,
          pos =
            joint === 0
              ? [x - wrist[0], y - wrist[1], z - wrist[2]]
              : [0, -0.019, -0.008];
        spec.push([name, previous, pos]);
        previous = name;
        const yy = y - joint * 0.019,
          zz = z - joint * 0.008;
        region(
          tube(
            source,
            [x, yy, zz],
            [x, yy - 0.019, zz - 0.008],
            isThumb ? 0.011 : 0.009,
            m.black,
            0.008,
            10,
          ),
          name,
        );
        if (joint === 0)
          region(
            sphere(source, x, yy, zz, 0.011, m.armor, [1, 0.6, 0.9]),
            name,
          );
      }
    }
  }
  const rig = skeletonFrom(spec);
  const root = bakeSkinned(source, rig, (node, v) => {
    if (node.userData.bone) return [[node.userData.bone, 1]];
    const side = node.userData.arm,
      wrist =
        side === "R"
          ? (kind === "knife" ? new THREE.Vector3(.25,-.20,-.48) : new THREE.Vector3(0.25, -0.29, -0.43))
          : kind === "rifle"
            ? new THREE.Vector3(0.17, -0.28, -0.73)
            : kind === "knife" ? new THREE.Vector3(-.22,-.38,-.5) : new THREE.Vector3(0.17, -0.3, -0.46);
    const hand = 1 - smooth(0.025, 0.11, v.distanceTo(wrist));
    return [
      [side + "_Arm", 1 - hand],
      [side + "_Hand", hand],
    ];
  });
  root.userData.setGloves = (id) => {
    const colors = {
      graphite: "#303a3c",
      sand: "#a69470",
      olive: "#68735a",
      arctic: "#9daeb4",
    };
    root.traverse((o) => {
      if (o.isSkinnedMesh && o.material === m.black) {
        o.material = m.black.clone();
        o.userData.privateMaterials=[o.material];
        o.userData.glove = true;
      }
      if (o.userData.glove) o.material.color.set(colors[id] || colors.graphite);
    });
  };
  source.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  return root;
}

// Original meshes inspired by real weapon silhouettes; no Valve/Axlebolt assets.
function buildArsenalWeapon(kind) {
 const g=new THREE.Group(),m=fabrics(),pistol=weaponBase(kind)==="pistol";
 const body=material(kind==="awp"?"#54694b":"#343c40",.43,.72),trim=material(kind==="ak47"?"#835331":"#4a5151",.65,.15),dark=m.black;
 const b=(x,y,z,w,h,d,mat=body)=>cube(g,x,y,z,w,h,d,mat);
 let mag,bolt;
 if(pistol){
  const heavy=kind==="deagle";bolt=b(0,.015,-.105,heavy?.084:.07,heavy?.085:.065,heavy?.3:.235);bolt.name="Slide";g.userData.slide=bolt;
  b(0,-.035,-.09,.067,.03,.22,trim);mag=b(0,-.105,.015,.064,.17,.075,dark);mag.rotation.x=-.22;
  tube(g,[0,.012,-.22],[0,.012,heavy?-.29:-.24],heavy?.016:.01,m.metal);
  for(const side of [-1,1])for(let i=0;i<7;i++)b(side*.04,.015,-.025+i*.008,.003,.05,.003,dark);
  b(0,.05,-.21,.012,.028,.02,dark);b(0,.05,.02,.043,.026,.012,dark);
  const guard=new THREE.Mesh(new THREE.TorusGeometry(.026,.0035,6,18,Math.PI*1.6),dark);guard.rotation.y=Math.PI/2;guard.position.set(0,-.069,-.07);g.add(guard);
 }else if(kind==="p90"){
  b(0,0,-.05,.10,.15,.47);b(0,-.03,.24,.10,.21,.13,dark);b(0,-.13,.07,.055,.10,.07,dark);b(0,-.12,-.13,.07,.10,.08,trim);
  b(0,.078,-.08,.075,.03,.31,dark);mag=b(0,.11,-.08,.09,.045,.36,trim);tube(g,[0,.015,-.28],[0,.015,-.43],.017,m.metal);
  bolt=b(.055,.015,-.04,.013,.018,.055,m.metal);bolt.name="Bolt";g.userData.bolt=bolt;
 }else{
  const ak=kind==="ak47",sniper=WEAPONS[kind]?.scope,smg=kind==="mp9";
  b(0,0,0,.075,.095,smg?.22:.32);b(0,-.065,.12,.065,.04,.15);b(0,-.14,.13,.055,.15,.065,dark).rotation.x=-.3;
  b(0,-.015,smg?.22:.29,.07,.13,smg?.10:.22,ak?trim:body);b(0,-.015,smg?.28:.4,.08,.15,.022,dark);
  b(0,.01,-.25,.078,sniper?.075:.085,smg?.17:.27,trim);
  const end=sniper?-.85:smg?-.47:-.7;
  tube(g,[0,.017,-.31],[0,.017,end],sniper?.016:.013,m.metal);
  if(kind==="m4a1s")tube(g,[0,.017,-.64],[0,.017,-.88],.026,dark);
  if(ak){tube(g,[0,.055,-.28],[0,.055,-.57],.012,m.metal);b(0,.075,-.58,.032,.07,.024,dark);}
  mag=b(0,-.14,-.03,smg?.045:.062,sniper?.08:.20,smg?.055:.085,dark);mag.rotation.x=ak?-.32:-.12;
  if(ak){
   g.remove(mag);const shape=new THREE.Shape();const outline=[[-.07,-.05],[.015,-.05],[-.005,-.12],[-.04,-.2],[-.09,-.28],[-.16,-.30],[-.19,-.26],[-.13,-.21],[-.09,-.13]];
   outline.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:.058,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.003,bevelThickness:.003});geo.translate(0,0,-.029);geo.rotateY(Math.PI/2);mag=mesh(g,atlasUV(geo,2),dark,0,0,0);
   for(const side of [-1,1])for(let i=0;i<4;i++){const rib=cube(mag,side*.032,-.105-i*.036,-.03-i*.025,.004,.019,.062,m.metal);rib.rotation.x=-.3;}
  }
  // Machined pins, ejection port and trigger guard are geometry, not painted icons.
  for(const side of [-1,1])for(const z of [-.08,.03,.12])tube(g,[side*.038,0,z],[side*.043,0,z],.0045,m.metal,.0045,10);
  b(.041,.018,.015,.004,.023,.07,dark);
  const guard=new THREE.Mesh(new THREE.TorusGeometry(.026,.0035,6,18,Math.PI*1.7),dark);guard.rotation.y=Math.PI/2;guard.position.set(0,-.075,.075);g.add(guard);
  for(let i=0;i<8;i++){b(0,.065,-.26+i*.025,.075,.012,.012,dark);for(const side of [-1,1])b(side*.041,.015,-.32+i*.025,.005,.032,.013,dark);}
  bolt=b(.049,.012,.005,.015,.016,.05,m.metal);bolt.name="Bolt";g.userData.bolt=bolt;
  if(sniper){
   tube(g,[0,.13,-.19],[0,.13,.10],.034,dark);tube(g,[0,.13,-.24],[0,.13,-.17],.053,body);tube(g,[0,.13,.08],[0,.13,.15],.046,dark);
   for(const z of [-.11,.05])b(0,.085,z,.045,.06,.035,dark);
   tube(g,[0,.13,-.245],[0,.13,-.249],.044,m.glass);b(.046,.019,.11,.045,.026,.026,m.metal);
  }else{b(0,.081,.08,.045,.02,.025,dark);b(0,.052,end+.06,.026,.065,.021,dark);}
 }
 g.userData.muzzle=new THREE.Vector3(0,.015,pistol?(kind==="deagle"?-.29:-.24):kind==="p90"?-.43:kind==="mp9"?-.47:kind==="m4a1s"?-.88:WEAPONS[kind]?.scope?-.85:-.7);
 g.userData.mag=mag;g.userData.magBase=mag.position.clone();g.userData.factory={body,trim};g.userData.skin="standard";g.userData.kind=kind;
 g.traverse(o=>{if(o.isMesh){if(o.material===body)o.userData.paintRole="body";if(o.material===trim)o.userData.paintRole="trim";}});
 return g;
}
