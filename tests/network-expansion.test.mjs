import {test} from 'node:test';import assert from 'node:assert/strict';import {WebSocket} from 'ws';import {startServer} from '../server.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){const t=Date.now();while(!fn()){if(Date.now()-t>5000)throw Error('network expansion timeout');await wait(15);}}
async function join(port,args={}){const w=new WebSocket(`ws://127.0.0.1:${port}`);w.msg=[];w.on('message',r=>{const m=JSON.parse(r);w.msg.push(m);if(m.type==='welcome'){w.id=m.id;w.token=m.resume;}if(m.type==='state')w.state=m;});w.sendJSON=m=>w.send(JSON.stringify(m));await new Promise((r,j)=>{w.once('open',r);w.once('error',j);});w.sendJSON({type:'join',name:'TEST',...args});await until(()=>w.id&&w.state);return w;}
test('real network: CT/T, server events, reconnect same player, text chat and authorized voice signaling',{timeout:15000},async()=>{
 const s=await startServer({port:0,host:'127.0.0.1',rules:{buyMs:4000}});let a,b,c;
 try{
  await s.createMatch({bots:[0,0],mode:'events'});a=await join(s.port,{team:'T'});b=await join(s.port,{team:'CT'});
  assert.equal(a.state.players.find(p=>p.id===a.id).team,a.state.attackTeam);assert.equal(b.state.players.find(p=>p.id===b.id).team,1-b.state.attackTeam);assert.equal(a.state.mode,'events');assert.ok(a.state.roundEvent.name);
  a.sendJSON({type:'chat',text:'<script>not executed</script>'});await until(()=>b.msg.some(m=>m.type==='chat'));assert.equal(b.msg.find(m=>m.type==='chat').text,'<script>not executed</script>');
  a.sendJSON({type:'voice-signal',target:b.id,signal:{ice:'forged'}});await wait(30);assert.ok(!b.msg.some(m=>m.type==='voice-signal'));
  a.sendJSON({type:'voice-join'});b.sendJSON({type:'voice-join'});await until(()=>b.msg.some(m=>m.type==='voice-peers'));
  a.sendJSON({type:'voice-signal',target:b.id,signal:{ice:{candidate:'test'}}});await until(()=>b.msg.some(m=>m.type==='voice-signal'));assert.equal(b.msg.find(m=>m.type==='voice-signal').from,a.id);
  const id=a.id,token=a.token;await new Promise(r=>{a.once('close',r);a.close();});c=await join(s.port,{resume:token,name:'RENAMED',team:'CT'});assert.equal(c.id,id);assert.equal(c.state.players.filter(p=>p.id===id).length,1);assert.equal(c.state.players.find(p=>p.id===id).name,'TEST');
  const welcome=c.msg.find(m=>m.type==='welcome');assert.equal(welcome.reconnected,true);assert.equal(c.token,token);
 }finally{for(const w of [a,b,c])w?.terminate();await s.close();}
});
test('full side refuses sixth human instead of silently assigning other side',{timeout:12000},async()=>{
 const s=await startServer({port:0,host:'127.0.0.1'}),all=[];try{await s.createMatch({bots:[0,0]});for(let i=0;i<5;i++)all.push(await join(s.port,{team:'T'}));const w=new WebSocket(`ws://127.0.0.1:${s.port}`);all.push(w);let error;w.on('message',r=>{const m=JSON.parse(r);if(m.type==='join-error')error=m.error;});await new Promise(r=>w.once('open',r));w.send(JSON.stringify({type:'join',team:'T'}));await until(()=>error);assert.match(error,/заполнена/);}finally{all.forEach(w=>w.terminate());await s.close();}});
