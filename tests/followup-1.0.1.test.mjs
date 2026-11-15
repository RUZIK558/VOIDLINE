import {test} from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {createLinuxInput,linuxOzone} from '../linux-input.mjs';import {incomingMessages} from '../public/chat-notices.mjs';
import fs from 'node:fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(){let focused=true,child,count=0;const deltas=[],statuses=[];const win={isDestroyed:()=>false,isFocused:()=>focused,getNativeWindowHandle:()=>Buffer.from([42,0,0,0,0,0,0,0])};const controller=createLinuxInput({platform:'linux',display:':97',executable:'/test/helper',getWindow:()=>win,sendDelta:m=>deltas.push(m),sendStatus:s=>statuses.push(s),spawnHelper:(file,args)=>{assert.equal(file,'/test/helper');assert.deepEqual(args,['2a']);count++;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.killed=false;child.kill=()=>child.killed=true;return child;}});return {controller,get child(){return child;},deltas,statuses,get count(){return count;},blur(){focused=false;}};}
test('Linux Ozone chooses XWayland with DISPLAY, preserves explicit overrides and pure Wayland fallback',()=>{
 assert.equal(linuxOzone({platform:'linux',env:{DISPLAY:':0',WAYLAND_DISPLAY:'wayland-0'}}),'x11');assert.equal(linuxOzone({platform:'linux',env:{WAYLAND_DISPLAY:'wayland-0'}}),'wayland');assert.equal(linuxOzone({platform:'linux',env:{DISPLAY:':0'},explicit:'wayland'}),'wayland');assert.equal(linuxOzone({platform:'linux',env:{DISPLAY:':0',VOIDLINE_OZONE_PLATFORM:'wayland'}}),'wayland');assert.equal(linuxOzone({platform:'win32',env:{DISPLAY:':0'}}),null);
});
test('native mouse waits for READY, batches relative deltas and ignores malformed values',async()=>{
 const f=fixture();try{const pending=f.controller.capture(true);f.child.stdout.write('READY\n');assert.equal((await pending).active,true);f.child.stdout.write('12 7\n8 -2\nNaN 2\nmalformed\n');await wait(25);assert.deepEqual(f.deltas,[{dx:20,dy:5}]);assert.equal((await f.controller.capture(true)).active,true);assert.equal(f.count,1);}finally{f.controller.close();}
});
test('native mouse stops on release; stale data cannot move a new or unfocused session',async()=>{
 const f=fixture();try{const promise=f.controller.capture(true);f.child.stdout.write('READY\n');await promise;const child=f.child;await f.controller.capture(false);assert.equal(child.killed,true);child.stdout.write('100 100\n');await wait(15);assert.equal(f.deltas.length,0);const q=f.controller.capture(true);f.child.stdout.write('READY\n');await q;f.blur();f.child.stdout.write('5 5\n');await wait(25);assert.equal(f.child.killed,true);assert.equal(f.deltas.length,0);}finally{f.controller.close();}
});
test('native helper failures resolve to ordinary pointer lock, without dangling capture',async()=>{
 const f=fixture();try{const promise=f.controller.capture(true);f.child.emit('error',Object.assign(Error('not found'),{code:'ENOENT'}));const r=await promise;assert.equal(r.active,false);assert.match(r.reason,/ENOENT/);assert.equal(f.child.killed,true);}finally{f.controller.close();}
});
test('Wayland-only backend does not pretend XInput2 is active',async()=>{
 const c=createLinuxInput({platform:'linux',display:undefined,ozone:'wayland',getWindow:()=>({isDestroyed:()=>false,isFocused:()=>true})});try{const r=await c.capture(true);assert.equal(r.active,false);assert.match(r.reason,/XWayland/);}finally{c.close();}
});
test('P2P notifications never replay stored history or notify own outgoing messages',()=>{
 const a={id:'a',mine:false},b={id:'b',mine:false},mine={id:'c',mine:true};assert.deepEqual(incomingMessages(null,[a]),[]);assert.deepEqual(incomingMessages([a],[a,b,mine]),[b]);assert.deepEqual(incomingMessages([a,b],[a,b]),[]);assert.deepEqual(incomingMessages([], [b]),[b]);
});
test('shop side is a separate cache key and renderer supplies current attack/defense role',()=>{
 const shop=fs.readFileSync(new URL('../public/shop-preview.mjs',import.meta.url),'utf8');assert.match(shop,/side!==lastSide/);assert.match(shop,/buildOperator\(side\)/);const game=fs.readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');assert.ok(game.includes('shopPreview.show(id,me&&state&&me.team===state.attackTeam?1:0)'));
});
