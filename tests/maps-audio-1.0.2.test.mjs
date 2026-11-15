import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {MAPS} from '../public/maps.mjs';
import {route} from '../public/navigation.mjs';
import {move,verticalStep,feetY,eyeHeight,isGrounded,blocked,wallDistance,boxTop} from '../public/shared.mjs';
import {advanceGrenade,lineVisible} from '../public/utilities.mjs';
import {SOUND_IDS,spatialMix,soundName,createStepTracker} from '../public/audio.mjs';
import {TacticalMatch} from '../match.mjs';
const walk=(p,path,map,limit=6000)=>{let i=0;while(path.length&&i++<limit){const [x,z]=path[0],dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.09){path.shift();continue;}move(p,dx/d*.04,dz/d*.04,map.boxes);verticalStep(p,1/90,map.boxes);}return path.length===0;};
test('all 16 upper rooms and balconies have two independently walkable ascents and descents',()=>{
 for(const map of Object.values(MAPS))for(const g of map.structures)for(const st of g.stairs){
  const p={x:g.x,z:st.z+st.side,y:1.65,vy:0};
  assert.ok(walk(p,[[g.x,g.z]],map),map.id+' ascent');assert.ok(Math.abs(feetY(p)-g.height)<.03);assert.ok(isGrounded(p,map.boxes));
  assert.ok(walk(p,[[g.x,st.z+st.side]],map),map.id+' descent');for(let i=0;i<45;i++)verticalStep(p,1/90,map.boxes);assert.ok(Math.abs(feetY(p))<.03);
 }
});
test('navigation reaches every second storey and returns to both ground sites with server movement',()=>{
 for(const map of Object.values(MAPS))for(const g of map.structures){
  const [x,z]=map.spawns.T,p={x,z,y:1.65,vy:0};const t={x:g.x,z:g.z,y:g.height+1.65};
  assert.ok(walk(p,route(map,p,t),map),map.id+' upper path');assert.ok(Math.abs(feetY(p)-g.height)<.03);
  assert.ok(walk(p,route(map,p,map.sites[0]),map),map.id+' return path');assert.ok(Math.abs(feetY(p))<.03);
 }
});
test('ground floor, upper slab, roof and balcony are physical for players, bullets and grenades',()=>{
 const map=MAPS.terminal,g=map.structures[0];
 assert.equal(blocked(g.x,g.z,.36,map.boxes,0,1.87),false);
 assert.equal(blocked(g.x,g.z,.36,map.boxes,g.height,1.87),false);
 assert.equal(blocked(g.x,g.z,.36,map.boxes,g.height-.5,1.87),true);
 assert.ok(Math.abs(wallDistance([g.x,1.65,g.z],[0,1,0],map.boxes)-(g.height-.22-1.65))<1e-6);
 const p={x:g.x,y:g.height+1.65,z:g.z,vy:5.2};let max=feetY(p);for(let i=0;i<150;i++){verticalStep(p,1/90,map.boxes);max=Math.max(max,feetY(p));}assert.ok(max>g.height+.5);assert.ok(Math.abs(feetY(p)-g.height)<.03);
 const under={x:g.x,y:1.65,z:g.z,vy:8};for(let i=0;i<10;i++)verticalStep(under,1/90,map.boxes);assert.ok(under.y+.22<=g.height-.22+.001);
 const grenade={x:g.x,z:g.z,y:g.height+1,vy:0,vx:0,vz:0};for(let i=0;i<240;i++)advanceGrenade(grenade,1/120,map.boxes);assert.ok(grenade.y>=g.height+.09&&grenade.y<g.height+.13);
 assert.equal(lineVisible([g.x,1,g.z],[g.x,g.height+1,g.z],map.boxes),false);
});
test('fast motion cannot tunnel through a thin wall and a balcony edge falls rather than hovering',()=>{
 const boxes=[[0,0,.2,10,5,0,0]],p={x:-3,z:0,y:1.65,vy:0};move(p,10,0,boxes);assert.ok(p.x<-.45);assert.equal(blocked(p.x,p.z,.36,boxes),false);
 const map=MAPS.terminal,g=map.structures[0],q={x:g.x,y:g.height+1.65,z:g.balcony.z,vy:0};move(q,0,-5,map.boxes);for(let i=0;i<200;i++)verticalStep(q,1/90,map.boxes);assert.ok(feetY(q)<g.height-.5);
});
test('upper-storey weapon and bomb drops stay on the right floor; cannot pick up through ceilings',()=>{
 const game=new TacticalMatch(new Map()),p=game.make('upper',0),q=game.make('ground',0);game.startRound(1000);game.phase='live';const g=game.map.structures[0];
 Object.assign(p,{x:g.x,z:g.z,y:g.height+1.65});Object.assign(q,{x:g.x,z:g.z,y:1.65});p.weapon='pistol';game.drop(p);const item=game.drops[0];assert.equal(item.y,g.height);assert.equal(game.reachable(q,item),false);assert.equal(game.reachable(p,item),true);
 game.bomb={state:'carried',carrier:p.id};game.releaseBomb(p);assert.equal(game.bomb.y,g.height);
});
test('CT role keeps the northern spawns after halftime; both site paths reachable for every spawn',()=>{
 for(const map of Object.values(MAPS))for(const attackTeam of [0,1]){
  const game=new TacticalMatch(new Map());game.map=map;game.attackTeam=attackTeam;const ct=game.make('CT',1-attackTeam),t=game.make('T',attackTeam);assert.equal(ct.z,map.spawns.CT[1]);assert.equal(t.z,map.spawns.T[1]);
  for(const site of map.sites)for(const role of ['CT','T'])for(const off of [-6,-3,0,3,6]){const [x,z]=map.spawns[role],path=route(map,{x:x+off,z},site);assert.deepEqual(path.at(-1),[site.x,site.z]);}
 }
});
test('47 local original samples have distinct waveforms, valid PCM headers, no clipping or missing IDs',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/audio/manifest.json',import.meta.url)));assert.equal(SOUND_IDS.length,47);assert.deepEqual(new Set(SOUND_IDS),new Set(Object.keys(manifest.sounds)));
 const shots=[];for(const id of SOUND_IDS){const b=readFileSync(new URL('../public/assets/audio/'+id+'.wav',import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.readUInt32LE(24),44100);assert.equal(b.readUInt16LE(34),16);let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));assert.ok(peak>1000&&peak<30000,id);if(id.startsWith('shot-'))shots.push(b.toString('base64'));}assert.equal(new Set(shots).size,10);
 assert.equal(soundName('shot','awp'),'shot-awp');assert.equal(soundName('reload','awp'),'reload-sniper');assert.equal(soundName('reload','glock'),'reload-pistol');assert.equal(soundName('bogus'),null);
});
test('spatial audio pans with facing, decays with distance and is muffled by cover',()=>{
 const eye={x:0,y:1,z:0,yaw:0};assert.ok(spatialMix({x:5,z:0},eye).pan>.9);assert.ok(spatialMix({x:-5,z:0},eye).pan<-.9);assert.ok(spatialMix({x:5,z:0},{...eye,yaw:Math.PI}).pan<-.9);assert.equal(spatialMix({x:60,z:0},eye).gain,0);
 const a=spatialMix({x:5,z:0},eye),b=spatialMix({x:5,z:0},eye,{occluded:true});assert.ok(b.gain<a.gain);assert.ok(b.lowpass<a.lowpass);
});
test('footsteps require grounded running distance; crouch, walking, death and reconnect history stay silent',()=>{
 const tracker=createStepTracker(),p={id:'p',x:0,z:0,y:1.65,alive:true,grounded:true,vx:5,vz:0},state={round:1,phase:'live',players:[p]};assert.deepEqual(tracker.update(state),[]);
 p.x=1;tracker.update(state);p.x=2;assert.match(tracker.update(state)[0].kind,/step-stone-/);
 p.crouch=true;p.x=3;assert.deepEqual(tracker.update(state),[]);p.crouch=false;p.grounded=false;p.x=4;assert.deepEqual(tracker.update(state),[]);p.grounded=true;p.x=4.1;assert.equal(tracker.update(state)[0].kind,'land');p.vx=2;p.x=5;assert.deepEqual(tracker.update(state),[]);
 p.reload=1000;assert.equal(tracker.update(state)[0].kind,'reload');assert.deepEqual(tracker.update(state),[]);state.round++;assert.deepEqual(tracker.update(state),[]);p.alive=false;p.x+=2;assert.deepEqual(tracker.update(state),[]);
});
