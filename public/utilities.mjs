import { BOXES, clamp, wallDistance, direction, boxBase, boxTop } from "./shared.mjs";
export const UTILITY = Object.freeze({
  he: { name: "HE / Осколочная", price: 300, max: 1, fuse: 1600, color: "#8b9b50", radius: 7.5 },
  flash: {
    name: "FLASH / Светошумовая",
    price: 200,
    max: 2,
    fuse: 1400,
    color: "#c9e0e3",
    radius: 16,
  },
  smoke: {
    name: "SMOKE / Дымовая",
    price: 300,
    max: 1,
    fuse: 1800,
    color: "#7e9faf",
    radius: 3.6,
    duration: 14000,
  },
  fire: {
    name: "FIRE / Зажигательная",
    price: 400,
    max: 1,
    fuse: 2200,
    color: "#dc803e",
    radius: 3.2,
    duration: 6500,
  },
});
export const validUtility = (k) => typeof k === "string" && Object.hasOwn(UTILITY, k);
export const utilityCount = (p) => Object.values(p.grenades || {}).reduce((a, b) => a + b, 0);
const R = 0.095;
function sweepBox(o, v, b) {
  const min = [b[0] - b[2] / 2 - R, boxBase(b) - R, b[1] - b[3] / 2 - R],
    max = [b[0] + b[2] / 2 + R, boxTop(b) + R, b[1] + b[3] / 2 + R];
  let near = 0,
    far = 1,
    normal = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(v[i]) < 1e-10) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    let a = (min[i] - o[i]) / v[i],
      c = (max[i] - o[i]) / v[i],
      sign = -1;
    if (a > c) {
      [a, c] = [c, a];
      sign = 1;
    }
    if (a >= near) {
      near = a;
      normal = [0, 0, 0];
      normal[i] = sign;
    }
    far = Math.min(far, c);
    if (near > far) return null;
  }
  return near >= 0 && near <= 1 && normal.some(Boolean) ? { t: near, normal } : null;
}
export function advanceGrenade(g, dt, boxes = BOXES) {
  let collisions = 0;
  g.onGround = false;
  const n = Math.max(1, Math.ceil(dt / (1 / 120))),
    step = dt / n;
  for (let j = 0; j < n; j++) {
    if (g.sleeping) {
      g.onGround = true;
      break;
    }
    g.vy -= 12 * step;
    let remain = step;
    for (let bounce = 0; bounce < 4 && remain > 1e-5; bounce++) {
      const o = [g.x, g.y, g.z],
        v = [g.vx * remain, g.vy * remain, g.vz * remain];
      let hit = null;
      if (v[1] < 0 && o[1] + v[1] < R)
        hit = { t: clamp((R - o[1]) / v[1], 0, 1), normal: [0, 1, 0] };
      for (const b of boxes) {
        const h = sweepBox(o, v, b);
        if (h && (!hit || h.t < hit.t)) hit = h;
      }
      if (!hit) {
        g.x += v[0];
        g.y += v[1];
        g.z += v[2];
        break;
      }
      const normal = hit.normal;
      g.x += v[0] * hit.t + normal[0] * 0.002;
      g.y += v[1] * hit.t + normal[1] * 0.002;
      g.z += v[2] * hit.t + normal[2] * 0.002;
      const vel = [g.vx, g.vy, g.vz],
        dot = vel.reduce((s, x, i) => s + x * normal[i], 0);
      for (let i = 0; i < 3; i++)
        vel[i] = (vel[i] - 1.45 * dot * normal[i]) * (normal[i] === 0 ? 0.79 : 1);
      [g.vx, g.vy, g.vz] = vel;
      g.lastNormal = normal;
      collisions++;
      remain *= 1 - hit.t;
      if (normal[1] > 0.5) {
        g.onGround = true;
        if (Math.abs(g.vy) < 0.65 && Math.hypot(g.vx, g.vz) < 0.55) {
          g.vx = g.vy = g.vz = 0;
          g.sleeping = true;
          break;
        }
      }
    }
  }
  return collisions;
}
export function lineVisible(a, b, boxes = BOXES) {
  const d = b.map((x, i) => x - a[i]),
    l = Math.hypot(...d);
  return (
    l < 0.02 ||
    wallDistance(
      a,
      d.map((x) => x / l), boxes,
    ) >=
      l - 0.025
  );
}
export function smokeBlocks(zones, o, d, max = Infinity) {
  for (const z of zones)
    if (z.kind === "smoke") {
      const v = [o[0] - z.x, o[1] - (z.y + 1.2), o[2] - z.z],
        b = v.reduce((s, x, i) => s + x * d[i], 0),
        c = v.reduce((s, x) => s + x * x, 0) - z.radius * z.radius;
      if (c < 0) return true;
      const h = b * b - c;
      if (h >= 0) {
        const t = -b - Math.sqrt(h);
        if (t >= 0 && t < max) return true;
      }
    }
  return false;
}
export function flashPower(p, g, boxes = BOXES) {
  const eye = [p.x, p.y, p.z],
    v = [g.x - p.x, g.y - p.y, g.z - p.z],
    dist = Math.hypot(...v);
  if (dist > 16 || !lineVisible([g.x, g.y, g.z], eye, boxes)) return 0;
  const f = direction(p.yaw, p.pitch),
    dot = dist < 0.01 ? 1 : f.reduce((s, x, i) => s + (x * v[i]) / dist, 0);
  return clamp(Math.min(1, (16 - dist) / 10) * (0.22 + 0.78 * Math.max(0, dot)), 0, 1);
}
export function floorAt(x, z, boxes = BOXES, maxY=Infinity) {
  let h = 0;
  for (const b of boxes)
    if (boxTop(b)<=maxY+.001&&Math.abs(x - b[0]) < b[2] / 2 && Math.abs(z - b[1]) < b[3] / 2) h = Math.max(h, boxTop(b));
  return h;
}
export function fireCells(g, boxes = BOXES) {
  const cells = [],
    base = Math.max(0, g.y - R);
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      if (Math.hypot(x, z) > 3.2) continue;
      const px = g.x + x,
        pz = g.z + z,
        h = floorAt(px, pz, boxes,base+.45);
      if (Math.abs(h - base) > 0.45 || !lineVisible([g.x, base + 0.2, g.z], [px, h + 0.2, pz], boxes))
        continue;
      cells.push({ x: px, y: h + 0.03, z: pz });
    }
  return cells;
}
