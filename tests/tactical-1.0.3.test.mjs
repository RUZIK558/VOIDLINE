import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTacticalChannel,pingPosition}from'../tactical-channel.mjs';
import {QUICK_COMMANDS,commandById,selectedSector}from'../public/tactical.mjs';
import {createTacticalHold}from'../public/tactical-input.mjs';
import {MAPS}from'../public/maps.mjs';import{blocked}from'../public/shared.mjs';
import{DEFAULTS,normalizeSettings}from'../public/settings-schema.mjs';
import{startServer}from'../server.mjs';import{WebSocket}from'ws';
const game=()=>({phase:'live',map:MAPS.terminal});const actor=(id='p',team=0)=>({id,team,name:'ALLY',x:0,y:1.65,z:29,yaw:0,pitch:0,alive:true});
test('canonical six quick phrases and sector selection have no free-text / prototype fallback',()=>{
 assert.equal(QUICK_COMMANDS.length,6);assert.ok(QUICK_COMMANDS.some(c=>c.text==='ЧЕРТОВ ПРИДУРОК!!!'));assert.equal(commandById('constructor'),undefined);assert.equal(commandById({id:'go_a'}),undefined);assert.equal(selectedSector(0,0),null);assert.equal(selectedSector(NaN,1),null);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;assert.equal(selectedSector(Math.sin(a)*120,-Math.cos(a)*120),i);}
 assert.equal(DEFAULTS.bindings.tactical,'KeyV');assert.equal(normalizeSettings({bindings:{forward:'KeyW'}}).bindings.tactical,'KeyV');
});
test('server clips pings to a real surface, ignores forged position/team/name, keeps upper-floor height',()=>{
 const g=game(),p=actor(),ch=createTacticalChannel(()=>g),out=ch.handle(p,{action:'ping',pos:{x:99999,y:99999,z:99999},team:1,name:'FORGED'},10000);
 assert.equal(out.event.senderId,p.id);assert.equal(out.event.team,0);assert.equal(out.event.name,'ALLY');assert.ok(out.event.pos.z>14&&out.event.pos.z<14.1);assert.equal(out.event.pos.y,p.y);
 assert.equal(ch.snapshot(1,10000).length,0);assert.equal(ch.snapshot(0,10000).length,1);
 const upper=actor('upper');const room=g.map.structures[0];Object.assign(upper,{x:room.x,y:room.height+1.65,z:room.z,pitch:-1.5});const pos=pingPosition(upper,g.map);assert.ok(pos.y>=room.height&&pos.y<room.height+.2);
 const snap=ch.snapshot(0,10001);snap[0].pos.z=999;assert.notEqual(ch.snapshot(0,10002)[0].pos.z,999);
});
test('dead, disconnected, intermission, unknown commands and sky pings cannot send markers',()=>{
 const g=game(),p=actor(),ch=createTacticalChannel(()=>g);
 for(const [key,value]of[['alive',false],['disconnected',true]]){const old=p[key];p[key]=value;assert.ok(ch.handle(p,{action:'ping'},10000).error);p[key]=old;}
 g.phase='end';assert.ok(ch.handle(p,{action:'command',command:'go_a'},10000).error);g.phase='live';assert.ok(ch.handle(p,{action:'command',command:'constructor'},10000).error);
 p.pitch=Math.PI/2-.01;assert.equal(pingPosition(p,g.map),null);assert.ok(ch.handle(p,{action:'ping'},10000).error);assert.equal(ch.snapshot(0,10000).length,0);
});
test('team radio uses canonical map sites, safe mid, sender height; quiet/curse have no fake target',()=>{
 for(const map of Object.values(MAPS)){
  const g={phase:'freeze',map},p=actor(),ch=createTacticalChannel(()=>g);let now=10000;
  for(const c of QUICK_COMMANDS){const result=ch.handle(p,{action:'command',command:c.id,text:'HACK'},now);assert.equal(result.event.text,c.text);if(c.target==='A'||c.target==='B'){const site=map.sites.find(s=>s.id===c.target);assert.equal(result.event.pos.x,site.x);assert.equal(result.event.pos.z,site.z);}if(c.target==='mid')assert.equal(blocked(result.event.pos.x,result.event.pos.z,.5,map.boxes),false);if(!c.target)assert.equal(result.event.pos,null);now+=5100;}
 }
});
test('rate limits are per sender, curse is limited, markers replace own ping, expire and clear',()=>{
 const ch=createTacticalChannel(game),p=actor();assert.ok(ch.handle(p,{action:'ping'},10000).event);assert.ok(ch.handle(p,{action:'command',command:'go_b'},10001).error);assert.ok(ch.handle(actor('other'),{action:'ping'},10001).event);
 assert.ok(ch.handle(p,{action:'command',command:'curse'},11000).event);assert.ok(ch.handle(p,{action:'command',command:'curse'},13000).error);assert.ok(ch.handle(p,{action:'command',command:'go_a'},14000).event);assert.equal(ch.snapshot(0,14000).filter(m=>m.senderId===p.id).length,1);assert.equal(ch.snapshot(0,23000).length,0);ch.handle(p,{action:'ping'},24000);ch.clear();assert.deepEqual(ch.snapshot(0,24000),[]);
});
function controller(){let cb=null,enabled=true;const events=[];const c=createTacticalHold({enabled:()=>enabled,schedule:fn=>(cb=fn,1),unschedule:()=>{cb=null;},onTap:()=>events.push('tap'),onOpen:()=>events.push('open'),onClose:()=>events.push('close'),onCommit:i=>events.push(i)});return{c,events,tick:()=>{const f=cb;cb=null;f?.();},disable:()=>{enabled=false;}};}
test('V tap sends exactly one ping; autorepeat cannot spawn timers or duplicate messages',()=>{const{c,events,tick}=controller();assert.equal(c.press(),true);assert.equal(c.press(),false);assert.equal(c.release(),true);assert.equal(c.release(),false);tick();assert.deepEqual(events,['tap']);});
test('V hold sends only selected command; mouse selection never becomes a tap',()=>{const{c,events,tick}=controller();c.press();tick();assert.ok(c.isOpen);c.move(160,-70,selectedSector);assert.equal(c.selected,1);c.release();assert.deepEqual(events,['open','close',1]);assert.equal(c.isOpen,false);});
test('center, focus/death cancellation and disabled key release do not send a ping or command',()=>{for(const mode of['center','cancel','disable']){const{c,events,tick,disable}=controller();c.press();tick();if(mode==='cancel'){c.choose(3);c.cancel();}if(mode==='disable')disable();c.release();assert.deepEqual(events,['open','close']);}const{c,events,tick}=controller();c.press();c.cancel();tick();c.release();assert.deepEqual(events,[]);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){const at=Date.now();while(!fn()){if(Date.now()-at>5000)throw Error('tactical network timeout');await sleep(15);}}
async function join(port,team,name){const w=new WebSocket('ws://127.0.0.1:'+port);w.messages=[];w.on('message',b=>{const m=JSON.parse(b);w.messages.push(m);if(m.type==='welcome')w.id=m.id;if(m.type==='state')w.state=m;});await new Promise((r,j)=>{w.once('open',r);w.once('error',j);});w.send(JSON.stringify({type:'join',team,name}));await until(()=>w.id&&w.state);return w;}
test('real WebSockets: only allies receive ping/radio; canonical sender, spam error private, restart clears marks',{timeout:15000},async()=>{
 const s=await startServer({port:0,host:'127.0.0.1',rules:{buyMs:30000}});let a,b,enemy,late;
 try{await s.createMatch({bots:[0,0]});a=await join(s.port,'T','SENDER');b=await join(s.port,'T','ALLY');enemy=await join(s.port,'CT','ENEMY');a.send(JSON.stringify({type:'tactical',action:'ping',team:enemy.state.players.find(p=>p.id===enemy.id).team,name:'FORGED',pos:{x:999,y:999,z:999}}));await until(()=>s.getStatus().antiCheat.rejected>0);assert.equal(b.messages.some(m=>m.type==='tactical'),false);a.send(JSON.stringify({type:'tactical',action:'ping'}));await until(()=>b.messages.some(m=>m.type==='tactical'));let received=b.messages.find(m=>m.type==='tactical');assert.equal(received.event.senderId,a.id);assert.equal(received.event.name,'SENDER');assert.ok(received.event.pos.x<100);await sleep(70);assert.equal(enemy.messages.some(m=>m.type==='tactical'),false);
 a.send(JSON.stringify({type:'tactical',action:'command',command:'go_b'}));await until(()=>a.messages.some(m=>m.type==='tactical-error'));assert.equal(b.messages.some(m=>m.type==='tactical-error'),false);
 late=await join(s.port,'T','LATE');const snap=late.messages.find(m=>m.type==='tactical-state'&&m.markers.length);assert.ok(snap);assert.equal(snap.event,undefined);
 await sleep(950);const priorRejected=s.getStatus().antiCheat.rejected;a.send(JSON.stringify({type:'tactical',action:'command',command:'go_b',text:'FORGED'}));await until(()=>s.getStatus().antiCheat.rejected>priorRejected);assert.equal(b.messages.some(m=>m.type==='tactical'&&m.event.command==='go_b'),false);a.send(JSON.stringify({type:'tactical',action:'command',command:'go_b'}));await until(()=>b.messages.some(m=>m.type==='tactical'&&m.event.command==='go_b'));received=b.messages.find(m=>m.type==='tactical'&&m.event.command==='go_b');assert.equal(received.event.text,'Идём Б!');assert.equal(enemy.messages.some(m=>m.type==='tactical'),false);
 for(const w of[a,b,enemy,late])w.messages=[];s.restartMatch();await until(()=>b.messages.some(m=>m.type==='tactical-state'));assert.ok(b.messages.filter(m=>m.type==='tactical-state').every(m=>m.markers.length===0));
 }finally{for(const w of[a,b,enemy,late])w?.terminate();s.close();}
});
