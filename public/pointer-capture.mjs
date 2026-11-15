// Aiming is possible only while the OS/browser actually owns the pointer lock.
// No cursor-hiding or absolute-position fallback: these let the cursor escape.
export function createPointerCapture({element,enabled,onChange=()=>{},onFailure=()=>{},doc=globalThis.document,win=globalThis.window,timeoutMs=2000}){
  let pending=false,timer=null,disposed=false;
  const focused=()=>!doc.hidden && doc.hasFocus();
  const owns=()=>doc.pointerLockElement===element;
  const locked=()=>!disposed && enabled() && focused() && owns();
  const cancel=()=>{pending=false;if(timer!==null)win.clearTimeout(timer);timer=null;};
  const failure=(reason)=>{cancel();onChange(false);onFailure(reason);};
  const release=()=>{cancel();onChange(false);if(owns())doc.exitPointerLock?.();};
  const change=()=>{cancel();if(owns() && (!enabled()||!focused())){release();return;}onChange(locked());};
  const error=()=>failure('Захват мыши не разрешён системой. Нажми «Продолжить», чтобы повторить.');
  const blur=()=>release();
  const visibility=()=>{if(doc.hidden)release();};
  doc.addEventListener('pointerlockchange',change);
  doc.addEventListener('pointerlockerror',error);
  doc.addEventListener('visibilitychange',visibility);
  win.addEventListener('blur',blur);
  return {
    get locked(){return locked();},get pending(){return pending;},
    request(){
      if(disposed||!enabled()||!focused())return Promise.resolve(false);
      if(locked()){onChange(true);return Promise.resolve(true);}
      if(pending)return Promise.resolve(false);
      if(typeof element.requestPointerLock!=='function'){
        failure('Захват мыши недоступен в этой системе. Управление прицелом приостановлено.');return Promise.resolve(false);
      }
      pending=true;
      timer=win.setTimeout(()=>{if(!owns())failure('Мышь не захвачена. Нажми «Продолжить». Esc освобождает курсор.');},timeoutMs);
      element.focus?.({preventScroll:true});
      try {
        const attempt=element.requestPointerLock({unadjustedMovement:true});
        const result=attempt?.then?attempt.catch(err=>{if(err?.name==='NotSupportedError' && enabled() && focused())return element.requestPointerLock();throw err;}):attempt;
        // Older implementations return void; pointerlockchange/error completes them.
        if(!result?.then)return Promise.resolve(false);
        return result.then(()=>{if(disposed)return false;change();return locked();},err=>{if(!disposed)failure('Не удалось захватить мышь. Нажми «Продолжить», чтобы повторить. '+(err?.name||''));return false;});
      } catch(err){failure('Не удалось захватить мышь. Нажми «Продолжить», чтобы повторить. '+(err?.name||''));return Promise.resolve(false);}
    },
    release,
    destroy(){release();disposed=true;doc.removeEventListener('pointerlockchange',change);doc.removeEventListener('pointerlockerror',error);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',blur);}
  };
}
