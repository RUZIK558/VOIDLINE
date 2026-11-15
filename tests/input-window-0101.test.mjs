import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {isShellShortcut,preventPageKey,isEditableTarget,viewportLayout} from '../public/input-policy.mjs';
import {createPointerCapture} from '../public/pointer-capture.mjs';
import {renderSize,normalizeSettings,DEFAULTS} from '../public/settings-schema.mjs';
const key=(code,extra={})=>({code,ctrlKey:true,...extra});
test('Ctrl+W/A still reach gameplay policy but their page default is prevented',()=>{
 for(const code of ['KeyW','KeyA','KeyS','KeyD','KeyR','KeyQ','KeyP','KeyF','Tab','Equal','Minus','Digit0'])assert.ok(preventPageKey(key(code),{active:true,controlling:true}));
 assert.equal(preventPageKey(key('KeyA'),{active:true,editing:true}),false);
 assert.equal(preventPageKey(key('KeyC'),{active:true,editing:true}),false);
 assert.equal(preventPageKey(key('KeyV'),{active:true,editing:true}),false);
 assert.equal(preventPageKey(key('KeyW'),{active:true,editing:true}),true);
});
test('shell guard accepts both Electron and DOM input, including reload/zoom/close',()=>{
 for(const k of ['w','W','q','r','+','-','0'])assert.equal(isShellShortcut({key:k,control:true}),true);
 assert.equal(isShellShortcut({code:'F5'}),true);assert.equal(isShellShortcut({key:'F5'}),true);
 assert.equal(isShellShortcut(key('KeyW',{ctrlKey:false})),false);assert.equal(isShellShortcut({key:'w',meta:true}),true);
 assert.equal(isShellShortcut({key:'F4',alt:true}),false);
});
test('editable controls and bindings preserve native text editing and gameplay keys',()=>{
 const input={closest:s=>s.includes('input')?{}:null};assert.equal(isEditableTarget(input),true);assert.equal(isEditableTarget({}),false);
 assert.equal(preventPageKey({code:'KeyW'},{active:true,controlling:true,bindings:DEFAULTS.bindings}),true);
 assert.equal(preventPageKey({code:'ControlLeft'},{active:true,controlling:true,bindings:DEFAULTS.bindings}),true);
 assert.equal(preventPageKey({code:'Escape'},{active:true,controlling:true,bindings:DEFAULTS.bindings}),false);
 assert.equal(preventPageKey({code:'ArrowLeft'},{active:true,editing:true,controlling:false}),false);
});
function fake(request){
 const doc=new EventTarget();doc.hidden=false;doc.focused=true;doc.pointerLockElement=null;doc.hasFocus=()=>doc.focused;
 const win=new EventTarget();win.setTimeout=setTimeout;win.clearTimeout=clearTimeout;
 const el={focus(){},requestPointerLock:()=>request?.(doc,el)};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 let enabled=true;const changes=[],failures=[];
 const cap=createPointerCapture({element:el,enabled:()=>enabled,onChange:v=>changes.push(v),onFailure:m=>failures.push(m),doc,win,timeoutMs:30});
 return {cap,doc,win,el,changes,failures,disable:()=>enabled=false};
}
test('capture never reports a lock just because requestPointerLock was called',async()=>{
 let finish;const f=fake(()=>new Promise(r=>finish=r));try{const p=f.cap.request();assert.equal(f.cap.locked,false);assert.equal(f.cap.pending,true);assert.ok(!f.changes.includes(true));
 f.doc.pointerLockElement=f.el;f.doc.dispatchEvent(new Event('pointerlockchange'));finish();assert.equal(await p,true);assert.equal(f.cap.locked,true);
 f.doc.pointerLockElement=null;assert.equal(f.cap.locked,false); // immediate, even before lockchange arrives
 f.doc.dispatchEvent(new Event('pointerlockchange'));assert.equal(f.changes.at(-1),false);
 }finally{f.cap.destroy();}
});
test('rejected/unsupported capture is handled, paused, not an unhandled rejection',async()=>{
 const f=fake(()=>Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'})));try{assert.equal(await f.cap.request(),false);assert.equal(f.cap.locked,false);assert.match(f.failures.at(-1),/NotAllowedError/);}finally{f.cap.destroy();}
 const g=fake();delete g.el.requestPointerLock;try{assert.equal(await g.cap.request(),false);assert.match(g.failures[0],/недоступен/);}finally{g.cap.destroy();}
});
test('pending requests are not repeated; legacy void API waits for actual event',async()=>{
 let count=0;const f=fake(()=>{count++;});try{await f.cap.request();await f.cap.request();assert.equal(count,1);assert.equal(f.cap.locked,false);f.doc.pointerLockElement=f.el;f.doc.dispatchEvent(new Event('pointerlockchange'));assert.equal(f.cap.locked,true);}finally{f.cap.destroy();}
});
test('blur and hidden document clear real capture and require explicit resume',async()=>{
 const f=fake((d,e)=>{d.pointerLockElement=e;return Promise.resolve();});try{assert.equal(await f.cap.request(),true);f.doc.focused=false;f.win.dispatchEvent(new Event('blur'));assert.equal(f.cap.locked,false);assert.equal(f.doc.pointerLockElement,null);f.doc.focused=true;assert.equal(f.cap.locked,false);
 await f.cap.request();f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.cap.locked,false);assert.equal(f.doc.pointerLockElement,null);
 }finally{f.cap.destroy();}
});
test('late capture cannot reactivate aim behind a modal or lost focus',async()=>{
 let finish;const f=fake(()=>new Promise(r=>finish=r));try{const p=f.cap.request();f.disable();f.doc.pointerLockElement=f.el;f.doc.dispatchEvent(new Event('pointerlockchange'));finish();assert.equal(await p,false);assert.equal(f.doc.pointerLockElement,null);assert.ok(!f.changes.includes(true));}finally{f.cap.destroy();}
});
test('pointer lock timeout returns an actionable recovery message',async()=>{
 const f=fake(()=>{});try{await f.cap.request();await new Promise(r=>setTimeout(r,45));assert.equal(f.cap.pending,false);assert.match(f.failures[0],/Продолжить/);assert.equal(f.cap.locked,false);}finally{f.cap.destroy();}
});
test('resize uses viewport aspect, never internal render resolution or DPR',()=>{
 for(const [w,h] of [[2000,1125],[2560,1440],[1440,900],[1000,760],[390,844]])for(const dpr of [1,1.25,2]){
 const setting=normalizeSettings({renderScale:.65,renderResolution:'1280x720'}),buffer=renderSize(setting,w,h,dpr),layout=viewportLayout(w,h);
 assert.equal(layout.aspect,w/h);assert.equal(layout.width,w);assert.equal(layout.height,h);assert.ok(buffer.width<=4096);assert.ok(buffer.height<=4096);
 }
});
test('canvas CSS sizes are viewport owned and Electron menu is removed, not hidden',()=>{
 const game=fs.readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8'),main=fs.readFileSync(new URL('../electron.cjs',import.meta.url),'utf8');
 assert.ok(game.includes('renderer.setSize(innerWidth, innerHeight, false)'));assert.ok(!game.includes('renderer.setSize(innerWidth, innerHeight);'));
 assert.ok(css.includes('width:100% !important;height:100% !important'));
 assert.ok(main.includes('Menu.setApplicationMenu(null)'));assert.ok(main.includes('win.removeMenu()'));assert.ok(main.includes('setIgnoreMenuShortcuts(true)'));
});
