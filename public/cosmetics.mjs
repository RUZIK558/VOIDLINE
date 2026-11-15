import {WEAPONS,weaponBase} from "./shared.mjs";
export const SKINS = Object.freeze({
  standard: {
    name: "Factory / Заводской",
    colors: ["#323c40", "#8d8269", "#596165"],
    metalness: 0.62,
    roughness: 0.48,
    pattern: "plain",
  },
  arctic: {
    name: "Arctic / Ледник",
    colors: ["#e2edf0", "#455c70", "#8babc0"],
    metalness: 0.25,
    roughness: 0.75,
    pattern: "camo",
  },
  ember: {
    name: "Ember / Раскалённый",
    colors: ["#251f26", "#ef743a", "#e7b363"],
    metalness: 0.72,
    roughness: 0.3,
    pattern: "diagonal",
  },
  circuit: {
    name: "Circuit / Контур",
    colors: ["#122c32", "#7be6ce", "#3a6c74"],
    metalness: 0.65,
    roughness: 0.28,
    pattern: "circuit",
  },
  cobalt: {
    name: "Cobalt / Кобальт",
    colors: ["#123e93", "#439ed5", "#bed4df"],
    metalness: 0.85,
    roughness: 0.23,
    pattern: "diagonal",
  },
  carbon: {
    name: "Carbon / Карбон",
    colors: ["#171d22", "#464e54", "#7a858a"],
    metalness: 0.5,
    roughness: 0.38,
    pattern: "weave",
  },
});
export const DEFAULT_PROFILE = Object.freeze({version:2,loadout:Object.freeze(Object.fromEntries(Object.keys(WEAPONS).map(id=>[id,'standard'])))});
export function validSkin(id){return typeof id==='string'&&Object.hasOwn(SKINS,id);}
// Accept v1 for migration. Partial weapon patches and unknown keys are rejected.
export function validLoadout(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const keys=Object.keys(value),legacy=keys.length===2&&keys.includes('rifle')&&keys.includes('pistol');
 const v08=keys.length===10 && keys.every(k=>Object.hasOwn(WEAPONS,k)&&!WEAPONS[k].melee);
 return (legacy||v08||keys.length===Object.keys(WEAPONS).length)&&keys.every(k=>Object.hasOwn(WEAPONS,k)&&validSkin(value[k]));
}
export function normalizeProfile(value){
 const source=validLoadout(value?.loadout)?value.loadout:DEFAULT_PROFILE.loadout;
 return {version:2,loadout:Object.fromEntries(Object.keys(WEAPONS).map(id=>[id,source[id]||source[weaponBase(id)]||'standard']))};
}
