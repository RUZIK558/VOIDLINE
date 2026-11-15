import {WEAPONS} from "./shared.mjs";
import * as THREE from "/vendor/three.module.js";
import { buildWeapon } from "./models.mjs";
import { applyWeaponSkin } from "./skin-materials.mjs";
import { SKINS, normalizeProfile } from "./cosmetics.mjs";
export function setupInventoryUI(onChange) {
  const $ = (id) => document.getElementById(id);
  let profile = normalizeProfile(null),
    weapon = "rifle",
    revision = 0,
    loading = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#172730");
  const camera = new THREE.PerspectiveCamera(
    38,
    innerWidth / innerHeight,
    0.01,
    30,
  );
  camera.position.set(1.1, 0.55, 1.4);
  camera.lookAt(-0.35, 0, -0.1);
  scene.add(new THREE.HemisphereLight("#e2f9ff", "#5c4b33", 3));
  const light = new THREE.DirectionalLight("#ffffff", 4);
  light.position.set(-1, 3, 2);
  scene.add(light);
  const stage = new THREE.Group();
  stage.position.set(0.1, 0.02, 0);
  scene.add(stage);
  const models = {};
  $("skinWeapon").replaceChildren();
  for(const [id,w] of Object.entries(WEAPONS)){const o=document.createElement("option");o.value=id;o.textContent=w.name;$("skinWeapon").append(o);}
  for (const m of Object.values(models)) stage.add(m);
  function render() {
    if(!models[weapon]){models[weapon]=buildWeapon(weapon);stage.add(models[weapon]);}
    for (const [id, m] of Object.entries(models)) {
      m.visible = id === weapon;
      m.scale.setScalar(WEAPONS[id].melee?1.65:1);
      applyWeaponSkin(m, profile.loadout[id]);
    }
    $("skinWeapon").value = weapon;
    $("skinSummary").textContent =
      WEAPONS[weapon].name +
      " · " +
      SKINS[profile.loadout[weapon]].name;
    $("skinCards").replaceChildren();
    for (const [id, s] of Object.entries(SKINS)) {
      const button = document.createElement("button");
      button.className =
        "skinCard" + (profile.loadout[weapon] === id ? " selected" : "");
      button.dataset.skin = id;
      button.disabled = loading;
      button.setAttribute(
        "aria-pressed",
        String(profile.loadout[weapon] === id),
      );
      const swatch = document.createElement("span");
      swatch.className = "skinSwatch";
      swatch.style.background = `repeating-linear-gradient(135deg,${s.colors[0]} 0 16px,${s.colors[1]} 16px 28px,${s.colors[2]} 28px 30px)`;
      const label = document.createElement("span");
      label.textContent = s.name;
      button.append(swatch, label);
      button.onclick = () => select(id);
      $("skinCards").append(button);
    }
  }
  async function select(id) {
    profile.loadout[weapon] = id;
    const snapshot = normalizeProfile(profile),
      token = ++revision;
    render();
    onChange(snapshot.loadout);
    try {
      if (window.voidlineProfile) {
        const r = await window.voidlineProfile.save(snapshot);
        if (!r.ok) throw Error(r.error);
      } else
        localStorage.setItem("voidline.profile.v1", JSON.stringify(snapshot));
      if (token === revision)
        $("skinStatus").textContent =
          "Сохранено. Свои пушки обновятся в подготовке.";
    } catch (e) {
      if (token === revision)
        $("skinStatus").textContent = "Не удалось сохранить: " + e.message;
    }
  }
  $("skinPreviewToggle").onclick = () => {
    const on = $("pane-inventory").classList.toggle("previewOnly");
    $("skinPreviewToggle").textContent = on
      ? "ВЕРНУТЬСЯ К ВЫБОРУ"
      : "РАССМОТРЕТЬ 3D-МОДЕЛЬ";
  };
  $("skinWeapon").onchange = () => {
    weapon = $("skinWeapon").value;
    render();
  };
  if (innerWidth < 700) {
    camera.fov = 50;
    camera.lookAt(0.1, 0.45, -0.1);
    camera.updateProjectionMatrix();
  }
  render();
  const ready = (async () => {
    try {
      if (window.voidlineProfile) {
        const r = await window.voidlineProfile.load();
        if (!r.ok) throw Error(r.error);
        profile = normalizeProfile(r.result);
      } else
        profile = normalizeProfile(
          JSON.parse(localStorage.getItem("voidline.profile.v1") || "null"),
        );
      render();
      onChange(profile.loadout);
      $("skinStatus").textContent =
        "6 раскрасок бесплатно. Модель ножа: Настройки → Управление. Достать: 3, осмотр: F.";
    } catch (e) {
      $("skinStatus").textContent = "Профиль не загружен: " + e.message;
    } finally {
      loading = false;
      render();
    }
  })();
  return {
    scene,
    camera,
    ready,
    getLoadout: () => ({ ...profile.loadout }),
    update(t) {
      stage.rotation.set(
        Math.sin(t * 0.3) * 0.12,
        Math.sin(t * 0.25) * 0.35,
        0.06,
      );
    },
    resize(width = innerWidth, height = innerHeight) {
      camera.aspect = width / height;
      camera.fov = innerWidth < 700 ? 50 : 38;
      camera.lookAt(
        innerWidth < 700 ? 0.1 : -0.35,
        innerWidth < 700 ? 0.45 : 0,
        -0.1,
      );
      camera.updateProjectionMatrix();
    },
  };
}
