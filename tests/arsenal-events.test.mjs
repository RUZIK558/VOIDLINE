import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TacticalMatch } from './legacy-fixture.mjs';
import { WEAPONS,SHOP,weaponSlot,ROUND_EVENTS,accelerate,shotSpread } from './legacy-fixture.mjs';
import { normalizeSettings } from '../public/settings-schema.mjs';
import { SessionReservations } from '../net-session.mjs';
const setup=()=>{const players=new Map(),events=[],g=new TacticalMatch(players,e=>events.push(e));const p=g.make('A',0),q=g.make('B',1);g.startRound(1000);p.money=q.money=16000;return {g,p,q,events};};
test('all ten weapons have real magazines, prices, cadence, reload, damage and slots',()=>{
 assert.equal(Object.values(WEAPONS).filter(w=>!w.melee).length,10);
 for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>!w.melee)){assert.ok(w.mag>0&&w.damage>0&&w.delay>0&&w.reload>0);assert.ok(SHOP[id].price>0);assert.ok(['primary','secondary'].includes(weaponSlot(id)));}
});
test('arsenal: slot replacement drops previous gun, preserves ammo; side restrictions are server-enforced',()=>{
 const {g,p,q}=setup();assert.equal(g.buy(p,'ak47'),null);assert.equal(p.weapon,'ak47');p.guns.ak47.ammo=9;assert.equal(g.buy(p,'awp'),null);assert.equal(p.weapon,'awp');assert.equal(p.guns.ak47,undefined);assert.equal(g.drops.find(d=>d.weapon==='ak47').ammo,9);assert.ok(g.buy(p,'m4a1s'));assert.equal(g.buy(q,'m4a1s'),null);assert.ok(g.buy(q,'ak47'));
 assert.equal(g.buy(p,'deagle'),null);assert.equal(p.guns.pistol,undefined);assert.equal(Object.keys(p.guns).filter(id=>!WEAPONS[id].melee).length,2);
});
test('new automatic guns fire held trigger, sniper/pistol require new click; scopes reduce standing spread',()=>{
 const {g,p,q,events}=setup();g.buy(p,'mp9');g.phase='live';q.x=6;q.z=-20;p.inputAt=2000;p.input={fire:true};p.nextShot=0;g.tick(2000,.016);g.tick(2100,.016);assert.equal(p.guns.mp9.ammo,28);assert.equal(events.filter(e=>e.type==='shot').length,2);
 assert.ok(shotSpread('awp',{scoped:true})<shotSpread('awp',{scoped:false}));
});
test('new weapon reload transfers exact reserve and obeys its own reload duration',()=>{
 const {g,p}=setup();g.buy(p,'awp');g.phase='live';p.guns.awp.ammo=1;p.guns.awp.reserve=2;g.reload(p,10000);assert.equal(p.reload,13600);g.tick(13601,.016);assert.equal(p.guns.awp.ammo,3);assert.equal(p.guns.awp.reserve,0);
});
test('random event is server-owned, transmitted, expires with round, and classic resets modifiers',()=>{
 const {g,p}=setup();g.mode='events';g.startRound(5000);assert.ok(ROUND_EVENTS.includes(g.roundEvent));assert.equal(g.snapshot(5000).roundEvent.id,g.roundEvent.id);assert.equal(g.snapshot(5000).mode,'events');assert.equal(p.eventSpeed,g.roundEvent.speed);g.mode='classic';g.startRound(6000);assert.equal(g.roundEvent.id,'standard');assert.equal(p.eventSpeed,1);
 const a={x:-6,z:20,yaw:0,eventSpeed:1},b={...a,eventSpeed:1.3};accelerate(a,{forward:1},.5);accelerate(b,{forward:1},.5);assert.ok(Math.abs(b.z-20)>Math.abs(a.z-20));
});
test('crosshair settings clamp numbers, validate colors, preserve switches',()=>{
 const s=normalizeSettings({crossSize:900,crossGap:-20,crossThickness:3,crossOpacity:0,crossColor:'url(evil)',crossDot:true,crossDynamic:true});assert.equal(s.crossSize,20);assert.equal(s.crossGap,0);assert.equal(s.crossOpacity,.2);assert.equal(s.crossColor,'#95ed4a');assert.equal(s.crossDot,true);assert.equal(s.crossDynamic,true);
});
test('resume tokens are unguessable, not reusable concurrently, expire and cannot be forged',()=>{
 const s=new SessionReservations(100);const token=s.create('id');assert.match(token,/^[a-f0-9]{64}$/);assert.equal(s.resume(token,0),null);s.disconnect(token,1000);assert.equal(s.resume('fake',1010),null);assert.equal(s.resume(token,1010),'id');assert.equal(s.resume(token,1011),null);s.disconnect(token,2000);assert.deepEqual(s.expire(2101),['id']);assert.equal(s.resume(token,2102),null);
});
test('lag compensation clamps client timestamps to 200ms and never accepts future time',()=>{const {g,p}=setup();g.input(p,{shotTime:-99999},1000);assert.equal(p.shotTime,800);g.input(p,{shotTime:99999},1000);assert.equal(p.shotTime,1000);g.input(p,{shotTime:'bad'},1000);assert.equal(p.shotTime,1000);});
