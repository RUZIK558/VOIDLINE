import * as T from '/vendor/three.module.js';
// Every frame is sampled from an absolute clip pose. A previous blend is NEVER
// reused as the target of the next blend (unkeyed hinges used to get stuck).
export function createKnifeController(root,clips,{blendSeconds=.075}={}){
 const mixer=new T.AnimationMixer(root),actions={},entries=new Map(),animated=new Set();
 for(const clip of clips){const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions[clip.name]=action;
  const tracks=clip.tracks.map(track=>{animated.add(track.name.split('.')[0]);const binding=new T.PropertyBinding(root,track.name);binding.bind();return {binding,sample:track.createInterpolant()};});entries.set(clip.name,{clip,action,tracks});}
 const rest=[];root.traverse(o=>{if(animated.has(o.name))rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});
 const restore=()=>{for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}};
 const rawUpdate=mixer.update.bind(mixer),rawStop=mixer.stopAllAction.bind(mixer);let active=null,elapsed=0,from=null,nextInspect=0,lastVariant=0;
 const stats={state:'idle',lastReset:'initial',recoveries:0,interruptions:0,completed:0};
 function reset(reason='reset'){rawStop();active=null;elapsed=0;from=null;restore();stats.state='idle';stats.lastReset=reason;}
 const finite=()=>rest.every(([o])=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].every(Number.isFinite));
 const drift=()=>rest.some(([o,p,q,s])=>o.position.distanceToSquared(p)>1e-12||o.quaternion.angleTo(q)>1e-6||o.scale.distanceToSquared(s)>1e-12);
 function play(name){
  let key=name;if(name==='inspect'&&entries.has('inspectAlternate')){lastVariant=nextInspect++%2;key=lastVariant?'inspectAlternate':'inspect';}
  const entry=entries.get(key);if(!entry)return false;
  if(!finite()){stats.recoveries++;restore();}
  const snapshot=rest.map(([o])=>[o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);if(active)stats.interruptions++;
  rawStop();restore();active=entry;elapsed=0;from=snapshot;entry.action.reset().play();actions.inspect=entries.get(key.startsWith('inspect')?key:'inspect')?.action||actions.inspect;stats.state=name;return true;}
 mixer.update=dt=>{if(!Number.isFinite(dt)||dt<0){stats.recoveries++;reset('invalid-delta');return mixer;}
  if(!active){if(!finite()||drift()){stats.recoveries++;restore();}return mixer;}
  rawUpdate(dt);elapsed+=dt;
  if(elapsed>=active.clip.duration-1e-7){stats.completed++;reset('completed');return mixer;}
  restore();for(const{binding,sample}of active.tracks)binding.setValue(sample.evaluate(Math.min(elapsed,active.clip.duration)),0);
  if(from){const u=Math.min(1,elapsed/Math.max(.001,blendSeconds)),a=u*u*(3-2*u);for(const[o,p,q,s]of from){o.position.lerpVectors(p,o.position,a);o.quaternion.slerpQuaternions(q,o.quaternion.clone(),a);o.scale.lerpVectors(s,o.scale,a);}if(u>=1)from=null;}
  if(!finite()){stats.recoveries++;reset('nonfinite-pose');}return mixer;};
 mixer.stopAllAction=()=>{reset('stop-all');return mixer;};
 return {mixer,actions,play,reset,get inspectVariant(){return lastVariant;},diagnostics:()=>({...stats,elapsed,duration:active?.clip.duration||0})};
}
