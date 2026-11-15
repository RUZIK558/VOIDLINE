import * as THREE from "/vendor/three.module.js";
import { buildGrenade } from "./models.mjs";
const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03)+.15*noise(p*4.01);}
`;
function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    image = x.createImageData(128, 128);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y) => {
    const a = Math.floor(x),
      b = Math.floor(y);
    let u = x - a,
      v = y - b;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return (
      (hash(a, b) * (1 - u) + hash(a + 1, b) * u) * (1 - v) +
      (hash(a, b + 1) * (1 - u) + hash(a + 1, b + 1) * u) * v
    );
  };
  for (let y = 0; y < 128; y++)
    for (let z = 0; z < 128; z++) {
      const px = (z - 64) / 64,
        py = (y - 64) / 64,
        n = 0.6 * noise(z / 20, y / 20) + 0.4 * noise(z / 8, y / 8),
        r = Math.hypot(px, py),
        a = Math.max(0, 1 - r) * (0.45 + 0.55 * n);
      const i = (y * 128 + z) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 180 + Math.round(n * 55);
      image.data[i + 3] = Math.round(Math.pow(a, 0.8) * 230);
    }
  x.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
export function createUtilityFX(scene, sound) {
  const models = new Map(),
    zones = new Map(),
    bursts = [];
  const sphere = new THREE.SphereGeometry(1, 20, 14),
    plane = new THREE.PlaneGeometry(1.5, 1.45),
    time = { value: 0 };
  const flame = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { time },
    vertexShader: `varying vec2 vUv;varying float phase;void main(){vUv=uv;phase=modelMatrix[3].x*1.3+modelMatrix[3].z*2.1;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;varying vec2 vUv;varying float phase;${noiseGLSL}
void main(){float y=vUv.y;float flicker=fbm(vec2(vUv.x*5.+phase,y*6.-time*3.8));float center=.5+.065*sin(y*7.-time*5.+phase);float width=.42*(1.-y)+.035;float edge=abs(vUv.x-center)/width;float alpha=(1.-smoothstep(.35,1.15,edge+flicker*.55))*smoothstep(0.,.12,y)*(1.-smoothstep(.65,1.,y));float heat=clamp((1.-y)*.8+(1.-edge)*.3,0.,1.);vec3 col=mix(vec3(1.,.095,.008),vec3(1.,.86,.30),heat);gl_FragColor=vec4(col,alpha*.82*smoothstep(0.,.14,vUv.x)*(1.-smoothstep(.86,1.,vUv.x)));}`,
  });
  const smokeCore = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { time },
    vertexShader: `varying vec3 point;varying vec3 norm;varying vec3 world;void main(){point=position;norm=mat3(modelMatrix)*normal;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;varying vec3 point;varying vec3 norm;varying vec3 world;${noiseGLSL}void main(){float a=fbm(point.xz*2.+vec2(point.y*2.+time*.13,time*.08));float b=fbm(point.xy*3.-time*.07);float edge=abs(dot(normalize(norm),normalize(cameraPosition-world)));float alpha=smoothstep(.015,.5,edge)*.985;if(alpha<.01)discard;vec3 col=mix(vec3(.34,.39,.42),vec3(.67,.71,.73),.5*a+.4*b+.1);gl_FragColor=vec4(col,alpha);}`,
  });
  const smokeMat = new THREE.MeshBasicMaterial({
    map: smokeTexture(),
    color: "#abb7bc",
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const smokeShape = new THREE.SphereGeometry(1, 28, 20);
  const attr = smokeShape.attributes.position;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i),
      y = attr.getY(i),
      z = attr.getZ(i),
      r = 0.96 + 0.04 * Math.sin(x * 8 + y * 5) * Math.sin(z * 7 - y * 4);
    attr.setXYZ(i, x * r, y * r, z * r);
  }
  smokeShape.computeVertexNormals();
  function clearGroup(g, owned = false) {
    scene.remove(g);
    if (owned) {
      g.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      for (const m of g.userData.privateMaterials || []) m.dispose();
    }
  }
  function sync(state) {
    const ids = new Set();
    for (const p of state.projectiles || []) {
      ids.add(p.id);
      let m = models.get(p.id);
      if (!m) {
        m = buildGrenade(p.kind);
        scene.add(m);
        models.set(p.id, m);
      }
      m.position.set(p.x, p.y, p.z);
    }
    for (const [id, m] of models)
      if (!ids.has(id)) {
        clearGroup(m, true);
        models.delete(id);
      }
    const zids = new Set();
    for (const z of state.zones || []) {
      zids.add(z.id);
      let g = zones.get(z.id);
      if (!g) {
        g = new THREE.Group();
        scene.add(g);
        zones.set(z.id, g);
      }
      if (z.kind === "smoke" && !g.children.length) {
        g.position.set(z.x, z.y + 1.2, z.z);
        const core = new THREE.Mesh(smokeShape, smokeCore);
        core.scale.setScalar(2.65);
        g.add(core);
        for (let i = 0; i < 22; i++) {
          const m = new THREE.Mesh(plane, smokeMat),
            a = i * 2.39996,
            h = ((i % 5) - 2) * 0.43,
            r = 2.2 * Math.sqrt(Math.max(0.2, 1 - (h * h) / 5));
          m.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
          m.scale.set(1.8, 1.8, 1.8);
          m.userData.billboard = true;
          g.add(m);
        }
      }
      if (z.kind === "fire" && g.userData.count !== z.cells.length) {
        g.clear();
        g.userData.count = z.cells.length;
        for (const c of z.cells) {
          const m = new THREE.Mesh(plane, flame);
          m.position.set(c.x, c.y + 0.65, c.z);
          m.userData.billboard = true;
          g.add(m);
        }
      }
      g.userData.zone = z;
    }
    for (const [id, g] of zones)
      if (!zids.has(id)) {
        clearGroup(g);
        zones.delete(id);
      }
  }
  function event(e) {
    if (e.type === "bounce") {
      sound("bounce",{pos:e,key:"bounce",cooldown:.07});
      return;
    }
    if (e.type === "throw") {
      sound("throw",{pos:e});
      return;
    }
    if (e.type === "extinguish") {
      sound("hiss",{pos:e});
      return;
    }
    if (e.type !== "detonate") return;
    sound(e.kind === "he" ? "explosion" : e.kind === "flash" ? "flash" : "hiss",{pos:e,range:e.kind==="he"?85:45});
    if (["he", "flash"].includes(e.kind)) {
      const material = new THREE.MeshBasicMaterial({
        color: e.kind === "he" ? "#ffb25a" : "#ffffff",
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(sphere, material);
      mesh.position.set(e.x, e.y, e.z);
      scene.add(mesh);
      bursts.push({ mesh, life: 0.45, total: 0.45 });
    }
  }
  function update(t, dt, now, yaw = 0) {
    time.value = t;
    for (const m of models.values()) m.rotation.set(t * 6, t * 3, t * 4);
    for (const g of zones.values()) {
      const z = g.userData.zone;
      g.visible = now < z.until;
      if (z.kind === "smoke")
        g.scale.setScalar(
          Math.max(0.01, Math.min(1, (now - z.born) / 500, (z.until - now) / 1000)),
        );
      for (const m of g.children) if (m.userData.billboard) m.rotation.y = yaw;
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      b.mesh.scale.setScalar(0.25 + (1 - b.life / b.total) * 2.3);
      b.mesh.material.opacity = Math.max(0, b.life / b.total);
      if (b.life <= 0) {
        scene.remove(b.mesh);
        b.mesh.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }
  function clear() {
    for (const m of models.values()) clearGroup(m, true);
    models.clear();
    for (const g of zones.values()) clearGroup(g);
    zones.clear();
    for (const b of bursts) {
      scene.remove(b.mesh);
      b.mesh.material.dispose();
    }
    bursts.length = 0;
  }
  return { sync, event, update, clear };
}
