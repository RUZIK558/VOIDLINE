import{createClientAntiCheat}from'./vcac-client.mjs';
import {QUICK_COMMANDS,selectedSector} from "./tactical.mjs";
import {createTacticalHold} from "./tactical-input.mjs";
import {createTacticalHUD} from "./tactical-ui.mjs";
import {wallDistance} from "./shared.mjs";
import {createGameAudio,createStepTracker} from "./audio.mjs";
import {createChatNotices} from "./chat-notices.mjs";
import {aimDelta} from "./aim.mjs";
import {purchaseError} from "./purchase.mjs";
import {sideLabel,spectatorTarget,flashOpacity} from "./match-ui.mjs";
import {createPointerCapture} from "./pointer-capture.mjs";
import {isEditableTarget,preventPageKey,viewportLayout} from "./input-policy.mjs";
import {cycleSlot} from "./slot-cycle.mjs";
import {setupDiagnostics} from "./diagnostics.mjs";
import {getMap} from "./maps.mjs";
import {createMapWorld} from "./map-world.mjs";
import {disposeOwnedTree} from "./resources.mjs";
import {createTeamUI} from "./team-ui.mjs";
import {
  DEFAULTS,
  normalizeSettings,
  actionDown,
  renderSize,
  keyLabel,
} from "./settings-schema.mjs";
import { setupSettingsUI } from "./settings-ui.mjs";
import { createPostFX } from "./postfx.mjs";
import { createStudioEnvironment } from "./lighting.mjs";
import { icon } from "./icons.mjs";
import {createVoice} from "./voice.mjs";
import {paintCrosshair} from "./crosshair.mjs";
import {createShopPreview,weaponSilhouette} from "./shop-preview.mjs";
import { createLobby } from "./lobby.mjs";
import {
  buildOperator,
  buildViewModel,
  buildWeapon,
  buildGrenade,
  buildUtilityView,
} from "./models.mjs";
import { setupSocialUI, setupMenuTabs } from "./social-ui.mjs";
import { setupHostUI } from "./host-ui.mjs";
import * as THREE from "/vendor/three.module.js";
import {
  WEAPONS, weaponSlot,
  SHOP,
  clamp,
  accelerate,
  eyeHeight,
  atSite,
} from "./shared.mjs";
import { UTILITY, validUtility, utilityCount } from "./utilities.mjs";
import { SKINS } from "./cosmetics.mjs";
import { applyWeaponSkin } from "./skin-materials.mjs";
import { setupInventoryUI } from "./inventory-ui.mjs";
import { createUtilityFX } from "./utility-fx.mjs";
const $ = (id) => document.getElementById(id),
  canvas = $("world");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
} catch {
  $("fatal").hidden = false;
  $("fatal").textContent =
    "Нужна поддержка WebGL 2. Включи аппаратное ускорение и перезапусти приложение.";
  throw Error("WebGL unavailable");
}
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
// CSS display size is always the viewport; internal resolution is independent.
canvas.style.width="100%";canvas.style.height="100%";canvas.tabIndex=-1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const postFX = createPostFX(renderer);
let prefs = normalizeSettings(null),
  inventoryUI;
const diagnostics=setupDiagnostics(()=>({version:'1.0.9',platform:navigator.platform,userAgent:navigator.userAgent,graphics:{shadows:prefs.shadows,renderScale:prefs.renderScale,aa:prefs.aa},gpu:{...renderer.info.memory}}));
const down = (name) => actionDown(keys, prefs, name);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#a7d5e5");
scene.fog = new THREE.FogExp2("#d9c39b", 0.009);
const camera = new THREE.PerspectiveCamera(
  77,
  innerWidth / innerHeight,
  0.045,
  180,
);
camera.rotation.order = "YXZ";
scene.add(camera);
scene.add(new THREE.HemisphereLight("#c4e8ff", "#3a3d42", 2.15));
const sun = new THREE.DirectionalLight("#ffe0bc", 3.2);
sun.position.set(-18, 38, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -85,
  right: 85,
  top: 85,
  bottom: -85,
  near: 1,
  far: 220,
});
sun.shadow.bias = -0.001;
scene.add(sun);
const mats = {
  concrete: new THREE.MeshStandardMaterial({
    color: "#c1ad8b",
    roughness: 0.94,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: "#777f72",
    metalness: 0.65,
    roughness: 0.42,
  }),
  crate: new THREE.MeshStandardMaterial({ color: "#a68150", roughness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({
    color: "#141f28",
    roughness: 0.65,
    metalness: 0.65,
  }),
  orange: new THREE.MeshStandardMaterial({ color: "#f0a05e", roughness: 0.6 }),
  cyan: new THREE.MeshStandardMaterial({ color: "#62c6c8", roughness: 0.5 }),
};
let currentMap=getMap('terminal'),mapWorld=createMapWorld(currentMap);
scene.add(mapWorld.root);
function loadMap(id){
 const next=getMap(id);if(next.id===currentMap.id)return;
 mapWorld.dispose();currentMap=next;mapWorld=createMapWorld(next);scene.add(mapWorld.root);
 scene.background.set(next.theme.sky);scene.fog.color.set(next.theme.fog);sun.color.set(next.theme.sun);
 cameraReady=false;renderer.renderLists.dispose();
}
const dropModels = new Map();
const bombModel = new THREE.Group();
const bombCase = new THREE.Mesh(
  new THREE.BoxGeometry(0.48, 0.22, 0.32),
  mats.dark,
);
const bombLight = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.025, 0.06),
  new THREE.MeshBasicMaterial({ color: "#ff5b45" }),
);
bombModel.add(bombCase, bombLight);
bombLight.position.set(0, 0.125, 0);
scene.add(bombModel);
bombModel.visible = false;
let nextBeep = 0;
function syncWorldItems() {
  const ids = new Set();
  for (const d of state.drops || []) {
    ids.add(d.id);
    let model = dropModels.get(d.id);
    if (!model) {
      model =
        d.kind === "utility" ? buildGrenade(d.utility) : buildWeapon(d.weapon);
      if (d.kind !== "utility") applyWeaponSkin(model, d.skin);
      model.rotation.set(0, 0.4, Math.PI / 2);
      scene.add(model);
      dropModels.set(d.id, model);
    }
    model.position.set(d.x, (d.y||0)+0.2, d.z);
  }
  for (const [id, model] of dropModels)
    if (!ids.has(id)) {
      disposeOwnedTree(model);
      dropModels.delete(id);
    }
  const b = state.bomb;
  bombModel.visible =
    ["dropped", "planted", "defused", "exploded"].includes(b?.state) &&
    b.state !== "exploded";
  if (bombModel.visible) bombModel.position.set(b.x, (b.y||0)+0.18, b.z);
}

// The view model uses its own depth-cleared pass to avoid clipping into walls.
const weaponScene = new THREE.Scene();
weaponScene.add(new THREE.HemisphereLight("#def6ff", "#4b4140", 3));
const gunLight = new THREE.DirectionalLight("#fff1db", 3);
gunLight.position.set(-2, 4, 3);
weaponScene.add(gunLight);
const gunCam = new THREE.PerspectiveCamera(
  65,
  innerWidth / innerHeight,
  0.01,
  10,
);
const gun = new THREE.Group();
weaponScene.add(gun);
const rifleView = buildViewModel("rifle"),
  pistolView = buildViewModel("pistol");
gun.add(rifleView, pistolView);
const weaponViews={rifle:rifleView,pistol:pistolView};
function getView(id){
 id=WEAPONS[id]?id:"rifle";
 if(!weaponViews[id]){const v=buildViewModel(id);v.visible=false;v.userData.hands.userData.setGloves(prefs.gloves);weaponViews[id]=v;gun.add(v);}
 return weaponViews[id];
}
function applyCrosshair(el){paintCrosshair(el,prefs);}
let shopPreview,shopItem="rifle";
function showShopModel(id){
 id=Object.hasOwn(SHOP,id)?id:"rifle";shopItem=id;
 $("shopName").textContent=SHOP[id].name;
 const w=WEAPONS[id],e=state?.roundEvent||{},price=Math.round(SHOP[id].price*(e.price??1));
 $("shopStats").textContent=w?`$${price} · ${w.mag} / ${w.reserve} · Урон ${Math.round(w.damage*(e.damage??1))} · ${Math.round(60/(w.delay*(e.cadence??1)))} выстр/мин · Перезарядка ${(w.reload*(e.reload??1)).toFixed(2)} с` : "Снаряжение · $"+price;
 if(me&&state){const reason=purchaseError(me,id,{phase:state.phase,roundEvent:state.roundEvent,map:currentMap,attackTeam:state.attackTeam});if(reason)$('shopStats').textContent+=' · '+reason;}
 shopPreview ||= createShopPreview($("shopCanvas"));shopPreview.show(id,me&&state&&me.team===state.attackTeam?1:0);
}
const mobile = navigator.maxTouchPoints>0 && matchMedia("(pointer:coarse)").matches;
let spectateId=null,spectateCameraId=null;
const spectatePos=new THREE.Vector3();
function pov(){return spectatorTarget(state?.players||[],me,spectateId)||me;}
function changeSpectator(step){const target=spectatorTarget(state?.players||[],me,spectateId,step);spectateId=target?.id||null;lastEquipped=null;if(state&&me)hud();}
let scoped=false, touchMove={forward:0,side:0}, reconnectTimer=null,reconnectAttempts=0,joinError="";
const resumeTokens=new Map();
const utilityViews = Object.fromEntries(
  Object.keys(UTILITY).map((k) => [k, buildUtilityView(k)]),
);
for (const v of Object.values(utilityViews)) {
  v.visible = false;
  gun.add(v);
}
pistolView.visible = false;
const lobby = createLobby();
const flashCanvas = document.createElement("canvas");
flashCanvas.width = flashCanvas.height = 128;
const flashCtx = flashCanvas.getContext("2d");
const glow = flashCtx.createRadialGradient(64, 64, 1, 64, 64, 64);
glow.addColorStop(0, "#fffef9");
glow.addColorStop(0.2, "#fff5a9");
glow.addColorStop(0.5, "#ffac36aa");
glow.addColorStop(1, "#ff792000");
flashCtx.fillStyle = glow;
flashCtx.fillRect(0, 0, 128, 128);
const flash = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(flashCanvas),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
);
flash.scale.set(0.18, 0.18, 1);
flash.position.set(0.22, -0.21, -1.45);
flash.visible = false;
gun.add(flash);
let socket,
  myId,
  state,
  me = null,
  active = false,
  connected = false,
  locked = false,
  yaw = 0,
  pitch = 0,
  keys = {},
  mouseFire = false,
  mouseAlt = false,
  grenadeRequest = null,
  reloadRequest = false,
  weaponRequest = null,
  dropRequest = false,
  pickupRequest = false,
  bombOnly = false,
  prediction = { vx: 0, vz: 0 },
  lastSent = 0,
  clock = 0,
  lastTime = performance.now(),
  kick = 0,
  reloadBlend = 0,
  throwView = null,
  flashTime = 0,
  hitTime = 0,
  damageTime = 0,
  lastHp = 100,
  netOffset = 0,
  viewPos = new THREE.Vector3(),
  cameraReady = false;
const models = new Map(),
  tracers = [],
  feed = [];
const gameAudio=createGameAudio({
 getVolume:()=>(window.voidlinePrefs?.volume??.7)*((me?.flash?.until||0)>Date.now()+netOffset ? .35 : 1),
 getListener:()=>({x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:camera.rotation.y}),
 isOccluded:(a,b)=>{if(!b)return false;const v=[b.x-a.x,b.y-(a.y??1),b.z-a.z],d=Math.hypot(...v);return d>.1&&wallDistance([a.x,a.y??1,a.z],v.map(n=>n/d),currentMap.boxes)<d-.15;},
 onError:e=>console.warn('[audio]',e.message||e)
}),stepTracker=createStepTracker();
function audioInit(){gameAudio.init();}
function sound(kind,remote=false){
 const opts=typeof remote==='object'?remote:{gain:remote?.2:undefined};
 return gameAudio.play(kind,opts);
}
function tacticalEnabled(){return active&&connected&&me?.alive&&hasGameControl()&&!gameModalOpen()&&!isEditableTarget(document.activeElement)&&['freeze','live'].includes(state?.phase);}
function sendTactical(action,command){if(!tacticalEnabled()||socket?.readyState!==WebSocket.OPEN)return;sendInput();socket.send(JSON.stringify({type:'tactical',action,...(command?{command}:{} )}));}
const tacticalHUD=createTacticalHUD({getTime:()=>Date.now()+netOffset,onSound:mine=>{audioInit();sound('chat',{gain:mine ? .14 : .26,cooldown:.05});}});
const tacticalHold=createTacticalHold({enabled:tacticalEnabled,
 onTap:()=>sendTactical('ping'),
 onOpen:()=>{keys={};mouseFire=mouseAlt=false;grenadeRequest=weaponRequest=null;reloadRequest=dropRequest=pickupRequest=false;tacticalHUD.show(keyLabel(prefs.bindings.tactical));document.body.classList.add('tacticalWheelOpen');sendInput();},
 onCommit:index=>sendTactical('command',QUICK_COMMANDS[index].id),
 onClose:()=>{tacticalHUD.hide();document.body.classList.remove('tacticalWheelOpen');},
 onSelect:(index,x,y)=>tacticalHUD.select(index,x,y)
});
function makePlayer(p) {
  const root = buildOperator(p.team===state?.attackTeam?1:0);
  root.userData.side=p.team===state?.attackTeam?1:0;
  const sidearm = buildWeapon("pistol");
  sidearm.position.copy(root.userData.weapon.position);
  sidearm.rotation.copy(root.userData.weapon.rotation);
  root.userData.body.add(sidearm);
  root.userData.sidearm = sidearm;
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.17),
    mats.orange,
  );
  pack.position.set(0, 1.3, 0.24);
  root.userData.body.add(pack);
  root.userData.bombPack = pack;
  root.userData.utilities = {};
  for (const kind of Object.keys(UTILITY)) {
    const v = buildGrenade(kind);
    v.position.set(0.1, 1.2, -0.35);
    root.userData.body.add(v);
    root.userData.utilities[kind] = v;
  }
  scene.add(root);
  return {
    root,
    body: root.userData.body,

    lastX: p.x,
    lastZ: p.z,
  };
}

const utilityFX = createUtilityFX(scene, sound);
function shotOrigin(e,local){
 if(local){
  const w=getView(e.weapon).userData.weapon;
  if(w?.userData.muzzle){
   gun.updateMatrixWorld(true);camera.updateMatrixWorld(true);gunCam.updateMatrixWorld(true);
   const muzzle=w.localToWorld(w.userData.muzzle.clone()),ndc=muzzle.clone().project(gunCam);
   return new THREE.Vector3(ndc.x,ndc.y,.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(muzzle.length()).add(camera.position);
  }
 }
 const m=models.get(e.id),w=m&&(e.weapon==='rifle'?m.root.userData.weapon:e.weapon==='pistol'?m.root.userData.sidearm:m.extraWeapons?.[e.weapon]);
 if(w?.userData.muzzle){m.root.updateMatrixWorld(true);return w.localToWorld(w.userData.muzzle.clone());}
 return new THREE.Vector3(...e.from);
}
function event(e) {
  utilityFX.event(e);
  if(e.type==='dry'&&e.id===(spectateId||myId))sound('dry');
  if(e.type==='round')sound('round');
  if(e.type==='win')sound(e.reason==='defused'?'defuse':e.team===me?.team?'win':'loss');
  if(e.type==='plant')sound('plant');
  if (e.type === "throw" && e.id === (spectateId||myId)) {
    throwView = { kind: e.kind, until: clock + 0.4 };
    utilityViews[e.kind].userData.animations.play();
  }
  if (e.type === "shot" && e.id !== myId && models.has(e.id))
    models.get(e.id).shotUntil = clock + 0.18;
  if(e.type === "melee") {
    if(e.id===(spectateId||myId)){getView(pov()?.weapon).userData.animations.play(e.heavy?"heavy":"fire");sound("knife");}
    else if(models.has(e.id))models.get(e.id).shotUntil=clock+.3;
  }
  if (e.type === "shot") {
    const local = e.id === (spectateId||myId);
    if (local) {
      getView(pov()?.weapon).userData.animations.play("fire");
      kick = 0.035;
      flashTime = 0.045;
      sound("shot",{weapon:e.weapon});
    } else sound("shot",{weapon:e.weapon,pos:{x:e.from[0],y:e.from[1],z:e.from[2]},key:"shot-"+e.id});
    const g = new THREE.BufferGeometry().setFromPoints([
        shotOrigin(e,local),
        new THREE.Vector3(...e.to),
      ]),
      line = new THREE.Line(
        g,
        new THREE.LineBasicMaterial({
          color: local ? "#ffe6a5" : "#edb781",
          transparent: true,
          opacity: 0.6,
        }),
      );
    scene.add(line);
    tracers.push({ line, life: 0.06 });
  }
  if (e.type === "hit" && e.id === myId) {
    hitTime = 0.16;
    $("hitmarker").style.color = e.head ? "#ffb479" : "#fff";
    sound("hit");
  }
  if (e.type === "kill") {
    feed.unshift({ ...e, at: clock });
    if (feed.length > 4) feed.pop();
    renderFeed();
  }
}
function renderFeed() {
  const host = $("killfeed");
  host.replaceChildren();
  for (const e of feed) {
    const div = document.createElement("div");
    div.className = "kill";
    div.style.borderColor = e.team === 0 ? "#8ef2e8" : "#ffb479";
    const a = document.createElement("b"),
      b = document.createElement("span"),
      c = document.createElement("em");
    a.textContent = e.killer;
    b.textContent = e.head
      ? "⌖ HEADSHOT"
      : e.weapon && UTILITY[e.weapon]
        ? UTILITY[e.weapon].name.split(" /")[0]
        : "— VX —";
    c.textContent = e.victim;
    div.append(a, b, c);
    host.append(div);
  }
}
function setStatus(msg) {
  $("status").textContent = msg;
}
setupSocialUI();
const environment = createStudioEnvironment(renderer);
for (const stage of [scene, weaponScene, lobby.scene]) {
  stage.environment = environment;
  stage.environmentIntensity = 0.55;
}
function applyGraphics(settings) {
  prefs = settings;
  const label = (a) => keyLabel(prefs.bindings[a]);
  document.querySelector(".controls").textContent =
    `${label("forward")}${label("left")}${label("back")}${label("right")} движение · ${label("reload")} перезарядка · ${label("slow")} шаг · ${label("scoreboard")} счёт · ${label("he")}–${label("fire")} гранаты · ${label("crouch")} присесть · ${label("interact")} действие · ${label("drop")} выбросить · ${label("buy")} закупка · СКМ / ${label("tactical")} метка · удерживай ${label("tactical")} команды · Esc пауза`;
  applyCrosshair($("crosshair"));
  renderer.toneMappingExposure = prefs.exposure;
  renderer.shadowMap.enabled = prefs.shadows !== "off";
  const size = { low: 512, medium: 1024, high: 2048, off: 512 }[prefs.shadows];
  for (const stage of [scene, lobby.scene])
    stage.traverse((o) => {
      if (o.isDirectionalLight && o.shadow) {
        if (o.shadow.mapSize.x !== size) {
          o.shadow.map?.dispose();
          o.shadow.map = null;
          o.shadow.mapSize.set(size, size);
        }
        o.shadow.needsUpdate = true;
      }
    });
  for (const view of [...Object.values(weaponViews), ...Object.values(utilityViews)])
    view.userData.hands.userData.setGloves(prefs.gloves);
  const dimensions = renderSize(
    prefs,
    innerWidth,
    innerHeight,
    devicePixelRatio,
    mobile ? 2073600 : 8294400,
  );
  renderer.setSize(dimensions.width, dimensions.height, false);
  postFX.resize(dimensions.width, dimensions.height, prefs.aa);
  const viewport=viewportLayout(innerWidth,innerHeight);
  camera.aspect = gunCam.aspect = viewport.aspect;
  camera.updateProjectionMatrix();
  gunCam.fov = prefs.viewFov;
  gunCam.updateProjectionMatrix();
  lobby.resize(viewport.width, viewport.height);
  inventoryUI?.resize(viewport.width, viewport.height);
}
const settingsUI = setupSettingsUI({
  onChange: applyGraphics,
  onOpen: () => {
    releaseGameControls();
    if (active) $("pause").hidden = true;
    sendInput();
  },
  onClose: () => {
    if (active) $("pause").hidden = false;
  },
});
$("pauseSettings").onclick = () => settingsUI.open();
for (const el of document.querySelectorAll("[data-icon]"))
  el.innerHTML = icon(el.dataset.icon);
for (const [pane, name] of Object.entries({
  arsenal: "weapon",
  inventory: "inventory",
  equipment: "equipment",
  play: "play",
})) {
  const b = document.querySelector(`[data-pane="${pane}"]`);
  b.insertAdjacentHTML("afterbegin", icon(name));
}
setupMenuTabs();
inventoryUI = setupInventoryUI((loadout) => {
  applyWeaponSkin(lobby.operator.userData.weapon, loadout.rifle);
  if (connected && socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ type: "cosmetics", loadout }));
});
inventoryUI.scene.environment = environment;
inventoryUI.scene.environmentIntensity = 0.7;
applyGraphics(prefs);
const hostUI = setupHostUI({ connect: (endpoint) => connect(endpoint) });
$("joinForm").addEventListener("submit", (e) => {
  e.preventDefault();
  connect();
});
let pendingTeamJoin=null, chosenTeam="auto";
const teamUI=createTeamUI(team=>{if(pendingTeamJoin){chosenTeam=team;pendingTeamJoin(team);}},()=>{teamUI.hide();pendingTeamJoin=null;joinError="Вход отменён";socket?.close();$("join").disabled=false;setStatus("Выбери сервер и войди, когда будешь готов.");});
function connect(override) {
  clearTimeout(reconnectTimer);
  if (socket) socket.close();
  const raw = override ?? $("address").value.trim();
  if(new URLSearchParams(location.search).has("android")&&!raw){setStatus("Android-клиент: введи IP:порт сервера на ПК. Офлайн-хостинг здесь недоступен.");return;}
  try{localStorage.setItem("voidline.server",raw);}catch{}
  let url;
  try {
    url = new URL(
      raw
        ? raw.match(/^wss?:\/\//)
          ? raw
          : raw.match(/^https?:\/\//)
            ? raw
            : "http://" + raw
        : location.origin,
    );
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol))
      throw Error();
    url.protocol = ["https:", "wss:"].includes(url.protocol) ? "wss:" : "ws:";
    url.pathname = "/";
    url.search = "";
    url.hash = "";
  } catch {
    setStatus("Неверный адрес. Пример: 192.168.1.10:3080");
    return;
  }
  joinError="";
  $("join").disabled = true;
  setStatus("Подключение к серверу…");
  audioInit();
  const ws = new WebSocket(url);
  socket = ws;antiCheat.attach(ws);
  let timeout = setTimeout(() => ws.close(), 8000);
  const sendJoin=async(team)=>{
    await inventoryUI.ready;
    if(socket!==ws||ws.readyState!==WebSocket.OPEN)return;
    clearTimeout(timeout);timeout=setTimeout(()=>ws.close(),8000);
    ws.send(JSON.stringify({type:"join",ac:antiCheat.join(),name:$("name").value,loadout:inventoryUI.getLoadout(),team,resume:resumeTokens.get(url.href)}));
  };
  ws.addEventListener("open",()=>{
    if(active&&resumeTokens.has(url.href)){sendJoin(chosenTeam);return;}
    ws.send(JSON.stringify({type:"match-info"}));
  });
  ws.addEventListener("message", (ev) => {
    if (socket !== ws) return;
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if(m.type==='ac-info'){serverProtection=m.vsac===1;updateAntiCheatLabel();}
    if(m.type==="match-info"){
      clearTimeout(timeout);timeout=setTimeout(()=>ws.close(),120000);
      pendingTeamJoin=sendJoin;teamUI.show(m,chosenTeam);
    }
    if(m.type?.startsWith("voice-"))voice.handle(m);
    if(m.type==='tactical'||m.type==='tactical-state'){if(m.reset)tacticalHold.cancel();if(!me||m.team===me.team)tacticalHUD.receive(m,myId);}
    if(m.type==='tactical-error')tacticalHUD.error(m.error);
    if(m.type==="chat") addChat(m.name,m.text,m.id);
    if(m.type==="pong" && Number.isFinite(m.sent)) {const rtt=Date.now()-m.sent;$("netStatus").textContent=Math.round(rtt)+" ms";netOffset=m.time-Date.now()+rtt/2;}
    if (m.type === "join-error") { joinError=m.error;setStatus(m.error); }
    if (m.type === "welcome") {
      serverProtection=serverProtection===true;updateAntiCheatLabel();
      teamUI.hide();pendingTeamJoin=null;
      reconnectAttempts=0;
      if(m.resume) resumeTokens.set(url.href,m.resume);
      clearTimeout(timeout);
      myId = m.id;
      active = connected = true;
      publishInputState();
      cameraReady = false;
      prediction = { vx: 0, vz: 0 };
      feed.length = 0;
      renderFeed();
      lastHp = 100;
      keys = {};
      $("menu").hidden = true;
      $("hud").hidden = false;
      $("join").disabled = false;
      $("pause").hidden = false;
      hostUI.onConnection(url.href);
      requestLock();
    }
    if (m.type === "purchase") {
      if(m.ok)sound("buy");
      $("buyMessage").textContent = m.ok
        ? "Куплено: " + SHOP[m.item].name
        : m.error;
    }
    if (m.type === "state") {
      if (state && state.round !== m.round) {
        tacticalHUD.reset();
        resetGameControls();
        cameraReady = false;
        prediction = { vx: 0, vz: 0 };
      }
      if(m.mapId!==currentMap.id){tacticalHold.cancel();tacticalHUD.reset();loadMap(m.mapId);}
      const previousPhase=state?.phase;
      state = m;
      if(previousPhase==='freeze'&&m.phase==='live')sound('live');
      for(const e of stepTracker.update(m,p=>p.y-eyeHeight(p)>.2?'metal':currentMap.surface)){
       const local=e.id===(spectateId||myId);
       sound(e.kind,{weapon:e.weapon,pos:local?null:e.pos,key:e.id+':'+e.kind,gain:e.kind.startsWith('step-')?(local?.16:.28):undefined});
      }
      netOffset = m.serverTime - Date.now();
      me = m.players.find((p) => p.id === myId);
      if(me)tacticalHUD.setTeam(me.team);
      if(!me?.alive||!['live','freeze'].includes(m.phase))tacticalHold.cancel();
      spectateId=spectatorTarget(m.players,me,spectateId)?.id||null;
      if (me) {
        if (!cameraReady) {
          yaw = me.yaw;
          pitch = me.pitch;
          viewPos.set(me.x, me.y, me.z);
          cameraReady = true;
        }
        if (me.hp < lastHp) {
          damageTime = 0.35;
          sound("hurt");
        }
        lastHp = me.hp;
      }
      for (const e of m.events) event(e);
      syncModels();
      syncWorldItems();
      utilityFX.sync(m);
      hud();
    }
  });
  ws.addEventListener("close", (e) => {
    if(e.code===1008&&String(e.reason).startsWith('VSAC'))joinError='Соединение остановлено VSAC: нарушение протокола. Постоянный бан не выдавался.';
    clearTimeout(timeout);
    if (socket !== ws) return;
    teamUI.hide();pendingTeamJoin=null;
    voice.stop();
    connected = false;
    gameAudio.stop();stepTracker.reset();tacticalHUD.reset();
    releaseGameControls();publishInputState();
    $("join").disabled = false;
    if(active && !joinError && reconnectAttempts<6) {
      reconnectAttempts++; $("pauseInfo").textContent="Переподключение… "+reconnectAttempts+"/6";
      reconnectTimer=setTimeout(()=>connect(url.href),Math.min(4000,800*reconnectAttempts)); return;
    }
    if (active) {
      $("pause").hidden = false;
      $("pauseInfo").textContent =
        joinError || "Не удалось восстановить соединение. Вернись в меню.";
      document.exitPointerLock?.();
    } else
      setStatus(
        joinError || "Сервер недоступен. Проверь адрес, порт и запуск сервера.",
      );
  });
  ws.addEventListener("error", () => {
    if (!active) setStatus("Не удалось подключиться к серверу.");
  });
}
function publishInputState(){
  window.voidlineInput?.setActive(!!(active&&connected));
}
function resetGameControls(){
  for(const v of Object.values(weaponViews))v.userData.animations.reset?.('controls-released');
  tacticalHold.cancel();
  keys={};mouseFire=mouseAlt=false;scoped=false;touchMove={forward:0,side:0};
  grenadeRequest=weaponRequest=null;reloadRequest=dropRequest=pickupRequest=false;
  wheelSelection=null;prediction={vx:0,vz:0};
  $("scoreboard").hidden=true;
}
function gameModalOpen(){
  return !$("socialDialog").hidden || settingsUI.isOpen() || !$("buyMenu").hidden || !!document.getElementById("matchChat")&&!$("matchChat").hidden;
}
let nativeMouse=false,mouseCaptureRevision=0;
let serverProtection=null;
const acLabel=document.createElement('small');acLabel.id='antiCheatStatus';acLabel.setAttribute('role','status');$('pauseInfo').after(acLabel);
const clientStateLabels={clean:'целостность проверена',modified:'файлы изменены',unavailable:'не удалось проверить',development:'режим разработки',browser:'браузер, без проверки файлов'};
const antiCheat=createClientAntiCheat({onStatus:updateAntiCheatLabel});
function updateAntiCheatLabel(value=antiCheat.status()){acLabel.textContent=`VSAC: ${serverProtection===null?'до подключения':serverProtection?'активен':'сервер без VSAC'} · VCAC: ${clientStateLabels[value.state]||'не проверен'}`;}
updateAntiCheatLabel();window.voidlineAntiCheat?.status().then(updateAntiCheatLabel).catch(()=>{});
const mouseBackendLabel=document.createElement('small');mouseBackendLabel.id='mouseBackend';mouseBackendLabel.textContent='Ввод: системный Pointer Lock';$('pauseInfo').after(mouseBackendLabel);
async function setNativeCapture(value){
 const revision=++mouseCaptureRevision;nativeMouse=false;
 if(!window.voidlineMouse)return;
 try{
  const result=await window.voidlineMouse.capture(value);
  if(revision!==mouseCaptureRevision)return;
  nativeMouse=!!value&&!!result.active&&hasGameControl();
  mouseBackendLabel.textContent='Ввод: '+(result.reason||result.backend||'Pointer Lock');
  if(value)diagnostics.log('mouse-backend',JSON.stringify(result));
 }catch(error){nativeMouse=false;mouseBackendLabel.textContent='Ввод: Pointer Lock · XInput2 недоступен';diagnostics.log('mouse-backend',error.message);}
}
function applyRelativeMouse(dx,dy){
 if(!hasGameControl()||!me?.alive||mobile)return;
 if(tacticalHold.move(dx,dy,selectedSector))return;
 const sensitivity=prefs.sensitivity*(scoped&&WEAPONS[me?.weapon]?.scope?prefs.scopeSensitivity:1);
 const aim=aimDelta(yaw,pitch,dx,dy,sensitivity,prefs.invertY);yaw=aim.yaw;pitch=aim.pitch;
}
window.voidlineMouse?.onDelta(({dx,dy})=>{if(nativeMouse&&Number.isFinite(dx)&&Number.isFinite(dy))applyRelativeMouse(dx,dy);});
window.voidlineMouse?.onStatus(result=>{nativeMouse=false;mouseBackendLabel.textContent='Ввод: '+(result.reason||'Pointer Lock');});
const capture=createPointerCapture({element:canvas,
  enabled:()=>active&&connected&&!gameModalOpen(),
  onChange:value=>{
    locked=value;resetGameControls();document.body.classList.toggle("mouseCaptured",value);
    setNativeCapture(value);
    if(active && !gameModalOpen()){
      $("pause").hidden=value;
      if(!value&&connected)$("pauseInfo").textContent="Мышь освобождена. Нажми «Продолжить», чтобы захватить её. Esc — пауза.";
    }
    publishInputState();sendInput();
  },
  onFailure:message=>{if(active&&connected&&!gameModalOpen()){$("pauseInfo").textContent=message;$("pause").hidden=false;}}
});
function hasGameControl(){return mobile ? locked&&active&&connected&&!document.hidden : capture.locked;}
function releaseGameControls(){
  locked=false;resetGameControls();capture.release();sendInput();
}
function requestLock() {
  if (!connected || !active || gameModalOpen()) return;
  audioInit();
  if(mobile){locked=true;$("pause").hidden=true;document.documentElement.requestFullscreen?.().catch(()=>{});return;}
  if(navigator.userActivation && !navigator.userActivation.isActive){
    $("pause").hidden=false;$("pauseInfo").textContent="Нажми «Продолжить», чтобы захватить мышь. Esc — пауза.";return;
  }
  return capture.request();
}
$("resume").onclick = requestLock;
$("leave").onclick = async () => {
  voice.stop();
  chatNotices.markRead("match");
  active = false;
  tacticalHold.cancel();tacticalHUD.reset();
  clearTimeout(reconnectTimer); resumeTokens.clear();
  utilityFX.clear();
  $("flashBlind").style.opacity = 0;
  connected = false;
  socket?.close();
  socket = null;
  releaseGameControls();publishInputState();
  $("pause").hidden = true;
  $("buyMenu").hidden = true;
  for (const model of dropModels.values()) disposeOwnedTree(model);
  dropModels.clear();
  for(const t of tracers){t.line.removeFromParent();t.line.geometry.dispose();t.line.material.dispose();}tracers.length=0;
  renderer.renderLists.dispose();
  bombModel.visible = false;
  $("hud").hidden = true;
  $("scoreboard").hidden = true;
  try {
    await hostUI.onLeave();
  } catch (error) {
    setStatus(error.message);
  }
  $("menu").hidden = false;
  setStatus("Пустой адрес → локальная игра с ботами");
  me = null;
  state = null;
  for (const m of models.values()) disposeOwnedTree(m.root);
  models.clear();
};
function sendInput() {
  if (!connected || !active || socket?.readyState !== WebSocket.OPEN) return;
  const controlling=hasGameControl()&&!tacticalHold.isOpen;
  socket.send(
    JSON.stringify({
      type: "input",seq:antiCheat.nextInput(),
      yaw,
      pitch,
      scoped, shotTime:Date.now()+netOffset,
      forward: controlling ? mobile ? touchMove.forward : Number(down("forward")) - Number(down("back")) : 0,
      side: controlling ? mobile ? touchMove.side : Number(down("right")) - Number(down("left")) : 0,
      fire: controlling && mouseFire,
      altFire: controlling && mouseAlt,
      jump: controlling && down("jump"),
      slow: controlling && down("slow"),
      crouch: controlling && down("crouch"),
      interact: controlling && down("interact"),
      grenade: controlling?grenadeRequest:null,
      weapon: controlling?weaponRequest:null,
      reload: controlling&&reloadRequest,
      drop: controlling&&dropRequest,
      bombOnly,
      pickup: controlling&&pickupRequest,
    }),
  );
  grenadeRequest = weaponRequest = null;
  reloadRequest = dropRequest = pickupRequest = false;
}
// Capture-phase prevention keeps Ctrl+W/A/R/etc as game input, not browser commands.
document.addEventListener("keydown",e=>{
  if(preventPageKey(e,{active,editing:isEditableTarget(e.target),controlling:hasGameControl(),bindings:prefs.bindings}))e.preventDefault();
},{capture:true});
document.addEventListener("wheel",e=>{if(e.ctrlKey||e.metaKey)e.preventDefault();},{capture:true,passive:false});
document.addEventListener("mousemove",e=>{if(!nativeMouse)applyRelativeMouse(e.movementX,e.movementY);});
document.addEventListener("keydown", (e) => {
  if (!active || settingsUI.isOpen() || isEditableTarget(e.target)) return;
  if(e.code===prefs.bindings.tactical&&hasGameControl()&&me?.alive){e.preventDefault();if(!e.repeat)tacticalHold.press();return;}
  if(tacticalHold.isOpen){e.preventDefault();if(e.code==='Escape'){tacticalHold.cancel();releaseGameControls();}else if(/^Digit[1-6]$/.test(e.code))tacticalHold.choose(Number(e.code.slice(-1))-1);return;}
  if(!me?.alive&&hasGameControl()&&['ArrowLeft','ArrowRight'].includes(e.code)){
    e.preventDefault();changeSpectator(e.code==='ArrowLeft'?-1:1);return;
  }
  if(e.code==="Escape" && hasGameControl()){
    e.preventDefault();releaseGameControls();return;
  }
  if(!hasGameControl()){
    if(e.code==="Escape"&&!$("buyMenu").hidden)closeShop(false);
    else if(e.code===prefs.bindings.buy&&!e.repeat&&!$("buyMenu").hidden)closeShop();
    return;
  }
  if (
    [
      prefs.bindings.scoreboard,
      prefs.bindings.jump,
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
    ].includes(e.code)
  )
    e.preventDefault();
  keys[e.code] = true;
  if (e.code === prefs.bindings.buy && !e.repeat && connected) {
    if (!$("buyMenu").hidden) closeShop();
    else openShop();
  }
  if (e.code === "Escape" && !$("buyMenu").hidden) closeShop(false);
  if (locked && !e.repeat && e.code === prefs.bindings.drop) {
    e.preventDefault();
    dropRequest = true;
    bombOnly = !!e.altKey;
  }
  if (locked && !e.repeat && e.code === prefs.bindings.interact)
    pickupRequest = true;
  if (locked && e.code === prefs.bindings.reload) reloadRequest = true;
  if(locked && ["rifle","pistol","knife","he","flash","smoke","fire"].some(a=>prefs.bindings[a]===e.code))wheelSelection=null;
  if (locked && e.code === prefs.bindings.rifle) weaponRequest = me?.inventory.find(w=>weaponSlot(w)==="primary") || null;
  if (locked && e.code === prefs.bindings.pistol) weaponRequest = me?.inventory.find(w=>weaponSlot(w)==="secondary") || null;
  if (locked && e.code === prefs.bindings.knife) weaponRequest = prefs.knifeModel;
  if (locked)
    for (const kind of ["he", "flash", "smoke", "fire"])
      if (e.code === prefs.bindings[kind]) grenadeRequest = kind;
  if (
    locked &&
    !e.repeat && e.code === prefs.bindings.inspect &&
    !e.repeat &&
    !me?.reload &&
    !me?.utility
  )
    getView(me?.weapon).userData.animations.play(
      "inspect",
    );
  if (e.code === prefs.bindings.scoreboard) $("scoreboard").hidden = false;
  if (!e.repeat) sendInput();
});
document.addEventListener("keyup", (e) => {
  if(e.code===prefs.bindings.tactical&&tacticalHold.release()){e.preventDefault();keys[e.code]=false;sendInput();return;}
  keys[e.code] = false;
  if (e.code === prefs.bindings.scoreboard) $("scoreboard").hidden = true;
  sendInput();
});
window.addEventListener("blur",()=>{if(mobile)releaseGameControls();});
window.addEventListener("focus",()=>{if(active&&!hasGameControl()&&!gameModalOpen())$("pause").hidden=false;});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&mobile)releaseGameControls();});
document.addEventListener("mousedown", (e) => {
  if(mobile)return;
  if(tacticalHold.isOpen){e.preventDefault();return;}
  if(e.button===1&&tacticalEnabled()){e.preventDefault();tacticalHold.cancel();sendTactical('ping');return;}
  if(hasGameControl()&&!me?.alive){if(e.button===0||e.button===2){changeSpectator(e.button===0?1:-1);return;}}
  if (hasGameControl() && e.button === 0) mouseFire = true;
  if (hasGameControl() && e.button === 2) { if(WEAPONS[me?.weapon]?.scope && !me.utility) {scoped=!scoped;sound("scope");} else mouseAlt=true; }
  sendInput();
});
document.addEventListener("auxclick",e=>{if(e.button===1&&hasGameControl())e.preventDefault();});
document.addEventListener("mouseup", (e) => {
  if(mobile)return;
  if (e.button === 0) mouseFire = false;
  if (e.button === 2) mouseAlt = false;
  sendInput();
});
let wheelAt=0,wheelSelection=null;
document.addEventListener("wheel",e=>{
 if(tacticalHold.isOpen){e.preventDefault();return;}
 if(!active||!connected||!hasGameControl()||!me?.alive||gameModalOpen()||!$("pause").hidden||!e.deltaY)return;
 e.preventDefault();
 if(me.reload||me.action)return;
 const now=performance.now();if(now-wheelAt<110)return;
 const selection=cycleSlot(me,prefs.knifeModel,e.deltaY,now-wheelAt<500?wheelSelection:null);
 if(!selection)return;wheelAt=now;wheelSelection=selection;
 if(selection.kind==='weapon'){weaponRequest=selection.id;grenadeRequest=null;}else{grenadeRequest=selection.id;weaponRequest=null;}
 scoped=false;sendInput();
},{passive:false});
document.addEventListener("contextmenu", (e) => e.preventDefault());
function openShop() {
  if (state?.phase !== "freeze" || !me?.alive) return;
  if(mobile)locked=false;
  $("buyMenu").hidden = false;
  $("pause").hidden = true;
  keys = {};
  mouseFire = false;
  mouseAlt = false;
  releaseGameControls();
  $("buyMessage").textContent =
    "Закупка доступна только во время подготовки на базе.";
  renderShop();
  showShopModel(me.weapon||"rifle");
}
function closeShop(lock = true) {
  $("buyMenu").hidden = true;
  if (lock) requestLock();
  else $("pause").hidden = false;
}
$("closeBuy").onclick = () => closeShop();
function renderShop() {
  if (!me) return;
  $("buyBalance").textContent = "$" + me.money;
  $("buyTimer").textContent="До конца закупки: "+Math.max(0,Math.ceil((state.until-Date.now()-netOffset)/1000))+" с · "+(me.team===state.attackTeam?"Т · АТАКА":"КТ · ЗАЩИТА");
  for (const button of $("buyItems").querySelectorAll("button[data-item]")) {
    const item = button.dataset.item,e=state.roundEvent||{},price=Math.round(SHOP[item].price*(e.price??1));
    button.querySelector("strong").textContent="$"+price;
    const reason=purchaseError(me,item,{phase:state.phase,roundEvent:e,map:currentMap,attackTeam:state.attackTeam});
    button.disabled=!!reason;
    button.title=reason||'Купить за $'+price;
    button.querySelector('.buyReason').textContent=reason||'Доступно';
  }
  if(!$("buyMenu").hidden)showShopModel(shopItem);
}
// Five-column supply grid, original SVG silhouettes and live model preview.
const categories={equipment:"Снаряжение",pistols:"Пистолеты",mid:"ПП",rifles:"Винтовки",grenades:"Гранаты"};
for(const [key,label] of Object.entries(categories)){
 const col=document.createElement("div");col.className="buyColumn";col.dataset.category=key;
 const h=document.createElement("h3");h.textContent=label;col.append(h);
 for(const [id,item] of Object.entries(SHOP)){
  const cat=item.category || (validUtility(id)?"grenades":"equipment"); if(cat!==key)continue;
  const b=document.createElement("button");b.dataset.item=id;b.innerHTML=`<span>${item.name}</span>${weaponSilhouette(id)}<strong>$${item.price}</strong><small class="buyReason"></small>`;
  b.onclick=()=>{if(connected)socket.send(JSON.stringify({type:"buy",item:id}));};
  b.onpointerenter=b.onfocus=()=>showShopModel(id);col.append(b);
 }$("buyItems").append(col);
}
function syncModels() {
  if (!state) return;
  for (const p of state.players) {
    if (p.id === myId) continue;
    const side=p.team===state.attackTeam?1:0;
    if(models.has(p.id)&&models.get(p.id).root.userData.side!==side){disposeOwnedTree(models.get(p.id).root);models.delete(p.id);}
    if (!models.has(p.id)) models.set(p.id, makePlayer(p));
    const m = models.get(p.id);
    m.root.visible = p.alive && p.id!==spectateId;
    applyWeaponSkin(m.root.userData.weapon, p.skins?.rifle || "standard");
    applyWeaponSkin(m.root.userData.sidearm, p.skins?.pistol || "standard");
    for (const [k, v] of Object.entries(m.root.userData.utilities))
      v.visible = p.utility === k;
    m.root.userData.weapon.visible = p.weapon === "rifle" && !p.utility;
    m.root.userData.sidearm.visible = p.weapon === "pistol" && !p.utility;
    m.extraWeapons ||= {};
    if(p.weapon && !["rifle","pistol"].includes(p.weapon) && !m.extraWeapons[p.weapon]){
      const w=buildWeapon(p.weapon); w.position.copy(m.root.userData.weapon.position);w.rotation.copy(m.root.userData.weapon.rotation);m.root.userData.body.add(w);m.extraWeapons[p.weapon]=w;
    }
    for(const [id,w] of Object.entries(m.extraWeapons)){w.visible=p.weapon===id&&!p.utility;applyWeaponSkin(w,p.skins?.[id]||"standard");}
    m.root.userData.bombPack.visible =
      state.bomb?.state === "carried" && state.bomb.carrier === p.id;
    m.target = p;
  }
  for (const [id, m] of models)
    if (!state.players.some((p) => p.id === id)) {
      disposeOwnedTree(m.root);
      models.delete(id);
    }
}
function hud() {
  if (!me) return;
  const actor=pov();
  document.querySelector('.topLeft .eyebrow').textContent=currentMap.name+' / '+currentMap.subtitle.split(' · ')[0];
  $("sideA").textContent=state.attackTeam===0?"Т":"КТ";$("sideB").textContent=state.attackTeam===1?"Т":"КТ";
  $("scoreA").textContent = state.score[0];
  $("scoreB").textContent = state.score[1];
  $("round").textContent = `РАУНД ${String(state.round).padStart(2, "0")}`;
  $("hp").textContent = actor.hp;
  $("hpBar").style.width = Math.min(100,100*actor.hp/(actor.maxHp||100)) + "%";
  $("ammo").textContent = WEAPONS[actor.weapon]?.melee?"∞":actor.ammo;
  $("reserve").textContent = WEAPONS[actor.weapon]?.melee?"НОЖ":"/ " + actor.reserve;
  if(actor.weapon) applyWeaponSkin(getView(actor.weapon).userData.weapon,actor.skins?.[actor.weapon]||"standard");
  $("eventBanner").textContent=state.mode==="events" ? "РАНДОМНЫЕ ИВЕНТЫ · "+state.roundEvent.name+" — "+state.roundEvent.description : "";
  const eventRules=state.roundEvent||{};
  scene.fog.density = eventRules.fog ?? .009;
  scene.background.set(eventRules.sky||currentMap.theme.sky);scene.fog.color.set(eventRules.fogColor||currentMap.theme.fog);sun.color.set(eventRules.sun||currentMap.theme.sun);
  $("weaponName").textContent = actor.utility
    ? UTILITY[actor.utility].name
    : WEAPONS[actor.weapon]?.name || "БЕЗ ОРУЖИЯ";
  if (actor.utility) {
    $("ammo").textContent = actor.grenades[actor.utility];
    $("reserve").textContent = " / ЛКМ далеко · ПКМ близко";
  }
  $("utilityInventory").textContent = Object.entries(actor.grenades || {})
    .map(([k, n], i) => `${i + 4} ${k.toUpperCase()} ×${n}`)
    .join("  ·  ");
  $("equippedSkin").textContent = actor.utility
    ? "ГРАНАТА · ЛКМ / ПКМ"
    : actor.weapon
      ? "РАСКРАСКА · " + (SKINS[actor.skins?.[actor.weapon]]?.name || "Factory")
      : "";
  applyWeaponSkin(rifleView.userData.weapon, actor.skins?.rifle || "standard");
  applyWeaponSkin(pistolView.userData.weapon, actor.skins?.pistol || "standard");
  $("reloadText").textContent = actor.reload
    ? "ПЕРЕЗАРЯДКА…"
    : (actor.inventory || [])
        .filter(w=>weaponSlot(w)!=="knife"||w===prefs.knifeModel)
        .map((w) => (weaponSlot(w)==="primary"?"1 ":weaponSlot(w)==="knife"?"3 ":"2 ")+WEAPONS[w].name)
        .join("  ·  ");
  $("equipment").textContent =
    `$${me.money} · БРОНЯ ${actor.armor}${actor.helmet ? " + ШЛЕМ" : ""}${actor.kit ? " · НАБОР" : ""}`;
  $("role").textContent =
    actor.team === state.attackTeam
      ? "АТАКА · УСТАНОВИ БОМБУ НА A / B"
      : "ЗАЩИТА · НЕ ДАЙ УСТАНОВИТЬ БОМБУ";
  renderShop();
  if (state.phase !== "freeze" && !$("buyMenu").hidden) closeShop(false);
  $("teamName").textContent =
    (spectateId?"НАБЛЮДЕНИЕ · ":sideLabel(actor.team,state.attackTeam)+" / ")+actor.name;
  const rows = $("rows");
  rows.replaceChildren();
  const header = document.createElement("div");
  header.className = "row";
  for (const t of ["ОПЕРАТОР", "КОМАНДА", "K", "D"]) {
    const s = document.createElement("span");
    s.textContent = t;
    header.append(s);
  }
  rows.append(header);
  for (const p of [...state.players].sort(
    (a, b) => a.team - b.team || b.kills - a.kills,
  )) {
    const row = document.createElement("div");
    row.className = "row" + (p.id === myId ? " you" : "");
    for (const t of [
      p.name + (p.bot ? " [AI]" : "") + (!p.alive ? " †" : ""),
      sideLabel(p.team,state.attackTeam),
      p.kills,
      p.deaths,
    ]) {
      const s = document.createElement("span");
      s.textContent = t;
      row.append(s);
    }
    rows.append(row);
  }
}
const ctx = $("radar").getContext("2d");
function radar() {
  const scale=Math.min(150/currentMap.w,188/currentMap.d);
  ctx.clearRect(0, 0, 180, 214);
  ctx.fillStyle = "#162c39";
  ctx.fillRect(12, 10, 156, 194);
  ctx.fillStyle = "#50616c";
  for (const b of currentMap.boxes)
    ctx.fillRect(
      90 + (b[0] - b[2] / 2) * scale,
      107 + (b[1] - b[3] / 2) * scale,
      b[2] * scale,
      b[3] * scale,
    );
  if (!state || !me) return;
  tacticalHUD.radar(ctx,scale);
  ctx.font = "bold 12px Arial";
  for (const site of currentMap.sites) {
    ctx.fillStyle = "#e7b16c";
    ctx.fillText(site.id, 86 + site.x * scale, 112 + site.z * scale);
  }
  if (["dropped", "planted"].includes(state.bomb?.state)) {
    ctx.fillStyle = "#ff654a";
    ctx.fillRect(87 + state.bomb.x * scale, 104 + state.bomb.z * scale, 6, 6);
  }
  for (const p of state.players) {
    if (!p.alive || p.team !== me.team) continue;
    const x = 90 + p.x * scale,
      y = 107 + p.z * scale;
    ctx.fillStyle = p.id === myId ? "#ffffff" : "#8ef2e8";
    ctx.beginPath();
    ctx.arc(x, y, p.id === myId ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (p.id === myId) {
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(yaw) * 12, y - Math.cos(yaw) * 12);
      ctx.stroke();
    }
  }
}
let lastRender = 0,
  fpsSample = 0,
  fpsFrames = 0,
  wasReloading = false,
  lastEquipped = null;
function animate(time) {
  requestAnimationFrame(animate);
  gameAudio.update();
  if(diagnostics.failed||document.hidden){lastTime=time;return;}
  const interval = prefs.frameCap ? 1000 / prefs.frameCap : 0;
  if (interval && time - lastRender < interval - 0.5) return;
  lastRender = interval ? time - ((time - lastRender) % interval) : time;
  fpsFrames++;
  if (time - fpsSample >= 800) {
    $("fpsCounter").textContent =
      Math.round((fpsFrames * 1000) / (time - fpsSample)) + " FPS";
    fpsFrames = 0;
    fpsSample = time;
  }
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  clock += dt;
  kick = Math.max(0, kick - dt * 0.15);
  flashTime -= dt;
  hitTime -= dt;
  damageTime -= dt;
  if (active && state && me) {
    const actor=pov();
    const viewScoped=spectateId?!!actor.scoped:scoped;
    const now = Date.now() + netOffset,
      flashAlpha = flashOpacity(actor?.flash,now);
    $("flashBlind").style.opacity = flashAlpha;
    $("blindLabel").hidden = flashAlpha < 0.08;
    utilityFX.update(clock, dt, now, yaw);
    const left = Math.max(
      0,
      Math.ceil(
        ((state.bomb?.state === "planted"
          ? state.bomb.explodeAt
          : state.until) -
          now) /
          1000,
      ),
    );
    $("timer").textContent =
      `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    let title = "",
      sub = "";
    if (state.phase === "freeze") {
      title = "ЗАКУПКА · B";
      sub = `${sideLabel(me.team,state.attackTeam)} / НАЧАЛО ЧЕРЕЗ ${left}`;
    } else if (state.phase === "end" || state.phase === "match") {
      const alive = [0, 0];
      state.players.forEach((p) => {
        if (p.alive) alive[p.team] += p.hp;
      });
      let winner = state.roundWinner;
      title = sideLabel(winner,state.attackTeam) + " — ПОБЕДА";
      sub =
        state.phase === "match"
          ? "МАТЧ ЗАВЕРШЁН · ESC → НОВЫЙ МАТЧ ИЛИ МЕНЮ"
          : "СЛЕДУЮЩИЙ РАУНД ЧЕРЕЗ " + left;
    } else if (!me.alive) {
      title = "ТЫ ВЫБЫЛ";
      sub = spectateId ? "НАБЛЮДЕНИЕ: "+actor.name+" · ← / → ИЛИ ЛКМ / ПКМ — СОЮЗНИК" : "НЕТ ЖИВЫХ СОЮЗНИКОВ · СЛЕДУЮЩИЙ РАУНД";
    }
    $("announceTitle").textContent = title;
    $("announceSub").textContent = sub;
    const f = locked ? mobile ? touchMove.forward : Number(down("forward")) - Number(down("back")) : 0,
      s = locked ? mobile ? touchMove.side : Number(down("right")) - Number(down("left")) : 0;
    const b = state.bomb;
    let prompt = "";
    if (b.state === "carried" && b.carrier === myId)
      prompt = atSite(me,currentMap.sites)
        ? "УДЕРЖИВАЙ E · УСТАНОВКА (3 с)"
        : "БОМБА У ТЕБЯ · A / B · Alt+G выбросить";
    if (b.state === "dropped")
      prompt =
        me.team === state.attackTeam
          ? "БОМБА ПОТЕРЯНА · E рядом для подбора"
          : "БОМБА ПОТЕРЯНА АТАКОЙ";
    if (b.state === "planted") {
      prompt =
        `БОМБА НА ${b.site} · ${left} с` +
        (me.team !== state.attackTeam
          ? " · удерживай E рядом для разминирования"
          : " · защити бомбу");
      if (now > nextBeep && state.phase === "live") {
        sound("beep",{pos:{x:b.x,y:.2,z:b.z},gain:.34,cooldown:.08});
        nextBeep = now + Math.max(120, left * 24);
      }
      bombLight.visible = Math.floor(now / 220) % 2 === 0;
    }
    const nearest = (state.drops || []).find(
      (d) =>
        Math.hypot(d.x - me.x, d.z - me.z) < 1.8 && Math.abs(me.y-eyeHeight(me)-(d.y||0))<1.1 &&
        (d.kind === "utility"
          ? utilityCount(me) < 4 &&
            me.grenades[d.utility] < UTILITY[d.utility].max
          : !me.inventory.includes(d.weapon)),
    );
    if (nearest)
      prompt +=
        " · E подобрать " +
        (nearest.kind === "utility"
          ? UTILITY[nearest.utility].name
          : WEAPONS[nearest.weapon].name);
    if (state.phase === "freeze")
      prompt =
        "B · ЗАКУПКА · " +
        (state.round === state.rules.halfRounds + 1
          ? "СМЕНА СТОРОН · НОВАЯ ЭКОНОМИКА"
          : "ДЕНЬГИ И СНАРЯЖЕНИЕ СОХРАНЯЮТСЯ");
    if (state.phase === "end" || state.phase === "match")
      prompt =
        {
          elimination: "КОМАНДА УНИЧТОЖЕНА",
          timeout: "ВРЕМЯ ВЫШЛО",
          exploded: "БОМБА ВЗОРВАНА",
          defused: "БОМБА ОБЕЗВРЕЖЕНА",
        }[state.reason] || "";
    $("objectiveText").textContent = me.alive
      ? prompt
      : state.phase === "live"
        ? "НАБЛЮДЕНИЕ · СЛЕДУЮЩИЙ РАУНД СКОРО"
        : prompt;
    $("actionProgress").hidden = !me.action;
    if (me.action) {
      $("actionLabel").textContent =
        me.action.kind === "plant" ? "УСТАНОВКА" : "РАЗМИНИРОВАНИЕ";
      $("actionFill").style.width =
        clamp(
          ((now - me.action.startedAt) / me.action.duration) * 100,
          0,
          100,
        ) + "%";
    }
    if (me.alive && state.phase === "live") {
      const predicted = {
        x: viewPos.x,
        y: viewPos.y, crouch:me.crouch, vy:me.grounded?0:1,
        z: viewPos.z,
        yaw,
        vx: prediction.vx,
        vz: prediction.vz,
        eventSpeed:state?.roundEvent?.speed || 1,
        eventAcceleration:state?.roundEvent?.acceleration || 1,
      };
      accelerate(
        predicted,
        {
          forward: f,
          side: s,
          slow: down("slow"),
          crouch: down("crouch"),
        },
        dt, currentMap.boxes,
      );
      prediction.vx = predicted.vx;
      prediction.vz = predicted.vz;
      viewPos.x = predicted.x;
      viewPos.z = predicted.z;
    }
    viewPos.x = THREE.MathUtils.damp(viewPos.x, me.x, 10, dt);
    viewPos.z = THREE.MathUtils.damp(viewPos.z, me.z, 10, dt);
    viewPos.y = THREE.MathUtils.damp(viewPos.y, me.y, 20, dt);
    if (Math.hypot(viewPos.x - me.x, viewPos.z - me.z) > 3)
      viewPos.set(me.x, me.y, me.z);
    camera.position.copy(viewPos);
    if(spectateId){
      if(spectateCameraId!==spectateId)spectatePos.set(actor.x,actor.y,actor.z);
      spectatePos.lerp(new THREE.Vector3(actor.x,actor.y,actor.z),1-Math.exp(-dt*24));
      camera.position.copy(spectatePos);
    }
    spectateCameraId=spectateId;

    camera.rotation.set(
      (spectateId?actor.pitch:pitch) + (actor.recoil?.pitch || 0) + kick * 0.15,
      (spectateId?actor.yaw:yaw) + (actor.recoil?.yaw || 0),
      Math.sin(clock * 9) * 0.001 * Math.abs(f),
    );
    camera.fov = THREE.MathUtils.damp(
      camera.fov,
      viewScoped && WEAPONS[actor.weapon]?.scope ? 24 : down("slow") ? prefs.fov - 4 : prefs.fov,
      8,
      dt,
    );
    camera.updateProjectionMatrix();
    if (connected && time - lastSent > 1000 / 60) {
      lastSent = time;
      sendInput();
    }
    const sway = spectateId?Math.min(1,Math.hypot(actor.vx||0,actor.vz||0)/5.2):Math.abs(f)+Math.abs(s);
    const handSign = prefs.hand === "left" ? -1 : 1;
    gun.position.set(
      handSign * (prefs.handX + Math.sin(clock * 8) * 0.004 * sway * prefs.bob),
      prefs.handY - kick + Math.cos(clock * 16) * 0.003 * sway * prefs.bob,
      prefs.handZ,
    );
    gun.rotation.set(kick * 1.5, 0, 0);
    gun.scale.set(handSign, 1, 1);
    const shownUtility =
      actor.utility ||
      (throwView && clock < throwView.until ? throwView.kind : null);
    const equipped = shownUtility || actor.weapon;
    if (equipped !== lastEquipped) {
      scoped=false;
      for (const view of Object.values(weaponViews)) {
        if(view.userData.animations.reset)view.userData.animations.reset('weapon-switch');
        else for (const a of Object.values(view.userData.animations.actions))a.stop();
      }
      if (!actor.utility)
        getView(actor?.weapon).userData.animations.play("equip");
      if(lastEquipped)sound("equip");
      lastEquipped = equipped;
      wasReloading = false;
    }
    if (actor.reload && !wasReloading && !actor.utility)
      getView(actor?.weapon).userData.animations.play("reload");
    if (!actor.reload && wasReloading)
      for (const view of Object.values(weaponViews))
        view.userData.animations.actions.reload?.stop();
    wasReloading = !!actor.reload;
    for (const view of Object.values(weaponViews))
      view.userData.animations.mixer.update(dt);
    for(const [id,v] of Object.entries(weaponViews)) v.visible = id===actor.weapon && !shownUtility;
    if(actor.weapon) getView(actor.weapon).visible=!shownUtility;
    for (const [k, v] of Object.entries(utilityViews)) {
      v.visible = shownUtility === k;
      v.userData.animations.update(dt);
    }
    if(actor.weapon&&!WEAPONS[actor.weapon]?.melee){
      const w=getView(actor.weapon).userData.weapon;
      gun.updateMatrixWorld(true);
      flash.position.copy(gun.worldToLocal(w.localToWorld(w.userData.muzzle.clone())));
    }
    const gap = prefs.crossGap + (prefs.crossDynamic ? (actor.spread || 0.002) * 260 : 0);
    $("crosshair").style.setProperty("--gap", gap + "px");
    flash.visible = flashTime > 0 && !!actor.weapon && !WEAPONS[actor.weapon]?.melee && !shownUtility;
    flash.material.rotation = clock * 20;
    $("hitmarker").style.opacity = hitTime > 0 ? 1 : 0;
    $("damage").style.opacity = Math.max(0, damageTime) * 1.8;
    $("crosshair").hidden = !actor.alive || (viewScoped && !!WEAPONS[actor.weapon]?.scope);
    $("scopeOverlay").hidden = !actor.alive || !viewScoped || !WEAPONS[actor.weapon]?.scope;
    radar();
    for (const m of models.values()) {
      const p = m.target;
      m.root.visible=!!p?.alive&&p.id!==spectateId;
      if (!p) continue;
      const pos = m.root.position;
      if (!m.initial) {
        pos.set(p.x, p.y - eyeHeight(p), p.z);
        m.initial = true;
      }
      const moving = Math.hypot(p.x - pos.x, p.z - pos.z) > 0.025;
      pos.lerp(
        new THREE.Vector3(p.x, p.y - eyeHeight(p), p.z),
        1 - Math.exp(-dt * 16),
      );
      m.root.rotation.y = p.yaw;
      const speed = Math.hypot(p.vx || 0, p.vz || 0) || (moving ? 3.4 : 0);
      m.root.userData.update(dt, {
        speed,
        crouching: p.crouch,
        airborne: p.grounded===false,
        pitch: p.pitch || 0,
        reload: !!p.reload,
        shot: Math.max(0, (m.shotUntil || 0) - clock) / 0.18,
      });
    }
  } else {
    const a = 0.65 + Math.sin(clock * 0.04) * 0.15;
    camera.position.set(Math.sin(a) * 36, 23, Math.cos(a) * 36);
    camera.lookAt(0, 1, 0);
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  if (feed.length && clock - feed[feed.length - 1].at > 6) {
    feed.pop();
    renderFeed();
  }
  if(!$("buyMenu").hidden)shopPreview?.render(clock);
  renderer.autoClear = true;
  camera.updateMatrixWorld();
  tacticalHUD.update(pos=>{const v=new THREE.Vector3(pos.x,pos.y+.2,pos.z);const ahead=v.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));if(ahead<=0)return null;v.project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,z:(v.z+1)/2};},camera.position,active&&connected);
  postFX.begin();
  if (active) renderer.render(scene, camera);
  else {
    lobby.update(clock, dt);
    if (!$("pane-inventory").hidden) {
      inventoryUI.update(clock);
      renderer.render(inventoryUI.scene, inventoryUI.camera);
    } else if (settingsUI.preview()) {
      for(const [id,v] of Object.entries(weaponViews))v.visible=id==='rifle';
      for (const v of Object.values(utilityViews)) v.visible = false;
      gun.position.set(
        (prefs.hand === "left" ? -1 : 1) * prefs.handX + (innerWidth<700?0:0.55),
        prefs.handY + (innerWidth<700?.12:.04),
        prefs.handZ,
      );
      gun.rotation.set(0, 0, 0);
      gun.scale.set(prefs.hand === "left" ? -1 : 1, 1, 1);
      renderer.setClearColor("#132731");
      renderer.clear();
      renderer.render(weaponScene, gunCam);
    } else renderer.render(lobby.scene, lobby.camera);
  }
  if (active && pov()?.alive && !((spectateId?pov().scoped:scoped) && WEAPONS[pov().weapon]?.scope)) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(weaponScene, gunCam);
  }
  postFX.end(prefs);
}
requestAnimationFrame(animate);
window.addEventListener("resize", () => {
  camera.aspect = gunCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  gunCam.updateProjectionMatrix();
  applyGraphics(prefs);
});

// Match-only social channel; messages are rendered as text, never HTML.
const chatPanel=document.createElement("section");chatPanel.id="matchChat";chatPanel.hidden=true;
chatPanel.innerHTML='<header>ЧАТ МАТЧА <span id="netStatus"></span></header><div id="matchChatLines" aria-live="polite"></div><form id="matchChatForm"><input id="matchChatText" maxlength="180" placeholder="Сообщение в матч…" aria-label="Сообщение"><button>↗</button></form>';
document.body.append(chatPanel);
function addChat(name,text,senderId){chatNotices.notify({scope:"match",senderId,name,text,mine:senderId?senderId===myId:name===me?.name,visible:!chatPanel.hidden});const row=document.createElement("p");const b=document.createElement("b");b.textContent=name+": ";row.append(b,document.createTextNode(text));$("matchChatLines").append(row);while($("matchChatLines").children.length>30)$("matchChatLines").firstChild.remove();$("matchChatLines").scrollTop=100000;}
$("matchChatForm").onsubmit=e=>{e.preventDefault();if(connected&&$("matchChatText").value.trim())socket.send(JSON.stringify({type:"chat",text:$("matchChatText").value}));$("matchChatText").value="";};
const chatToggle=document.createElement("button");chatToggle.id="chatToggle";chatToggle.textContent="ЧАТ";chatToggle.onclick=()=>{chatPanel.hidden=!chatPanel.hidden;if(!chatPanel.hidden){chatNotices.markRead("match");releaseGameControls();$("matchChatText").focus();}else if(active)requestLock();};document.body.append(chatToggle);
const invite=document.createElement("button");invite.className="secondary";invite.textContent="ПРИГЛАШЕНИЕ ПО АДРЕСУ";invite.onclick=()=>{const addr=$("shareAddress").value;if(!addr){$("hostMessage").textContent="Сначала открой LAN. Для интернета требуется доступный сервер или VPN.";return;}const text="VOIDLINE · подключись к "+addr;navigator.clipboard?.writeText(text).then(()=>$("hostMessage").textContent="Приглашение скопировано").catch(()=>$("hostMessage").textContent=text);};$("hostPanel").append(invite);
const socialButtonText=$('openSocial').textContent;
const chatNotices=createChatNotices({onSound:()=>{audioInit();sound('chat');},onOpen:(scope,id)=>{
 if(scope==='p2p'){releaseGameControls();window.dispatchEvent(new CustomEvent('voidline-open-peer',{detail:{id}}));}
 else if(chatPanel.hidden)chatToggle.click();
},onUnread:counts=>{chatToggle.textContent=counts.match?'ЧАТ · '+counts.match:'ЧАТ';chatToggle.classList.toggle('hasUnread',counts.match>0);$('openSocial').textContent=socialButtonText+(counts.p2p?' · '+counts.p2p:'');$('openSocial').classList.toggle('hasUnread',counts.p2p>0);}});
window.addEventListener('voidline-chat-message',e=>chatNotices.notify(e.detail));
window.addEventListener('voidline-chat-read',e=>chatNotices.markRead(e.detail.scope,e.detail.id));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.hasFocus()&&!chatPanel.hidden)chatNotices.markRead('match');});
setInterval(()=>{chatToggle.hidden=!active;if(!active)chatPanel.hidden=true;if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:"ping",sent:Date.now()}));},2000);
// Android and touch-screen controls use the same authoritative server input.
if(mobile){
 document.body.classList.add("touchClient");
 const touch=document.createElement("div");touch.id="touchControls";touch.innerHTML='<div id="lookPad"></div><div id="movePad"><i></i></div><div class="touchActions"><button data-touch="fire">ОГОНЬ</button><button data-touch="scope">ПРИЦЕЛ</button><button data-touch="reload">R</button><button data-touch="jump">↑</button><button data-touch="crouch">↓</button><button data-touch="interact">E</button><button data-touch="weapon">1 / 2</button><button data-touch="knife">НОЖ</button><button data-touch="inspect">F</button><button data-touch="grenade">ГР</button><button data-touch="buy">B</button><button data-touch="pause">Ⅱ</button></div>';document.body.append(touch);
 let moveId=null,lookId=null,lookX=0,lookY=0;
 const reset=()=>{touchMove={forward:0,side:0};mouseFire=mouseAlt=false;keys={};$("movePad").querySelector("i").style.transform="translate(0,0)";sendInput();};
 const pad=$("movePad");pad.onpointerdown=e=>{moveId=e.pointerId;pad.setPointerCapture(e.pointerId);};
 pad.onpointermove=e=>{if(e.pointerId!==moveId)return;const r=pad.getBoundingClientRect(),x=clamp((e.clientX-r.x-r.width/2)/45,-1,1),y=clamp((e.clientY-r.y-r.height/2)/45,-1,1);touchMove={side:x,forward:-y};pad.querySelector("i").style.transform=`translate(${x*32}px,${y*32}px)`;};
 pad.onpointerup=pad.onpointercancel=e=>{moveId=null;reset();};
 const look=$("lookPad");look.onpointerdown=e=>{lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture(e.pointerId);};look.onpointermove=e=>{if(e.pointerId!==lookId||!locked||!me?.alive)return;const sensitivity=prefs.sensitivity*(scoped && WEAPONS[me?.weapon]?.scope ? prefs.scopeSensitivity : 1);yaw-=(e.clientX-lookX)*.004*sensitivity;pitch=clamp(pitch-(e.clientY-lookY)*.004*sensitivity*(prefs.invertY?-1:1),-Math.PI/2+.01,Math.PI/2-.01);lookX=e.clientX;lookY=e.clientY;};look.onpointerup=look.onpointercancel=()=>{lookId=null;};
 for(const b of touch.querySelectorAll("button")){
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);const a=b.dataset.touch;
   if(a==="fire")mouseFire=true;
   else if(["jump","crouch","interact"].includes(a)){keys[prefs.bindings[a]]=true;if(a==="interact")pickupRequest=true;}
   else if(a==="reload")reloadRequest=true;
   else if(a==="scope"){if(me?.utility){mouseAlt=true;}else {scoped=!scoped;sound("scope");}}
   else if(a==="weapon")weaponRequest=me?.inventory.find(w=>["primary","secondary"].includes(weaponSlot(w))&&weaponSlot(w)!==weaponSlot(me.weapon));
   else if(a==="knife")weaponRequest=prefs.knifeModel;
   else if(a==="inspect")getView(me?.weapon).userData.animations.play("inspect");
   else if(a==="grenade"){const list=Object.keys(UTILITY).filter(k=>me?.grenades[k]);grenadeRequest=list[(list.indexOf(me?.utility)+1)%list.length];}
   else if(a==="buy")openShop();
   else if(a==="pause"){locked=false;$("pause").hidden=false;reset();}
   sendInput();
  };b.onpointerup=b.onpointercancel=e=>{const a=b.dataset.touch;if(a==="fire")mouseFire=false;if(a==="scope")mouseAlt=false;if(prefs.bindings[a])keys[prefs.bindings[a]]=false;sendInput();};
 }
 window.addEventListener("blur",reset);document.addEventListener("visibilitychange",()=>{if(document.hidden)reset();});
 setInterval(()=>touch.hidden=!active||!locked||settingsUI.isOpen()||!$("buyMenu").hidden,100);
}

try{if(localStorage.getItem("voidline.server"))$("address").value=localStorage.getItem("voidline.server");}catch{}
if(new URLSearchParams(location.search).has("android")){
 $("status").textContent="Android · Подключение к серверу на ПК по IP:порту · Только альбомный режим";
 $("address").placeholder="192.168.1.10:3080 · сервер на ПК";
 $("createOpen").hidden=true;
 if(!localStorage.getItem("voidline.settings.v1")){localStorage.setItem("voidline.settings.v1",JSON.stringify({...DEFAULTS,frameCap:60,renderScale:.75,shadows:"low"}));}
}

const voiceStatus=document.createElement("span");voiceStatus.id="voiceStatus";voiceStatus.textContent="Микрофон выключен";
const voiceButton=document.createElement("button");voiceButton.id="voiceButton";voiceButton.className="secondary";voiceButton.textContent="ВКЛЮЧИТЬ МИКРОФОН";
const voice=createVoice({send:m=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(m));},myId:()=>myId,status:text=>{voiceStatus.textContent=text;if(text==="Микрофон выключен")voiceButton.textContent="ВКЛЮЧИТЬ МИКРОФОН";}});
voiceButton.onclick=async()=>{try{const on=await voice.toggle();voiceButton.textContent=on?"ВЫКЛЮЧИТЬ МИКРОФОН":"ВКЛЮЧИТЬ МИКРОФОН";}catch(e){voiceStatus.textContent=e.message;}};
$("pauseSocial").after(voiceButton,voiceStatus);document.addEventListener("visibilitychange",()=>{if(document.hidden)voice.stop();});
