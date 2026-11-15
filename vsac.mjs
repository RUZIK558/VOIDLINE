import{randomBytes}from'node:crypto';
export const VSAC_PROTOCOL=1;
const sets={input:new Set('type seq yaw pitch forward side fire altFire jump slow crouch interact scoped shotTime grenade weapon reload drop bombOnly pickup throwGrenade underhand'.split(' ')),join:new Set('type name team resume loadout ac'.split(' ')),ping:new Set(['type','sent']),'match-info':new Set(['type']),buy:new Set(['type','item']),cosmetics:new Set(['type','loadout']),chat:new Set(['type','text']),'voice-join':new Set(['type']),'voice-leave':new Set(['type']),'voice-signal':new Set(['type','target','signal']),tactical:new Set(['type','action','command']),'ac-report':new Set(['type','nonce','seq','client'])};
const bools='fire altFire jump slow crouch interact scoped reload drop bombOnly pickup throwGrenade underhand'.split(' ');
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),seq=v=>Number.isSafeInteger(v)&&v>=0;
function dangerous(v,depth=0){if(depth>8)return true;if(!v||typeof v!=='object')return false;return Object.entries(v).some(([k,x])=>['__proto__','prototype','constructor'].includes(k)||dangerous(x,depth+1));}
function schema(m){const allowed=sets[m.type];if(!allowed)return 'unknown-command';if(Object.keys(m).some(k=>!allowed.has(k)))return 'untrusted-field';if(dangerous(m))return 'unsafe-object';
 if(m.type==='input'){
  for(const k of bools)if(k in m&&typeof m[k]!=='boolean')return 'invalid-input-type';
  for(const k of ['yaw','pitch','forward','side','shotTime'])if(k in m&&(!Number.isFinite(m[k])||Math.abs(m[k])>1e15))return 'invalid-number';
  for(const k of ['forward','side'])if(k in m&&Math.abs(m[k])>1.00001)return 'invalid-axis';
  if('pitch'in m&&Math.abs(m.pitch)>Math.PI/2+.05)return 'invalid-pitch';
  for(const k of ['weapon','grenade'])if(m[k]!=null&&(typeof m[k]!=='string'||m[k].length>32))return 'invalid-item';
  if('seq'in m&&!seq(m.seq))return 'invalid-sequence';
 }
 if(m.type==='join'&&m.ac!=null&&(!object(m.ac)||m.ac.protocol!==VSAC_PROTOCOL||Object.keys(m.ac).some(k=>!['protocol','build'].includes(k))||typeof m.ac.build!=='string'||m.ac.build.length>32))return 'invalid-protocol';
 if(m.type==='join'&&m.resume!=null&&(typeof m.resume!=='string'||m.resume.length>128))return 'invalid-session';
 if(['cosmetics','join'].includes(m.type)&&m.loadout!=null&&!object(m.loadout))return 'invalid-loadout';
 if(m.type==='buy'&&(typeof m.item!=='string'||m.item.length>32))return 'invalid-item';
 if(m.type==='chat'&&(typeof m.text!=='string'||m.text.length>2000))return 'invalid-chat';
 if(m.type==='voice-signal'&&(!object(m.signal)||typeof m.target!=='string'||m.target.length>80||JSON.stringify(m.signal).length>12000))return 'invalid-signal';
 if(m.type==='ping'&&m.sent!=null&&!Number.isFinite(m.sent))return 'invalid-ping';
 if(m.type==='ac-report'&&(!seq(m.seq)||typeof m.nonce!=='string'||m.nonce.length!==32||!object(m.client)||Object.keys(m.client).some(k=>!['state','build','digest'].includes(k))||!['clean','modified','unavailable','development','browser'].includes(m.client.state)||typeof m.client.build!=='string'||m.client.build.length>32||typeof m.client.digest!=='string'||!/^([a-f0-9]{64})?$/.test(m.client.digest)))return 'invalid-client-report';
 return null;
}
export function createVSAC({clock=()=>Date.now(),onEvent=()=>{},requireProtocol=false}={}){
 const connections=new Set(),events=[],counters={accepted:0,rejected:0,rateLimited:0,disconnected:0,reports:0};
 const emit=(c,code,extra={})=>{const now=clock();if(c.lastLog?.code===code&&now-c.lastLog.at<3000)return;c.lastLog={code,at:now};const event={time:now,connection:c.id,player:c.player||null,code,...extra};events.push(event);if(events.length>200)events.shift();try{onEvent(event);}catch{}};
 function open({send=()=>{},close=()=>{}}={}){const c={id:randomBytes(6).toString('hex'),player:null,protocol:0,lastSeq:-1,reportSeq:-1,score:0,at:clock(),tokens:240,inputTokens:180,otherTokens:60,lastReport:0,nonce:'',issued:0,closed:false,send,close};connections.add(c);
  function reject(code,weight=2){c.lastReject={type:c.inType||null,code};counters.rejected++;c.score+=weight;emit(c,code,{score:Math.round(c.score)});if(c.score>=24&&!c.closed){c.closed=true;counters.disconnected++;emit(c,'disconnect',{reason:'repeated-protocol-abuse'});close(1008,'VSAC: protocol abuse');}return null;}
  const api={inspect(raw,binary=false){c.inType=null;if(c.closed)return null;const now=clock(),dt=Math.max(0,(now-c.at)/1000);c.at=now;c.score=Math.max(0,c.score-dt*.5);c.tokens=Math.min(240,c.tokens+dt*140);c.inputTokens=Math.min(180,c.inputTokens+dt*100);c.otherTokens=Math.min(60,c.otherTokens+dt*25);
   if(--c.tokens<0){counters.rateLimited++;return reject('packet-rate',.4);}if(binary)return reject('binary-packet');if(Buffer.byteLength(raw)>16384)return reject('oversized-packet',8);
   let m;try{m=JSON.parse(raw.toString());}catch{return reject('invalid-json');}if(!object(m)||typeof m.type!=='string')return reject('invalid-envelope');
   c.inType=m.type;const group=m.type==='input'?'inputTokens':'otherTokens';if(--c[group]<0){counters.rateLimited++;return reject('command-rate',.4);}
   const error=schema(m);if(error)return reject(error,error==='untrusted-field'?6:2);if(!c.player&&!['join','match-info','ping'].includes(m.type))return reject('not-joined');
   if(m.type==='input'){if((c.protocol===1||m.seq!=null)&&(!seq(m.seq)||m.seq<=c.lastSeq))return reject('replayed-input',1);if(m.seq!=null)c.lastSeq=m.seq;}
   if(m.type==='join'&&requireProtocol&&m.ac?.protocol!==1)return reject('current-protocol-required');if(m.type==='join'&&m.ac)c.protocol=1;
   counters.accepted++;return m;
  },bind(player){c.player=player;if(c.protocol===1)api.challenge();},challenge(){c.nonce=randomBytes(16).toString('hex');c.issued=clock();c.send({type:'ac-challenge',nonce:c.nonce,protocol:VSAC_PROTOCOL});},report(m){if(!c.player||!c.protocol)return reject('unexpected-client-report');if(m.nonce!==c.nonce||m.seq<=c.reportSeq)return reject('replayed-client-report');c.reportSeq=m.seq;c.lastReport=clock();c.client={state:m.client.state,build:m.client.build,digest:m.client.digest};counters.reports++;if(m.client.state==='modified')emit(c,'client-reported-modification');return true;},tick(){if(c.player&&c.protocol){const now=clock();if(now-c.issued>60000)api.challenge();if(now-(c.lastReport||c.issued)>45000)emit(c,'client-report-overdue');}},close(){connections.delete(c);},rejection:()=>c.lastReject,state:()=>({id:c.id,protocol:c.protocol,lastSeq:c.lastSeq,score:c.score,client:c.client||null})};return api;
 }
 return {open,status:()=>({name:'VSAC',protocol:VSAC_PROTOCOL,active:true,legacyCompatible:!requireProtocol,...counters,connections:connections.size,recent:events.slice(-20)})};
}
