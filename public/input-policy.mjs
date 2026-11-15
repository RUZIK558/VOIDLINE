// Shared keyboard policy. Menu accelerators are disabled in Electron separately;
// renderer prevention must not swallow the WASD key events used by gameplay.
export function isEditableTarget(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
export function isShellShortcut(input) {
  const ctrl=input.ctrlKey??input.control,meta=input.metaKey??input.meta;
  if(input.code==='F5'||input.key==='F5')return true;
  if(!ctrl&&!meta)return false;
  const code=input.code||'',key=String(input.key||'').toLowerCase();
  return ['KeyW','KeyQ','KeyR','KeyP','KeyS','KeyO','KeyN','KeyL','Equal','Minus','Digit0','NumpadAdd','NumpadSubtract','Numpad0'].includes(code)
    || ['w','q','r','p','s','o','n','l','+','-','=','0'].includes(key);
}
export function preventPageKey(input,{active=false,editing=false,controlling=false,bindings={}}={}) {
  if(isShellShortcut(input))return true;
  if(editing||!active)return false;
  if(input.ctrlKey||input.metaKey)return true;
  return controlling && (Object.values(bindings).includes(input.code)||['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(input.code));
}
export function viewportLayout(width,height){
  return {width:Math.max(1,width),height:Math.max(1,height),aspect:Math.max(1,width)/Math.max(1,height)};
}
