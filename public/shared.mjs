import {MAPS} from "./maps.mjs";
export const MAP = MAPS.terminal;
export const BOXES = MAP.boxes;
export const WEAPONS = {
  rifle: {
    name: "VX–4 PHANTOM",
    mag: 24,
    reserve: 120,
    damage: 29,
    delay: 0.115,
    reload: 1.9,
    spread: 0.009,
  },
  pistol: {
    name: "P12 SIDEARM",
    mag: 12,
    reserve: 60,
    damage: 34,
    delay: 0.28,
    reload: 1.3,
    spread: 0.006,
  },
};
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const boxBase = b => b[6] || 0;
export const boxTop = b => boxBase(b) + b[4];
export function supportAt(x,z,boxes=BOXES,maxY=Infinity,r=0){
 let h=0;
 for(const b of boxes)if(boxTop(b)<=maxY+1e-6&&Math.abs(x-b[0])<b[2]/2+r&&Math.abs(z-b[1])<b[3]/2+r)h=Math.max(h,boxTop(b));
 return h;
}
export function blocked(x,z,r=.36,boxes=BOXES,feet=0,height=1.87){
 return boxes.some(b=>Math.abs(x-b[0])<b[2]/2+r&&Math.abs(z-b[1])<b[3]/2+r&&boxTop(b)>feet+.015&&boxBase(b)<feet+height-.015);
}
export function isGrounded(p,boxes=BOXES){
 return Math.abs(feetY(p)-supportAt(p.x,p.z,boxes,feetY(p)+.025,.365))<.035&&(p.vy||0)<=.05;
}
export function move(p,dx,dz,boxes=BOXES){
 // Substeps prevent tunnelling. Only real stair-size rises can be auto-stepped;
 // crates, walls and the undersides of storeys stay solid.
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14)),hasY=Number.isFinite(p.y);
 for(let i=0;i<n;i++)for(const axis of ['x','z']){
  const x=p.x+(axis==='x'?dx/n:0),z=p.z+(axis==='z'?dz/n:0);
  const feet=hasY?feetY(p):0,ground=hasY&&isGrounded(p,boxes);
  const top=supportAt(x,z,boxes,feet+(ground?.27:0),.365);
  const rise=ground&&top>feet+.005&&top<=feet+.27;
  const nextFeet=rise?top:feet;
  if(!blocked(x,z,.36,boxes,nextFeet,hasY?eyeHeight(p)+.22:1.87)){
   p.x=x;p.z=z;if(rise)p.y=nextFeet+eyeHeight(p);
  }
 }
}
export function verticalStep(p,dt,boxes=BOXES,gravity=15){
 const feet=feetY(p),next=feet+(p.vy-gravity*dt)*dt;
 p.vy-=gravity*dt;
 let target=next;
 if(p.vy<=0){const floor=supportAt(p.x,p.z,boxes,feet+.03,.365);if(next<=floor){target=floor;p.vy=0;}}
 else{
  const head=feet+eyeHeight(p)+.22,newHead=next+eyeHeight(p)+.22;
  for(const b of boxes)if(Math.abs(p.x-b[0])<b[2]/2+.34&&Math.abs(p.z-b[1])<b[3]/2+.34&&boxBase(b)>=head-.01&&boxBase(b)<newHead){target=Math.min(target,boxBase(b)-eyeHeight(p)-.22);p.vy=0;}
 }
 p.y=Math.max(0,target)+eyeHeight(p);
}
export function rayBox(o, d, min, max) {
  let near = 0,
    far = 1e6;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < min[i] || o[i] > max[i]) return Infinity;
    } else {
      let a = (min[i] - o[i]) / d[i],
        b = (max[i] - o[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a);
      far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return near;
}
export function wallDistance(o, d, boxes = BOXES) {
  let best = Infinity;
  for (const b of boxes)
    best = Math.min(
      best,
      rayBox(o, d, [b[0] - b[2] / 2, boxBase(b), b[1] - b[3] / 2], [b[0] + b[2] / 2, boxTop(b), b[1] + b[3] / 2]),
    );
  return best;
}
export function direction(yaw, pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

// Deterministic spray: angular offsets in radians, not just camera animation.
export function recoilFor(weapon, heat) {
  if (weapon === "pistol")
    return { pitch: Math.min(heat, 5) * 0.009, yaw: Math.sin(heat * 1.7) * 0.003 };
  const n = clamp(heat, 0, 23) * (WEAPONS[weapon]?.recoil || 1);
  return {
    pitch: Math.min(n, 9) * 0.008 + Math.max(0, n - 9) * 0.0012,
    yaw: n < 4 ? 0 : Math.sin((n - 4) * 0.58) * Math.min(0.027, (n - 4) * 0.0035),
  };
}
export function shotSpread(weapon, { movement = 0, airborne = false, heat = 0, scoped = false } = {}) {
  const base = WEAPONS[weapon]?.scope ? (scoped ? 0.0004 : 0.045) : weapon === "rifle" ? 0.0015 : (WEAPONS[weapon]?.spread || 0.0025);
  return (
    base +
    clamp(movement, 0, 1) * (weapon === "rifle" ? 0.022 : 0.014) +
    (airborne ? 0.065 : 0) +
    Math.min(heat, 20) * 0.00035
  );
}

export const SITES = MAP.sites;
export const SHOP = {
  rifle: { name: "VX–4 PHANTOM", price: 2700 },
  pistol: { name: "P12 SIDEARM", price: 300 },
  ammo: { name: "Боезапас активного оружия", price: 150 },
  armor: { name: "Бронежилет · 100", price: 650 },
  helmet: { name: "Шлем (нужен жилет)", price: 350 },
  kit: { name: "Набор разминирования", price: 400 },
};
export const eyeHeight = (p) => (p.crouch ? 1.05 : 1.65);
export const feetY = (p) => p.y - eyeHeight(p);
export const atSite = (p, sites = SITES) => sites.find((s) => Math.hypot(p.x - s.x, p.z - s.z) <= s.radius);
export function accelerate(p, input, dt, boxes = BOXES) {
  const f = input.forward || 0,
    s = input.side || 0,
    l = Math.max(1, Math.hypot(f, s));
  const speed = (input.crouch ? 1.7 : input.slow ? 2.4 : 5.2) * (p.eventSpeed || 1);
  const tx = ((-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) / l) * speed;
  const tz = ((-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) / l) * speed;
  const step = (v, target) => {
    // Releasing slows down; pressing the opposite direction brakes harder.
    const rate = (!target ? 15 : v * target < 0 ? 65 : 32) * (p.eventAcceleration || 1);
    return v + clamp(target - v, -rate * dt, rate * dt);
  };
  p.vx = step(p.vx || 0, tx);
  p.vz = step(p.vz || 0, tz);
  const x = p.x,
    z = p.z;
  move(p, p.vx * dt, p.vz * dt, boxes);
  if (p.x === x) p.vx = 0;
  if (p.z === z) p.vz = 0;
}
export function hitPlayer(o, d, p) {
  const f = feetY(p),
    h = eyeHeight(p);
  const regions = [
    ["head", 0.19, h - 0.2, h + 0.22],
    ["body", 0.32, h * 0.4, h - 0.2],
    ["legs", 0.25, 0, h * 0.4],
  ];
  let best = { distance: Infinity, region: null };
  for (const [region, r, low, high] of regions) {
    const distance = rayBox(o, d, [p.x - r, f + low, p.z - r], [p.x + r, f + high, p.z + r]);
    if (distance < best.distance) best = { distance, region };
  }
  return best;
}
export function damageFor(p, weapon, region, distance = 0) {
  const raw = Math.round(
    WEAPONS[weapon].damage *
      { head: 4, body: 1, legs: 0.75 }[region] *
      Math.pow(0.985, distance / 5),
  );
  const protectedHit = region === "body" || (region === "head" && p.helmet);
  if (!protectedHit || !p.armor) return { hp: raw, armor: 0 };
  const saved = Math.min(Math.ceil(raw * 0.45), p.armor * 2);
  return { hp: raw - saved, armor: Math.ceil(saved / 2) };
}
Object.assign(SHOP, {
  he: { name: "HE / Осколочная", price: 300 },
  flash: { name: "FLASH / Светошумовая", price: 200 },
  smoke: { name: "SMOKE / Дымовая", price: 300 },
  fire: { name: "FIRE / Зажигательная", price: 400 },
});

// Each id has its own server ballistics, magazine, cadence and reload.
Object.assign(WEAPONS.rifle,{name:"M4A4",mag:30,reserve:90,damage:33,reload:3.1,delay:.09});
Object.assign(WEAPONS.pistol,{name:"USP-S",mag:12,reserve:24,damage:35,reload:2.2,delay:.17});
WEAPONS.rifle.name = "M4A4"; WEAPONS.rifle.slot = "primary"; WEAPONS.rifle.auto = true;
WEAPONS.pistol.name = "USP-S"; WEAPONS.pistol.slot = "secondary";
const arsenal = {
 ak47: {name:"AK-47",mag:30,reserve:90,damage:36,delay:.1,reload:2.45,spread:.005,price:2700,slot:"primary",auto:true,side:"T",category:"rifles",recoil:1.2},
 m4a1s: {name:"M4A1-S",mag:20,reserve:80,damage:32,delay:.1,reload:2.5,spread:.004,price:2900,slot:"primary",auto:true,side:"CT",category:"rifles",recoil:.75},
 awp: {name:"AWP",mag:5,reserve:30,damage:115,delay:1.45,reload:3.6,spread:.0007,price:4750,slot:"primary",scope:true,category:"rifles",recoil:2},
 ssg08: {name:"SSG 08",mag:10,reserve:90,damage:86,delay:1.25,reload:3.0,spread:.001,price:1700,slot:"primary",scope:true,category:"rifles",recoil:1.5},
 mp9: {name:"MP9",mag:30,reserve:120,damage:24,delay:.07,reload:2.1,spread:.008,price:1250,slot:"primary",auto:true,category:"mid",recoil:.65},
 p90: {name:"P90",mag:50,reserve:100,damage:26,delay:.075,reload:3.3,spread:.009,price:2350,slot:"primary",auto:true,category:"mid",recoil:.7},
 deagle: {name:"Desert Eagle",mag:7,reserve:35,damage:63,delay:.28,reload:2.2,spread:.003,price:700,slot:"secondary",category:"pistols",recoil:1.8},
 glock: {name:"Glock-18",mag:20,reserve:120,damage:28,delay:.17,reload:2.2,spread:.006,price:200,slot:"secondary",category:"pistols",recoil:.7},
};
Object.assign(WEAPONS, arsenal);
Object.assign(SHOP, Object.fromEntries(Object.entries(arsenal).map(([id,w])=>[id,{name:w.name,price:w.price,side:w.side,category:w.category}])));
Object.assign(SHOP.rifle,{name:"M4A4",category:"rifles"});
Object.assign(SHOP.pistol,{name:"USP-S",category:"pistols"});
export const KNIVES = Object.freeze({butterfly:"Бабочка",karambit:"Керамбит",m9:"M9 Bayonet"});
for(const [id,name] of Object.entries(KNIVES)) WEAPONS[id]={name,slot:"knife",melee:true,mag:1,reserve:0,damage:40,delay:.5,reload:0,spread:0,range:2};
export const weaponSlot = (id) => WEAPONS[id]?.slot || "primary";
export const weaponBase = (id) => weaponSlot(id) === "knife" ? "knife" : weaponSlot(id) === "secondary" ? "pistol" : "rifle";
export {ROUND_EVENTS} from "./round-events.mjs";
