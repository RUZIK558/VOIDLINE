import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TacticalMatch} from '../match.mjs';
import {SHOP,WEAPONS} from '../public/shared.mjs';
import {purchaseError} from '../public/purchase.mjs';
import {spectatorTarget,sideLabel,flashOpacity} from '../public/match-ui.mjs';
import {aimDelta} from '../public/aim.mjs';
import {parseAdvertisement,createPeerDiscovery} from '../peer-discovery.mjs';
import {paintCrosshair} from '../public/crosshair.mjs';
import {DEFAULTS} from '../public/settings-schema.mjs';
import dgram from 'node:dgram';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(){const game=new TacticalMatch(new Map());const a=game.make('A',0),b=game.make('B',1);game.startRound();return {game,a,b};}
test('purchase UI and authoritative server agree for every offer, both sides and balances',()=>{
 for(const team of [0,1])for(const money of [0,200,800,4750,16000])for(const item of Object.keys(SHOP)){
  const {game,a}=fixture();a.team=team;game.spawn(a,0);a.money=money;
  const m=game.snapshot(Date.now()).players.find(p=>p.id===a.id);
  const expected=purchaseError(m,item,{phase:game.phase,roundEvent:game.roundEvent,map:game.map,attackTeam:game.attackTeam});
  assert.equal(game.buy(a,item),expected,`${team}/${money}/${item}`);
  if(expected)assert.equal(a.money,money);else assert.equal(a.money,money-SHOP[item].price);
 }
});
test('every affordable unrestricted weapon can be bought with AWP-level balance; side restrictions are explicit',()=>{
 for(const id of Object.keys(WEAPONS).filter(id=>SHOP[id])){
  const {game,a}=fixture();a.money=4750;
  const err=game.buy(a,id);
  if(SHOP[id].side==='CT')assert.match(err,/КТ/);else if(id==='pistol')assert.match(err,/уже/);else assert.equal(err,null,id);
 }
});
test('surviving arsenal, magazines, reserve, utility, armor, owner and active weapon persist; death and halftime reset intentionally',()=>{
 const {game,a,b}=fixture();a.money=16000;assert.equal(game.buy(a,'awp'),null);a.guns.awp.ammo=2;a.guns.awp.reserve=11;game.buy(a,'armor');game.buy(a,'smoke');
 const saved=structuredClone({guns:a.guns,grenades:a.grenades,armor:a.armor,weapon:a.weapon});
 game.phase='live';game.kill(b,a,Date.now());game.finish(0,'elimination');game.startRound();
 for(const k of Object.keys(saved))assert.deepEqual(a[k],saved[k],k);
 assert.equal(b.guns.awp,undefined);assert.ok(b.guns.pistol);
 game.round=game.rules.halfRounds;game.startRound();assert.equal(a.guns.awp,undefined);assert.equal(a.money,800);
});
test('dead input cannot select, drop, rotate or shoot ally while spectating',()=>{
 const {game,a}=fixture();game.phase='live';game.kill(a,null,Date.now());const before=structuredClone(a);game.input(a,{weapon:'m9',yaw:1,drop:true,fire:true},Date.now());assert.deepEqual(a,before);
});
test('spectator cycles only live connected allies, recovers missing target, ends on respawn',()=>{
 const me={id:'me',team:0,alive:false},a={id:'a',team:0,alive:true},b={id:'b',team:0,alive:true},enemy={id:'enemy',team:1,alive:true};
 const players=[me,a,b,enemy,{id:'off',team:0,alive:true,disconnected:true}];
 assert.equal(spectatorTarget(players,me,null).id,'a');assert.equal(spectatorTarget(players,me,'a',1).id,'b');assert.equal(spectatorTarget(players,me,'a',-1).id,'b');a.alive=false;assert.equal(spectatorTarget(players,me,'a').id,'b');b.alive=false;assert.equal(spectatorTarget(players,me,'b'),null);me.alive=true;assert.equal(spectatorTarget(players,me,null),null);
 assert.equal(sideLabel(0,0),'Т');assert.equal(sideLabel(0,1),'КТ');
});
test('flash detonation affects humans and bots, full white hold fades and walls block',()=>{
 const {game,a,b}=fixture();game.map={...game.map,boxes:[]};Object.assign(a,{x:0,z:0,y:1.65,yaw:0,pitch:0});Object.assign(b,{x:0,z:0,y:1.65,yaw:0,pitch:0,bot:true});
 game.detonate({kind:'flash',x:0,y:1.65,z:-3},10000);
 for(const p of [a,b]){assert.ok(p.flash.peak>.9);assert.equal(flashOpacity(p.flash,10001),1);assert.ok(flashOpacity(p.flash,p.flash.until-100)<.2);assert.equal(flashOpacity(p.flash,p.flash.until),0);}
 a.flash=null;game.map.boxes=[[0,-1.5,5,.5,4]];game.detonate({kind:'flash',x:0,y:1.65,z:-3},20000);assert.equal(a.flash,null);
});
test('crosshair preview positions four visible bars and responds to sliders',()=>{
 const bars=Array.from({length:4},()=>({style:{}})),dot={style:{}};
 const el={style:{setProperty(k,v){this[k]=v;}},querySelectorAll:()=>bars,querySelector:()=>dot};
 paintCrosshair(el,{...DEFAULTS,crossSize:13,crossThickness:3,crossDot:true});
 for(const b of bars){assert.equal(b.style.position,'absolute');assert.equal(b.style.display,'block');}
 assert.equal(bars[0].style.height,'13px');assert.equal(bars[2].style.width,'13px');assert.equal(dot.hidden,false);
});
test('horizontal relative mouse never meets screen edge after 1000 revolutions, vertical reaches near 90 degrees',()=>{
 let a={yaw:0,pitch:0};for(let i=0;i<10000;i++)a=aimDelta(a.yaw,a.pitch,200,0);
 assert.ok(a.yaw>=0&&a.yaw<Math.PI*2);assert.ok(aimDelta(a.yaw,0,500,0).yaw!==a.yaw);
 assert.equal(aimDelta(0,0,0,-100000).pitch,Math.PI/2-.01);assert.equal(aimDelta(0,0,0,100000).pitch,-Math.PI/2+.01);
});
test('untrusted discovery packets reject malformed and self advertisements, derive address from sender',()=>{
 const m={protocol:'VOIDLINE-LAN-1',id:'a'.repeat(64),name:'<script> Alice',port:3090};const packet=x=>Buffer.from(JSON.stringify(x));
 for(const x of [null,[],{},'x',{...m,port:22}])assert.equal(parseAdvertisement(packet(x),'127.0.0.1','b'.repeat(64)),null);
 assert.equal(parseAdvertisement(packet(m),'127.0.0.1',m.id),null);const p=parseAdvertisement(packet(m),'127.0.0.1','b'.repeat(64));assert.equal(p.host,'127.0.0.1');assert.ok(!p.name.includes('<'));assert.ok(p.code.startsWith('VLF1.'));
});
test('two real UDP multicast peers discover each other without codes', {timeout:6000},async()=>{
 const probe=dgram.createSocket('udp4');await new Promise(r=>probe.bind(0,r));const port=probe.address().port;probe.close();
 let a,b;try{
  a=await createPeerDiscovery({identity:()=>({id:'a'.repeat(64),name:'ALICE',port:43001}),port,intervalMs:100});
  b=await createPeerDiscovery({identity:()=>({id:'b'.repeat(64),name:'BOB',port:43002}),port,intervalMs:100});
  for(let i=0;i<40&&(!a.snapshot().nearby.length||!b.snapshot().nearby.length);i++)await wait(100);
  assert.equal(a.snapshot().nearby[0]?.name,'BOB');assert.equal(b.snapshot().nearby[0]?.name,'ALICE');
 }finally{a?.close();b?.close();}
});

import {route} from '../public/navigation.mjs';
import {MAPS} from '../public/maps.mjs';
import {blocked} from '../public/shared.mjs';
import {createPointerCapture} from '../public/pointer-capture.mjs';
test('all eight maps offer distinct lane paths, all segments collision checked',()=>{
 for(const map of Object.values(MAPS)){
  const p={x:map.spawns.T[0],z:map.spawns.T[1]};
  const paths=[0,1,2].map(lane=>route(map,p,map.sites[0],lane));
  assert.ok(new Set(paths.map(r=>JSON.stringify(r))).size>=2,map.id);
  for(const r of paths){let old=[p.x,p.z];for(const point of r){const length=Math.hypot(point[0]-old[0],point[1]-old[1]),n=Math.max(1,Math.ceil(length/.2));for(let i=0;i<=n;i++)assert.equal(blocked(old[0]+(point[0]-old[0])*i/n,old[1]+(point[1]-old[1])*i/n,.36,map.boxes),false,map.id);old=point;}}
 }
});
test('raw pointer request falls back once only for NotSupportedError and acquires actual lock',async()=>{
 const doc=new EventTarget(),win=new EventTarget(),calls=[];doc.hidden=false;doc.hasFocus=()=>true;doc.pointerLockElement=null;win.setTimeout=setTimeout;win.clearTimeout=clearTimeout;
 const el={focus(){},requestPointerLock(options){calls.push(options);if(options)return Promise.reject(Object.assign(Error('raw not supported'),{name:'NotSupportedError'}));doc.pointerLockElement=el;doc.dispatchEvent(new Event('pointerlockchange'));return Promise.resolve();}};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 const capture=createPointerCapture({element:el,enabled:()=>true,doc,win});
 try{assert.equal(await capture.request(),true);assert.equal(capture.locked,true);assert.deepEqual(calls,[{unadjustedMovement:true},undefined]);}finally{capture.destroy();}
});
