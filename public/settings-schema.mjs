export const ACTIONS = {
  forward: ["Вперёд", "KeyW"],
  back: ["Назад", "KeyS"],
  left: ["Влево", "KeyA"],
  right: ["Вправо", "KeyD"],
  jump: ["Прыжок", "Space"],
  slow: ["Медленный шаг", "ShiftLeft"],
  crouch: ["Приседание", "ControlLeft"],
  interact: ["Действие / подбор", "KeyE"],
  reload: ["Перезарядка", "KeyR"],
  drop: ["Выбросить", "KeyG"],
  rifle: ["Винтовка", "Digit1"],
  pistol: ["Пистолет", "Digit2"],
  knife: ["Нож", "Digit3"],
  he: ["Осколочная", "Digit4"],
  flash: ["Светошумовая", "Digit5"],
  smoke: ["Дымовая", "Digit6"],
  fire: ["Зажигательная", "Digit7"],
  buy: ["Закупка", "KeyB"],
  scoreboard: ["Счёт", "Tab"],
  inspect: ["Осмотр оружия", "KeyF"],
  tactical: ["Метка / быстрые команды (удерживать)", "KeyV"],
};
export const DEFAULTS = Object.freeze({
  version: 2,
  crossSize: 7, crossGap: 4, crossThickness: 2, crossOpacity: 1,
  crossColor: "#95ed4a", crossDot: false, crossOutline: true, crossDynamic: false,
  sensitivity: 1,
  scopeSensitivity: 1,
  knifeModel: "butterfly",
  volume: 0.7,
  invertY: false,
  hand: "right",
  handX: 0,
  handY: 0,
  handZ: 0,
  viewFov: 65,
  bob: 0.65,
  gloves: "graphite",
  fov: 77,
  frameCap: 144,
  renderResolution: "native",
  renderScale: 1,
  windowMode: "windowed",
  shadows: "medium",
  aa: "fxaa",
  exposure: 1.15,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpness: 0.15,
  vignette: 0.25,
  bindings: Object.fromEntries(
    Object.entries(ACTIONS).map(([k, v]) => [k, v[1]]),
  ),
});
const ranges = {
  crossSize:[2,20], crossGap:[0,20], crossThickness:[1,6], crossOpacity:[0.2,1],
  sensitivity: [0.1, 5],
  scopeSensitivity: [0.1, 3],
  volume: [0, 1],
  handX: [-0.15, 0.15],
  handY: [-0.15, 0.12],
  handZ: [-0.15, 0.15],
  viewFov: [50, 85],
  bob: [0, 1],
  fov: [65, 105],
  renderScale: [0.5, 1.5],
  exposure: [0.6, 1.8],
  brightness: [0.7, 1.3],
  contrast: [0.7, 1.4],
  saturation: [0, 1.5],
  sharpness: [0, 1],
  vignette: [0, 0.7],
};
const enums = {
  knifeModel: ["butterfly", "karambit", "m9"],
  crossColor:["#95ed4a","#ffffff","#55ddff","#ffcf55","#ff55a8"],
  hand: ["right", "left"],
  gloves: ["graphite", "sand", "olive", "arctic"],
  frameCap: [0, 60, 75, 90, 120, 144, 165, 180, 240, 360],
  renderResolution: [
    "native",
    "1280x720",
    "1600x900",
    "1920x1080",
    "2560x1440",
    "3840x2160",
  ],
  windowMode: ["windowed", "borderless"],
  shadows: ["off", "low", "medium", "high"],
  aa: ["off", "fxaa", "msaa"],
};
export const validKey = (c) =>
  typeof c === "string" &&
  /^(Key[A-Z]|Digit[0-9]|Space|Tab|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock|Home|End|PageUp|PageDown|Insert|Delete)$/.test(
    c,
  );
export function normalizeSettings(input) {
  const s = { ...DEFAULTS, bindings: { ...DEFAULTS.bindings } };
  if (!input || typeof input !== "object" || Array.isArray(input)) return s;
  for (const [k, [lo, hi]] of Object.entries(ranges))
    if (typeof input[k] === "number" && Number.isFinite(input[k]))
      s[k] = Math.min(hi, Math.max(lo, input[k]));
  for (const [k, values] of Object.entries(enums))
    if (values.includes(input[k])) s[k] = input[k];
  for (const k of ["crossDot","crossOutline","crossDynamic"]) if (typeof input[k] === "boolean") s[k]=input[k];
  if (typeof input.invertY === "boolean") s.invertY = input.invertY;
  if (input.bindings && typeof input.bindings === "object") {
    const desired = Object.fromEntries(
      Object.keys(ACTIONS).map((k) => [
        k,
        validKey(input.bindings[k]) ? input.bindings[k] : DEFAULTS.bindings[k],
      ]),
    );
    // Keep bindings bijective even after editing a file by hand.
    const used = new Set();
    for (const k of Object.keys(ACTIONS)) {
      let key = desired[k];
      if (used.has(key))
        key = [
          DEFAULTS.bindings[k],
          ...Object.values(DEFAULTS.bindings),
          ...Array.from(
            { length: 26 },
            (_, i) => "Key" + String.fromCharCode(65 + i),
          ),
        ].find((c) => !used.has(c));
      s.bindings[k] = key;
      used.add(key);
    }
  }
  return s;
}
export function rebind(settings, action, code) {
  if (!Object.hasOwn(ACTIONS, action) || !validKey(code))
    throw Error("Эта клавиша недоступна");
  const s = normalizeSettings(settings);
  const other = Object.keys(ACTIONS).find((k) => s.bindings[k] === code);
  if (other && other !== action) s.bindings[other] = s.bindings[action];
  s.bindings[action] = code;
  return s;
}
export function keyLabel(code) {
  return (
    {
      Space: "Пробел",
      ControlLeft: "L Ctrl",
      ControlRight: "R Ctrl",
      ShiftLeft: "L Shift",
      ShiftRight: "R Shift",
      AltLeft: "L Alt",
      AltRight: "R Alt",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
    }[code] || code.replace(/^Key|^Digit/, "")
  );
}
export function actionDown(keys, settings, action) {
  return !!keys[settings.bindings[action]];
}
export function renderSize(settings, width, height, dpr = 1, pixelBudget = 8294400) {
  let w = width,
    h = height;
  if (settings.renderResolution !== "native")
    [w, h] = settings.renderResolution.split("x").map(Number);
  else {
    w *= Math.min(dpr, 2);
    h *= Math.min(dpr, 2);
  }
  w=Math.max(320,Math.round(w*settings.renderScale));h=Math.max(180,Math.round(h*settings.renderScale));
  const scale=Math.min(1,4096/w,4096/h,Math.sqrt(pixelBudget/(w*h)));
  return {width:Math.max(320,Math.floor(w*scale)),height:Math.max(180,Math.floor(h*scale))};
}
