// Original pre-rendered samples, decoded once. Positional one-shots; no remote or
// persistent microphone use. Master compressor protects against piled-up shots.
export const SOUND_IDS=Object.freeze([
 ...['rifle','ak47','m4a1s','awp','ssg08','mp9','p90','pistol','glock','deagle'].map(w=>'shot-'+w),
 ...['stone','metal','sand','snow'].flatMap(s=>[0,1,2].map(v=>'step-'+s+'-'+v)),
 'reload-rifle','reload-pistol','reload-sniper','round','live','win','loss','plant','defuse','chat','buy','beep','hit','scope',
 'explosion','flash','hiss','throw','bounce','knife','hurt','equip','land','jump','dry'
]);
export function spatialMix(source,listener,{range=55,occluded=false}={}){
 if(!source||!listener)return {gain:1,pan:0,lowpass:18000};
 const dx=source.x-listener.x,dz=source.z-listener.z,dy=(source.y??1)-(listener.y??1),d=Math.hypot(dx,dy,dz);
 const gain=Math.pow(Math.max(0,1-d/range),2)*(occluded?.38:1);
 const right=dx*Math.cos(listener.yaw||0)-dz*Math.sin(listener.yaw||0);
 return {gain,pan:Math.max(-1,Math.min(1,right/Math.max(1,Math.hypot(dx,dz)))),lowpass:occluded?950:Math.max(2200,18000-d*180)};
}
export function soundName(kind,weapon='rifle'){
 if(kind==='shot')return 'shot-'+(SOUND_IDS.includes('shot-'+weapon)?weapon:'rifle');
 if(kind==='reload')return 'reload-'+(['awp','ssg08'].includes(weapon)?'sniper':['pistol','glock','deagle'].includes(weapon)?'pistol':'rifle');
 return SOUND_IDS.includes(kind)?kind:null;
}
export function createStepTracker(){
 let round=null;const old=new Map();
 return {reset(){round=null;old.clear();},update(state,surface='stone'){
  const events=[];
  if(round!==state.round){old.clear();round=state.round;}
  const ids=new Set();
  for(const p of state.players){ids.add(p.id);const prev=old.get(p.id),dist=prev?Math.hypot(p.x-prev.x,p.z-prev.z):0;
   let stride=(prev?.stride||0)+(dist<2?dist:0),variant=prev?.variant||0;
   if(prev&&p.alive&&state.phase==='live'){
    const pos={x:p.x,y:p.y,z:p.z},grounded=p.grounded!==false;
    if(!grounded&&prev.grounded===true&&p.y>prev.y+.04)events.push({kind:'jump',id:p.id,pos});
    if(grounded&&prev.grounded===false)events.push({kind:'land',id:p.id,pos});
    if(!grounded||p.crouch||Math.hypot(p.vx||0,p.vz||0)<2.7)stride=0;
    else if(stride>1.75){events.push({kind:`step-${typeof surface==='function'?surface(p):surface}-${variant%3}`,id:p.id,pos});stride%=1.75;variant++;}
    if(p.reload&&!prev.reload)events.push({kind:'reload',weapon:p.weapon,id:p.id,pos});
   }else stride=0;
   old.set(p.id,{x:p.x,y:p.y,z:p.z,grounded:p.grounded!==false,reload:p.reload,stride,variant});
  }
  for(const id of old.keys())if(!ids.has(id))old.delete(id);
  return events;
 }};
}
export function createGameAudio({getVolume=()=>.7,getListener=()=>null,isOccluded=()=>false,onError=()=>{}}={}){
 let context=null,master,compressor,loading=null,disposed=false,volume=-1;const buffers=new Map(),voices=new Set(),last=new Map();
 function init(){
  if(disposed)return;
  try{if(!context){context=new AudioContext();master=context.createGain();compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=18;compressor.ratio.value=6;compressor.attack.value=.003;compressor.release.value=.16;master.connect(compressor);compressor.connect(context.destination);preload();}if(context.state==='suspended')context.resume().catch(onError);}catch(e){onError(e);}
 }
 function preload(){
  if(loading)return loading;
  if(!context)return Promise.resolve();
  let next=0;loading=Promise.all(Array.from({length:4},async()=>{while(next<SOUND_IDS.length){const id=SOUND_IDS[next++];try{const r=await fetch(new URL('./assets/audio/'+id+'.wav',import.meta.url));if(!r.ok)throw Error('Sound '+id+': '+r.status);const b=await context.decodeAudioData(await r.arrayBuffer());if(!disposed)buffers.set(id,b);}catch(e){onError(e);}}}));return loading;
 }
 function play(kind,options={}){
  if(disposed||!context||context.state!=='running')return false;
  const name=soundName(kind,options.weapon),buffer=buffers.get(name);if(!buffer||voices.size>=40)return false;
  const t=context.currentTime,key=options.key||name;
  if(t-(last.get(key)??-10)<(options.cooldown??.025))return false;
  const listener=getListener(),source=options.pos;
  const mix=spatialMix(source,listener,{range:options.range??(name.startsWith('step-')?19:name==='land'?22:65),occluded:!!source&&isOccluded(source,listener)});
  if(mix.gain<.002)return false;
  last.set(key,t);if(last.size>512)for(const [k,v]of last)if(t-v>10)last.delete(k);
  update();
  const node=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter(),pan=context.createStereoPanner();
  node.buffer=buffer;node.playbackRate.value=Math.max(.5,Math.min(2,options.rate||1));
  gain.gain.value=mix.gain*(options.gain??(name.startsWith('step-')?.22:name.startsWith('shot-')?.62:.4));
  filter.type='lowpass';filter.frequency.value=mix.lowpass;pan.pan.value=mix.pan;
  node.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(master);voices.add(node);
  node.onended=()=>{voices.delete(node);for(const n of[node,filter,gain,pan])n.disconnect();node.buffer=null;};
  node.start();return true;
 }
 function update(){if(!context||!master)return;const v=Math.max(0,Math.min(1,Number(getVolume())||0));if(v!==volume){volume=v;master.gain.setTargetAtTime(v,context.currentTime,.015);}}
 function stop(){for(const v of voices){try{v.stop();}catch{}}last.clear();}
 return {init,preload,play,stop,update,stats:()=>({loaded:buffers.size,voices:voices.size,state:context?.state||'uninitialized',volume}),async dispose(){disposed=true;stop();buffers.clear();if(context)await context.close();}};
}
