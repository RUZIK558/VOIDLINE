import {
  DEFAULTS,
  ACTIONS,
  normalizeSettings,
  rebind,
  keyLabel,
} from "./settings-schema.mjs";
import {paintCrosshair} from "./crosshair.mjs";
import { icon } from "./icons.mjs";
export function setupSettingsUI({ onChange, onOpen, onClose }) {
  let settings = normalizeSettings(null),
    loading = true,
    tab = "display",
    binding = null,
    revision = 0,
    displayInfo = null,
    saveTimer,
    confirmTimer;
  const $ = (id) => document.getElementById(id);
  const dialog = document.createElement("div");
  dialog.id = "settingsDialog";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "settingsTitle");
  dialog.innerHTML = `<section class="settingsShell"><header><div><span class="eyebrow">VOIDLINE / CONTROL ROOM</span><h2 id="settingsTitle">НАСТРОЙКИ</h2></div><button id="settingsClose" class="iconButton secondary" aria-label="Закрыть настройки">${icon("close")}</button></header><div class="settingsBody"><nav class="settingsTabs" aria-label="Категории настроек"></nav><div class="settingsContent"></div></div><footer><span id="settingsStatus" role="status">Загрузка настроек…</span><button id="resetSettings" class="secondary">${icon("reset")} СБРОСИТЬ РАЗДЕЛ</button></footer></section>`;
  document.body.append(dialog);
  const tabs = {
    display: ["display", "Экран"],
    image: ["image", "Изображение"],
    hands: ["hands", "Руки и оружие"],
    controls: ["mouse", "Управление"],
    crosshair: ["settings", "Прицел"],
    audio: ["audio", "Звук"],
  };
  const definitions = {
    display: [
      [
        "windowMode",
        "Режим окна",
        "select",
        [
          ["windowed", "Оконный"],
          ["borderless", "Полный экран без рамки"],
        ],
      ],
      [
        "renderResolution",
        "Разрешение рендера",
        "select",
        [
          ["native", "Как у окна"],
          ...[
            "1280x720",
            "1600x900",
            "1920x1080",
            "2560x1440",
            "3840x2160",
          ].map((v) => [v, v.replace("x", " × ")]),
        ],
      ],
      ["renderScale", "Масштаб рендера", "range", 0.5, 1.5, 0.05],
      [
        "frameCap",
        "Лимит кадров / FPS",
        "select",
        [
          [0, "Без лимита"],
          ...[60, 75, 90, 120, 144, 165, 180, 240, 360].map((v) => [
            v,
            v + " FPS",
          ]),
        ],
      ],
      ["fov", "Поле зрения / FOV", "range", 65, 105, 1],
    ],
    image: [
      [
        "shadows",
        "Качество теней",
        "select",
        [
          ["off", "Выключены"],
          ["low", "Низкое · 512"],
          ["medium", "Среднее · 1024"],
          ["high", "Высокое · 2048"],
        ],
      ],
      [
        "aa",
        "Сглаживание",
        "select",
        [
          ["off", "Без сглаживания"],
          ["fxaa", "FXAA · лёгкое"],
          ["msaa", "MSAA 4× · требовательное"],
        ],
      ],
      ["exposure", "Экспозиция", "range", 0.6, 1.8, 0.05],
      ["brightness", "Яркость", "range", 0.7, 1.3, 0.05],
      ["contrast", "Контраст", "range", 0.7, 1.4, 0.05],
      ["saturation", "Насыщенность", "range", 0, 1.5, 0.05],
      ["sharpness", "Резкость", "range", 0, 1, 0.05],
      ["vignette", "Виньетка", "range", 0, 0.7, 0.05],
    ],
    hands: [
      [
        "hand",
        "Ведущая рука",
        "select",
        [
          ["right", "Правая"],
          ["left", "Левая"],
        ],
      ],
      [
        "gloves",
        "Перчатки",
        "select",
        [
          ["graphite", "Graphite / Графит"],
          ["sand", "Sand / Песок"],
          ["olive", "Olive / Олива"],
          ["arctic", "Arctic / Лёд"],
        ],
      ],
      ["handX", "Положение по горизонтали", "range", -0.15, 0.15, 0.01],
      ["handY", "Высота рук", "range", -0.15, 0.12, 0.01],
      ["handZ", "Приближение оружия", "range", -0.15, 0.15, 0.01],
      ["viewFov", "Поле зрения оружия", "range", 50, 85, 1],
      ["bob", "Покачивание при движении", "range", 0, 1, 0.05],
    ],
    controls: [
      ["sensitivity", "Чувствительность мыши", "range", 0.1, 5, 0.05],
      ["scopeSensitivity", "Чувствительность в прицеле · множитель", "range", 0.1, 3, 0.05],
      ["knifeModel", "Нож · клавиша 3", "select", [["butterfly", "Бабочка"], ["karambit", "Керамбит"], ["m9", "M9 Bayonet"]]],
      ["invertY", "Инверсия мыши по вертикали", "check"],
    ],
    crosshair: [
      ["crossSize","Длина линий","range",2,20,1],
      ["crossGap","Зазор","range",0,20,1],
      ["crossThickness","Толщина","range",1,6,1],
      ["crossOpacity","Непрозрачность","range",.2,1,.05],
      ["crossColor","Цвет","select",[["#95ed4a","Зелёный"],["#ffffff","Белый"],["#55ddff","Голубой"],["#ffcf55","Жёлтый"],["#ff55a8","Розовый"]]],
      ["crossDot","Точка в центре","check"],
      ["crossOutline","Чёрная обводка","check"],
      ["crossDynamic","Динамический зазор","check"],
    ],
    audio: [["volume", "Общая громкость", "range", 0, 1, 0.05]],
  };
  function status(text) {
    $("settingsStatus").textContent = text;
  }
  async function call(command, value) {
    if (!window.voidlineSettings) throw Error("Доступно в приложении Electron");
    const r = await window.voidlineSettings.invoke(command, value);
    if (!r?.ok) throw Error(r?.error || "Нет ответа");
    return r.result;
  }
  async function save() {
    const token = ++revision;
    try {
      if (window.voidlineSettings) await call("save", settings);
      else
        localStorage.setItem("voidline.settings.v1", JSON.stringify(settings));
      if (token === revision) status("Настройки сохранены на этом устройстве");
    } catch (e) {
      status("Ошибка сохранения: " + e.message);
    }
  }
  function change(key, value) {
    settings = normalizeSettings({ ...settings, [key]: value });
    window.voidlinePrefs = settings;
    onChange(settings);paintCrosshair(document.getElementById("crossSample"),settings);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 220);
  }
  function addRow(container, def) {
    const [key, label, type, ...args] = def,
      row = document.createElement("label");
    row.className = "settingRow";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(text);
    let input = document.createElement(type === "select" ? "select" : "input");
    input.id = "pref-" + key;
    input.dataset.pref = key;
    input.disabled = loading || (!!window.AndroidSettings && key === "windowMode");
    if (type === "select") {
      for (const [value, label] of args[0]) {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        input.append(o);
      }
      input.value = settings[key];
    } else if (type === "range") {
      input.type = "range";
      [input.min, input.max, input.step] = args;
      input.value = settings[key];
      const out = document.createElement("output");
      out.htmlFor = input.id;
      out.textContent = Number(settings[key]).toFixed(args[2] < 1 ? 2 : 0);
      row.append(out);
      input.oninput = () => {
        out.textContent = Number(input.value).toFixed(args[2] < 1 ? 2 : 0);
        change(key, +input.value);
      };
    } else {
      input.type = "checkbox";
      input.checked = settings[key];
    }
    if (type !== "range")
      input.onchange = async () => {
        const val =
          type === "check"
            ? input.checked
            : typeof DEFAULTS[key] === "number"
              ? +input.value
              : input.value;
        if (key === "windowMode")
          try {
            if (window.voidlineSettings) await call("window", val);
            else if (val === "borderless")
              await document.documentElement.requestFullscreen();
            else if (document.fullscreenElement)
              await document.exitFullscreen();
          } catch (e) {
            input.value = settings[key];
            status(e.message);
            return;
          }
        change(key, val);
      };
    row.append(input);
    container.append(row);
  }
  function note(container, text) {
    const p = document.createElement("p");
    p.className = "settingsNote";
    p.textContent = text;
    container.append(p);
  }
  function render() {
    dialog.querySelector(".settingsTabs").replaceChildren();
    for (const [id, [ico, label]] of Object.entries(tabs)) {
      const b = document.createElement("button");
      b.className = id === tab ? "selected" : "";
      b.innerHTML = icon(ico) + label;
      b.dataset.settingsTab = id;
      b.setAttribute("aria-pressed", String(id === tab));
      b.onclick = () => {
        tab = id;
        binding = null;
        render();
        onChange(settings);paintCrosshair(document.getElementById("crossSample"),settings);
      };
      dialog.querySelector(".settingsTabs").append(b);
    }
    const container = dialog.querySelector(".settingsContent");
    container.replaceChildren();
    const h = document.createElement("h3");
    h.textContent = tabs[tab][1];
    container.append(h);
    for (const def of definitions[tab]) addRow(container, def);
    if(tab==="crosshair"){const sample=document.createElement("div");sample.className="crossSampleBox";sample.innerHTML="<div id=\"crossSample\"><i></i><i></i><i></i><i></i><b></b></div><span>Живой предпросмотр</span>";container.prepend(sample);paintCrosshair(sample.firstChild,settings);}
    if (tab === "controls") {
      note(
        container,
        "Нажми на клавишу и выбери новую. Занятая клавиша меняется местами с текущей. Esc отменяет назначение; пауза всегда на Esc. ЛКМ — огонь / удар; ПКМ — прицел / сильный удар / ближний бросок; Alt + «Выбросить» — бомба. Колёсико мыши — переключение доступных слотов по кругу.",
      );
      const grid = document.createElement("div");
      grid.className = "keyGrid";
      for (const [key, [name]] of Object.entries(ACTIONS)) {
        const row = document.createElement("div");
        row.className = "keyRow";
        const label = document.createElement("span");
        label.textContent = name;
        const b = document.createElement("button");
        b.className = "secondary bindButton";
        b.textContent = keyLabel(settings.bindings[key]);
        b.dataset.bind = key;
        b.disabled = loading;
        b.onclick = () => {
          binding = key;
          for (const old of grid.querySelectorAll("button"))
            old.classList.remove("listening");
          b.classList.add("listening");
          b.textContent = "Нажми клавишу…";
        };
        row.append(label, b);
        grid.append(row);
      }
      container.append(grid);
    }
    if (tab === "hands") {
      note(
        container,
        "Локальный вид от первого лица. Настройка рук не меняет точность, хитбоксы или направление выстрела. Перчатки локальные; сетевые раскраски — в «Инвентаре».",
      );
      const b = document.createElement("button");
      b.id = "previewHands";
      b.className = "secondary";
      b.innerHTML = icon("play") + " ПРЕДПРОСМОТР РУК";
      b.onclick = () => {
        dialog.classList.toggle("handsPreview");
        document.body.classList.toggle(
          "settings-preview",
          dialog.classList.contains("handsPreview"),
        );
        container.scrollTop = 0;
        onChange(settings);paintCrosshair(document.getElementById("crossSample"),settings);
      };
      container.append(b);
    } else {
      dialog.classList.remove("handsPreview");
      document.body.classList.remove("settings-preview");
    }
    if (tab === "display") {
      note(
        container,
        "Разрешение рендера — размер 3D-буфера; при другом соотношении сторон появятся поля. FPS не равен герцовке: кадры ограничены также VSync, монитором и производительностью.",
      );
      const box = document.createElement("div");
      box.className = "monitorBox";
      box.innerHTML = "<h4>МОНИТОР · РАЗРЕШЕНИЕ И ГЕРЦОВКА</h4>";
      container.append(box);
      if (!displayInfo) {
        note(box, "Чтение режимов монитора…");
      } else if (!displayInfo.supported) {
        note(
          box,
          displayInfo.reason ||
            "Изменение герцовки недоступно. Открой настройки экрана операционной системы.",
        );
      } else {
        note(
          box,
          displayInfo.backend +
            ": " +
            displayInfo.current.width +
            " × " +
            displayInfo.current.height +
            " · " +
            displayInfo.current.hz +
            " Гц. Изменяется только основной монитор.",
        );
        const select = document.createElement("select");
        select.id = "monitorMode";
        const modes = [
          ...new Map(
            displayInfo.modes.map((m) => [`${m.width}x${m.height}@${m.hz}`, m]),
          ).values(),
        ].sort(
          (a, b) => a.width - b.width || a.height - b.height || a.hz - b.hz,
        );
        modes.forEach((m, i) => {
          const o = document.createElement("option");
          o.value = i;
          o.textContent = `${m.width} × ${m.height} · ${m.hz} Гц`;
          o.selected =
            m.width === displayInfo.current.width &&
            m.height === displayInfo.current.height &&
            m.hz === displayInfo.current.hz;
          select.append(o);
        });
        select.setAttribute("aria-label", "Режим основного монитора");
        box.append(select);
        const button = document.createElement("button");
        button.className = "secondary";
        button.textContent = "ПРИМЕНИТЬ К МОНИТОРУ";
        button.onclick = async () => {
          button.disabled = true;
          try {
            const r = await call("display-apply", modes[+select.value]);
            showConfirm(r.seconds);
          } catch (e) {
            status(e.message);
          } finally {
            button.disabled = false;
          }
        };
        box.append(button);
        note(
          box,
          "Без подтверждения через 15 секунд вернётся предыдущий режим. Частота применяется отдельно и не восстанавливается автоматически при запуске игры.",
        );
      }
    }
    $("resetSettings").disabled = loading;
  }
  let focusBefore;
  function open() {
    focusBefore = document.activeElement;
    dialog.hidden = false;
    dialog.classList.remove("handsPreview");
    onOpen();
    render();
    $("settingsClose").focus();
  }
  async function close() {
    binding = null;
    dialog.hidden = true;
    document.body.classList.remove("settings-preview");
    clearTimeout(saveTimer);
    if (!loading) await save();
    onClose();
    focusBefore?.focus?.();
  }
  $("settingsClose").onclick = close;
  $("resetSettings").onclick = () => {
    for (const [k] of definitions[tab]) settings[k] = DEFAULTS[k];
    if (tab === "controls") settings.bindings = { ...DEFAULTS.bindings };
    if (tab === "display" && window.voidlineSettings)
      call("window", settings.windowMode).catch((e) => status(e.message));
    change("version", 1);
    render();
  };
  document.addEventListener(
    "keydown",
    (e) => {
      if (dialog.hidden) return;
      if (binding) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code === "Escape") binding = null;
        else
          try {
            settings = rebind(settings, binding, e.code);
            binding = null;
            change("version", 1);
          } catch (err) {
            status(err.message);
            return;
          }
        render();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        return;
      }
      if (e.code === "Tab") {
        const all = [
          ...dialog.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
          ),
        ].filter((el) => el.getClientRects().length);
        const first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    true,
  );
  function showConfirm(seconds) {
    let remaining = seconds;
    const overlay = document.createElement("div");
    overlay.className = "displayConfirm";
    overlay.setAttribute("role", "alertdialog");
    overlay.innerHTML =
      '<section><h3>СОХРАНИТЬ РЕЖИМ МОНИТОРА?</h3><p></p><button id="displayKeep">СОХРАНИТЬ</button><button id="displayUndo" class="secondary">ВЕРНУТЬ ПРЕЖНИЙ</button></section>';
    dialog.append(overlay);
    let settled = false;
    const confirmationKeys = (event) => {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        done(false);
      }
      if (event.code === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const keep = $("displayKeep"),
          undo = $("displayUndo");
        (document.activeElement === keep ? undo : keep).focus();
      }
    };
    window.addEventListener("keydown", confirmationKeys, true);
    const done = async (keep) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", confirmationKeys, true);
      clearInterval(confirmTimer);
      try {
        await call(keep ? "display-confirm" : "display-revert");
        displayInfo = await call("display-info");
        status(keep ? "Режим монитора подтверждён" : "Режим возвращён");
      } catch (e) {
        status(e.message);
      }
      overlay.remove();
      render();
    };
    const tick = () => {
      overlay.querySelector("p").textContent =
        `Автоматический возврат через ${remaining} с`;
      if (remaining-- <= 0) done(false);
    };
    tick();
    confirmTimer = setInterval(tick, 1000);
    $("displayKeep").onclick = () => done(true);
    $("displayUndo").onclick = () => done(false);
    $("displayKeep").focus();
  }
  const ready = (async () => {
    try {
      if (window.voidlineSettings)
        settings = normalizeSettings(await call("load"));
      else {
        let old;
        try {
          old = JSON.parse(localStorage.getItem("voidline-prefs") || "null");
        } catch {}
        settings = normalizeSettings(
          JSON.parse(localStorage.getItem("voidline.settings.v1") || "null") ||
            old,
        );
      }
      status("Настройки сохранены на этом устройстве");
    } catch (e) {
      status("Используются стандартные настройки: " + e.message);
    } finally {
      loading = false;
      window.voidlinePrefs = settings;
      onChange(settings);paintCrosshair(document.getElementById("crossSample"),settings);
      render();
    }
    try {
      displayInfo = window.voidlineSettings
        ? await call("display-info")
        : {
            supported: false,
            reason:
              "В браузере разрешение и герцовка монитора управляются ОС. В приложении Electron доступны поддерживаемые режимы Windows / X11.",
          };
    } catch (e) {
      displayInfo = { supported: false, reason: e.message };
    }
    if (!dialog.hidden && tab === "display") render();
  })();
  window.addEventListener("voidline-open-settings", open);
  return {
    ready,
    open,
    close,
    get: () => settings,
    isOpen: () => !dialog.hidden,
    preview: () =>
      !dialog.hidden &&
      tab === "hands" &&
      dialog.classList.contains("handsPreview"),
  };
}
