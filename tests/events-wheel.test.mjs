import {test} from 'node:test';import assert from 'node:assert/strict';
import {TacticalMatch,DEFAULT_RULES} from '../match.mjs';
import {WEAPONS,KNIVES,SHOP,accelerate} from '../public/shared.mjs';
import {ROUND_EVENTS,EVENT_POOL,shuffledEventIds} from '../public/round-events.mjs';
import {UTILITY,utilityCount} from '../public/utilities.mjs';
import {availableSlots,cycleSlot} from '../public/slot-cycle.mjs';
function fixture(id='standard'){
 const log=[],g=new TacticalMatch(new Map(),e=>log.push(e),{halfRounds:9999});
 const p=g.make('A',0),q=g.make('B',1);g.mode='events';g.eventDeck=[id];g.startRound(1000);
 return {g,p,q,log};
}
function line(g,p,q){g.phase='live';g.until=999999;p.x=q.x=0;p.z=37;q.z=35.6;p.y=q.y=1.65;p.yaw=0;q.yaw=Math.PI;p.pitch=0;p.nextShot=0;}
function gun(p,id='pistol'){p.weapon=id;p.guns[id]={ammo:WEAPONS[id].mag,reserve:WEAPONS[id].reserve,owner:p.id};}
test('55 distinct nonstandard events; immutable valid catalog and shuffled bag',()=>{
 assert.equal(EVENT_POOL.length,55);assert.equal(new Set(ROUND_EVENTS.map(e=>e.id)).size,56);
 for(const e of ROUND_EVENTS){assert.ok(Object.isFrozen(e));assert.ok(!e.name.includes('\uFFFD')&&!e.description.includes('\uFFFD'));
 for(const k of ['hp','speed','gravity','cadence','reload','price','jump','plant','defuse','fuse','round','acceleration'])assert.ok(Number.isFinite(e[k])&&e[k]>0,`${e.id}:${k}`);
 if(e.guns)for(const id of e.guns)assert.ok(WEAPONS[id]&&!WEAPONS[id].melee);
 if(e.utilities){assert.ok(Object.values(e.utilities).reduce((a,b)=>a+b,0)<=4);for(const [id,n] of Object.entries(e.utilities))assert.ok(n<=UTILITY[id].max);}}
 const a=shuffledEventIds(()=>.37);assert.equal(a.length,55);assert.equal(new Set(a).size,55);assert.ok(!a.includes('standard'));
});
test('shuffle deck covers every event before repeat, including cycle boundary',()=>{
 const {g}=fixture();g.eventDeck=[];let last=null;for(let cycle=0;cycle<3;cycle++){const ids=[];for(let i=0;i<55;i++){g.startRound(2000+i);assert.notEqual(g.roundEvent.id,last);last=g.roundEvent.id;ids.push(last);}assert.equal(new Set(ids).size,55);}
 g.reset();assert.equal(g.eventDeck.length,0);assert.equal(g.roundEvent.id,'standard');
});
for(const e of EVENT_POOL)test(`event ${e.id}: spawn, live tick, snapshot, clean classic transition`,()=>{
 const {g,p,q}=fixture(e.id);assert.equal(g.roundEvent.id,e.id);assert.equal(p.hp,e.hp);assert.equal(q.hp,e.hp);assert.equal(p.eventSpeed,e.speed);assert.ok(utilityCount(p)<=4);assert.ok(Object.keys(KNIVES).every(id=>p.guns[id]));
 g.tick(g.until+1,.016);assert.equal(g.phase,'live');assert.equal(g.snapshot(14000).players[0].maxHp,e.hp);
 if(e.guns)assert.deepEqual(Object.keys(p.guns).filter(id=>!WEAPONS[id].melee),e.guns);
 g.mode='classic';g.startRound(20000);assert.equal(p.hp,100);assert.equal(p.maxHp,100);assert.equal(p.eventSpeed,1);assert.equal(p.eventAcceleration,1);assert.equal(g.roundEvent.id,'standard');assert.ok(p.guns.pistol);
});
test('temporary arsenal and grants restore surviving gear without laundering free guns',()=>{
 const {g,p}=fixture();p.money=16000;g.buy(p,'ak47');p.guns.ak47.ammo=7;p.armor=37;p.grenades.smoke=1;
 g.eventDeck=['snipers'];g.startRound(2000);assert.ok(p.guns.awp);assert.ok(!p.guns.ak47);assert.ok(g.buy(p,'mp9'));g.drop(p);assert.ok(p.guns.awp);assert.equal(g.drops.length,0);
 const money=p.money;g.spawn(p,0);assert.ok(!p.guns.pistol);assert.equal(p.money,money);
 g.mode='classic';g.startRound(3000);assert.equal(p.guns.ak47.ammo,7);assert.ok(!p.guns.awp);assert.equal(p.armor,37);assert.equal(p.grenades.smoke,1);
 g.mode='events';g.eventDeck=['snipers'];g.startRound(4000);g.phase='live';g.kill(p,null,4500);g.mode='classic';g.startRound(5000);assert.ok(!p.guns.ak47);assert.ok(!p.guns.awp);assert.ok(p.guns.pistol);
});
test('unarmored and knife-only equipment restrictions are server enforced',()=>{
 let {g,p}=fixture('unarmored');p.money=16000;assert.equal(p.armor,0);assert.ok(g.buy(p,'armor'));assert.ok(g.buy(p,'helmet'));
 ({g,p}=fixture('knifefight'));p.money=16000;assert.ok(g.buy(p,'he'));assert.ok(g.buy(p,'pistol'));assert.equal(utilityCount(p),0);p.grenades.he=1;g.phase='live';assert.equal(g.throwGrenade(p,'he',false,2000),false);
 g.bomb={state:'idle'};g.drops=[{id:'bad',x:p.x,z:p.z,weapon:'awp',ammo:1,reserve:1}];g.pickup(p);assert.ok(!p.guns.awp);
});
test('sale prices and round cash are applied once; bounty rewards use event amount',()=>{
 const {g,p,q}=fixture('sale');assert.equal(p.money,2300);assert.equal(g.buy(p,'armor'),null);assert.equal(p.money,1975);g.spawn(p,0);assert.equal(p.money,1975);
 g.roundEvent=ROUND_EVENTS.find(e=>e.id==='bounty');g.phase='live';const before=p.money;g.kill(q,p,2000);assert.equal(p.money,before+1500);
});
test('cadence, reload, infinite magazine, spread and recoil are authoritative',()=>{
 for(const id of ['rapid','deliberate','quickreload','bottomless','laser','wild']){
 const {g,p,q}=fixture(id);line(g,p,q);q.x=10;gun(p);const e=g.roundEvent;g.fire(p,2000);assert.equal(p.nextShot,2000+WEAPONS.pistol.delay*1000*e.cadence);assert.equal(p.guns.pistol.ammo,WEAPONS.pistol.mag-(e.infiniteAmmo?0:1));
 p.guns.pistol.ammo=1;g.reload(p,3000);assert.equal(p.reload,3000+WEAPONS.pistol.reload*1000*e.reload);
 if(id==='laser'){const snap=g.snapshot(3000).players[0];assert.equal(snap.recoil.pitch,0);assert.equal(snap.recoil.yaw,0);}
 }
});
test('head-only ignores body hits; ordinary head hit still damages',()=>{
 const {g,p,q,log}=fixture('headhunter');line(g,p,q);gun(p);p.bot=true;q.hp=q.maxHp=500;
 const save=Math.random;Math.random=()=>.5;try{p.pitch=Math.atan2(-.7,1.4);g.fire(p,2000);assert.equal(q.hp,500);p.pitch=0;g.fire(p,4000);assert.ok(q.hp<500);assert.ok(log.some(e=>e.type==='hit'&&e.head));}finally{Math.random=save;}
});
test('melee damage multipliers, capped vampire healing and kill heal/refill',()=>{
 let {g,p,q}=fixture('glass');line(g,p,q);p.weapon='butterfly';g.fire(p,2000);assert.equal(q.hp,40);
 ({g,p,q}=fixture('vampire'));line(g,p,q);p.hp=50;q.hp=10;p.weapon='butterfly';g.fire(p,2000);assert.equal(p.hp,53); // actual 10, not overkill 40
 ({g,p,q}=fixture('siphon'));line(g,p,q);p.hp=80;gun(p);p.guns.pistol.ammo=1;const reserve=p.guns.pistol.reserve;g.kill(q,p,2000);assert.equal(p.hp,100);assert.equal(p.guns.pistol.ammo,WEAPONS.pistol.mag);assert.equal(p.guns.pistol.reserve,reserve-WEAPONS.pistol.mag+1);
});
test('regeneration waits four seconds since damage and never exceeds event max HP',()=>{
 const {g,p,q}=fixture('regeneration');g.tick(g.until,.01);const t=g.liveStartedAt;p.hp=50;p.lastDamageAt=t+1000;
 g.tick(t+4999,.1);assert.equal(p.hp,50);g.tick(t+5100,.1);assert.equal(p.hp,51);p.hp=99;g.tick(t+6100,1);assert.equal(p.hp,100);
 g.hurtUtility(p,5,{team:q.team,owner:q.id},t+6200,false);assert.equal(p.lastDamageAt,t+6200);g.tick(t+6300,.1);assert.equal(p.hp,95);
});
test('grenade fuse/speed changes and replenishment limits',()=>{
 for(const id of ['shortpins','longthrows']){const {g,p}=fixture(id);g.phase='live';p.yaw=p.pitch=0;assert.equal(g.throwGrenade(p,'he',false,2000),true);const proj=g.projectiles[0];assert.equal(proj.detonateAt,2000+UTILITY.he.fuse*g.roundEvent.grenadeFuse);assert.equal(-proj.vz,14*g.roundEvent.grenadeSpeed);}
 const {g,p}=fixture('heparty');g.tick(g.until,.01);let t=g.liveStartedAt;p.grenades.he=0;g.tick(t+11999,.01);assert.equal(p.grenades.he,0);g.tick(t+12000,.01);assert.equal(p.grenades.he,1);g.tick(t+24000,.01);assert.equal(p.grenades.he,1);
 p.grenades={he:0,flash:2,smoke:1,fire:1};g.tick(t+36000,.01);assert.equal(utilityCount(p),4);assert.equal(p.grenades.he,0);
});
test('plant, defuse, fuse and round timers scale without changing shared rules',()=>{
 const {g,p,q}=fixture('quickplant');g.phase='live';const site=g.map.sites[0];p.x=site.x;p.z=site.z;p.vx=p.vz=0;g.bomb={state:'carried',carrier:p.id};g.objective(p,{interact:true},2000);assert.equal(p.action.duration,1500);g.objective(p,{interact:true},3500);assert.equal(g.bomb.state,'planted');
 for(const id of ['shortfuse','longfuse']){g.roundEvent=ROUND_EVENTS.find(e=>e.id===id);g.bomb={state:'carried',carrier:p.id};g.objective(p,{interact:true},5000);g.objective(p,{interact:true},8000);assert.equal(g.bomb.explodeAt,8000+40000*g.roundEvent.fuse);}
 g.roundEvent=ROUND_EVENTS.find(e=>e.id==='quickdefuse');q.x=p.x;q.z=p.z;q.vx=q.vz=0;q.kit=true;g.objective(q,{interact:true},9000);assert.equal(q.action.duration,2500);
 g.roundEvent=ROUND_EVENTS.find(e=>e.id==='blitz');g.phase='freeze';g.until=10000;g.tick(10000,.01);assert.equal(g.until,10000+90000*.65);assert.equal(DEFAULT_RULES.roundMs,90000);assert.equal(g.rules.roundMs,90000);
});
test('ice acceleration reduces acceleration and braking; high jump and gravity applied',()=>{
 const a={x:0,z:37,y:1.65,yaw:0,vx:0,vz:0,eventSpeed:1,eventAcceleration:1},b={...a,eventAcceleration:.2};accelerate(a,{forward:1},.016,[]);accelerate(b,{forward:1},.016,[]);assert.ok(Math.abs(b.vz)<Math.abs(a.vz));
 const {g,p}=fixture('highjump');g.phase='live';g.until=99999;g.input(p,{jump:true},2000);g.tick(2000,.016);assert.ok(p.vy>8);
});
test('wheel traverses primary, secondary, chosen knife and owned utilities both directions',()=>{
 const p={alive:true,weapon:'ak47',inventory:['pistol','butterfly','karambit','m9','ak47'],grenades:{he:1,flash:0,smoke:1,fire:0}};
 assert.deepEqual(availableSlots(p,'m9').map(s=>s.id),['ak47','pistol','m9','he','smoke']);
 let curr;const forward=[];for(let i=0;i<5;i++){curr=cycleSlot(p,'m9',1,curr);forward.push(curr.id);}assert.deepEqual(forward,['pistol','m9','he','smoke','ak47']);assert.equal(cycleSlot(p,'m9',-1).id,'smoke');
 p.utility='he';assert.equal(cycleSlot(p,'m9',-1).id,'m9');p.grenades.he=0;assert.equal(cycleSlot(p,'m9',1).id,'ak47');
 assert.equal(availableSlots({...p,alive:false}).length,0);assert.equal(cycleSlot({alive:true,inventory:[]},'m9',1),null);
 assert.equal(availableSlots({alive:true,inventory:['butterfly'],grenades:{}},'m9')[0].id,'butterfly');
});
