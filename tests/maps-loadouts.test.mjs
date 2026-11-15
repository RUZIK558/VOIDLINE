import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../public/navigation.mjs';
import {MAPS,getMap,validMap} from '../public/maps.mjs';
import {WEAPONS,blocked,wallDistance,accelerate,atSite} from '../public/shared.mjs';
import {normalizeProfile,validLoadout} from '../public/cosmetics.mjs';
import {TacticalMatch} from '../match.mjs';
import {advanceGrenade,lineVisible,floorAt} from '../public/utilities.mjs';
import {startServer} from '../server.mjs';
import {WebSocket} from 'ws';
import {disposeOwnedTree} from '../public/resources.mjs';
test('eight larger maps: unique topology, bounds, every spawn reaches both sites',()=>{
 assert.equal(Object.keys(MAPS).length,8);assert.equal(new Set(Object.values(MAPS).map(m=>JSON.stringify(m.boxes))).size,8);
 assert.equal(validMap('constructor'),false);assert.equal(getMap('bogus').id,'terminal');
 for(const map of Object.values(MAPS)){
  assert.ok(map.w*map.d>=4*(38*48));assert.equal(map.sites.length,2);
  for(const [cx,z] of Object.values(map.spawns))for(const off of [-6,6,-3,3,0]){
   const x=cx+off;assert.equal(blocked(x,z,.48,map.boxes),false,map.id+' spawn');
   for(const s of map.sites){assert.equal(blocked(s.x,s.z,.48,map.boxes),false);const path=route(map,{x,z},s);assert.deepEqual(path.at(-1),[s.x,s.z],map.id+' path to '+s.id);}
  }
  assert.equal(wallDistance([0,2,map.d/2-2],[0,0,1],map.boxes),1.5);
 }
});
test('map collision context reaches movement, rays and site planting without global mutation',()=>{
 const a=new TacticalMatch(new Map()),b=new TacticalMatch(new Map());a.map=MAPS.oasis;b.map=MAPS.dockyard;
 assert.notDeepEqual(a.map.boxes,b.map.boxes);const p={x:0,z:39,yaw:0};accelerate(p,{forward:1},.3,a.map.boxes);assert.ok(p.z<39);
 const site=a.map.sites[0];assert.equal(atSite(site,a.map.sites).id,'A');assert.equal(floorAt(-3,0,a.map.boxes),1.1);assert.equal(floorAt(-3,0,b.map.boxes),0);
 assert.equal(lineVisible([-45,1,-31],[-37,1,-31],a.map.boxes),false);assert.equal(b.map.id,'dockyard');
});
test('v1 profiles migrate to ten weapon IDs; individual skins persist and malformed partials are rejected',()=>{
 const p=normalizeProfile({version:1,loadout:{rifle:'cobalt',pistol:'ember'}});assert.equal(p.version,2);assert.equal(Object.keys(p.loadout).length,13);assert.equal(p.loadout.ak47,'cobalt');assert.equal(p.loadout.glock,'ember');
 p.loadout.ak47='arctic';p.loadout.awp='carbon';p.loadout.deagle='circuit';assert.ok(validLoadout(p.loadout));assert.deepEqual(normalizeProfile(p),p);assert.equal(p.loadout.rifle,'cobalt');assert.equal(p.loadout.glock,'ember');
 assert.equal(validLoadout({ak47:'cobalt'}),false);assert.equal(validLoadout({...p.loadout,pistol:'evil'}),false);assert.equal(validLoadout({...p.loadout,evil:'cobalt'}),false);
});
test('server applies skin per gun on purchase/next round; pickup keeps original owner paint',()=>{
 const g=new TacticalMatch(new Map()),p=g.make('P',0),q=g.make('Q',0);g.startRound(1000);p.money=16000;
 const profile=normalizeProfile(null);profile.loadout.ak47='ember';profile.loadout.awp='arctic';profile.loadout.pistol='circuit';assert.equal(g.setLoadout(p,profile.loadout),null);
 assert.equal(g.buy(p,'ak47'),null);assert.equal(p.guns.ak47.skin,'ember');assert.equal(g.buy(p,'awp'),null);assert.equal(p.guns.awp.skin,'arctic');const d=g.drops.find(d=>d.weapon==='ak47');q.x=d.x;q.z=d.z;g.pickup(q);assert.equal(q.guns.ak47.skin,'ember');
 profile.loadout.awp='carbon';g.phase='live';g.setLoadout(p,profile.loadout);assert.equal(p.guns.awp.skin,'arctic');g.startRound(2000);assert.equal(p.guns.awp.skin,'carbon');assert.equal(q.guns.ak47.skin,'ember');
});
test('owned resources release once; shared materials and their textures are not destroyed',()=>{
 let gs=0,ss=0,ms=0,ts=0,removed=false;const geometry={dispose(){gs++;}},skeleton={dispose(){ss++;}},shared={dispose(){throw Error('shared disposed');}},texture={isTexture:true,dispose(){ts++;}},own={userData:{ownedTextures:[texture]},dispose(){ms++;}};
 const root={traverse(fn){fn({geometry,skeleton,material:shared,userData:{privateMaterials:[own]}});fn({geometry,skeleton,material:shared,userData:{}});},removeFromParent(){removed=true;},clear(){}};
 disposeOwnedTree(root);assert.equal(gs,1);assert.equal(ss,1);assert.equal(ms,1);assert.equal(ts,1);assert.equal(removed,true);
});
test('real server: map catalog validation + nonjoining team screen info + chosen map snapshot',{timeout:6000},async()=>{
 const s=await startServer({port:0,host:'127.0.0.1'});let ws;
 try{
  await assert.rejects(()=>s.createMatch({mapId:'unknown'}),/карта/);
  await s.createMatch({mapId:'frost',bots:[1,2]});assert.equal(s.getStatus().mapId,'frost');
  ws=new WebSocket('ws://127.0.0.1:'+s.port);const messages=[];ws.on('message',r=>messages.push(JSON.parse(r)));await new Promise(r=>ws.once('open',r));
  const until=async fn=>{for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,20));assert.ok(fn());};
  ws.send(JSON.stringify({type:'match-info'}));await until(()=>messages.some(m=>m.type==='match-info'));const info=messages.find(m=>m.type==='match-info');assert.equal(info.mapId,'frost');assert.equal(info.sides.T.humans,0);assert.equal(info.sides.CT.bots,2);assert.equal(s.getStatus().connections,0);
  const profile=normalizeProfile(null);profile.loadout.glock='ember';
  ws.send(JSON.stringify({type:'join',team:'CT',loadout:profile.loadout}));await until(()=>messages.some(m=>m.type==='state'));const state=messages.find(m=>m.type==='state');assert.equal(state.mapId,'frost');const id=messages.find(m=>m.type==='welcome').id;assert.equal(state.players.find(p=>p.id===id).team,1-state.attackTeam);
 }finally{ws?.terminate();await s.close();}
});
