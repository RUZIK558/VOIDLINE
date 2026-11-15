// Dense, eased phase keys preserve directed rotations beyond 180 degrees.
export function easedTrack(path,times,values){
 const ts=[],vs=[];for(let i=0;i<times.length-1;i++){const steps=Math.max(2,Math.ceil((times[i+1]-times[i])*120));for(let n=0;n<steps;n++){const u=n/steps,s=u*u*(3-2*u);ts.push(times[i]+(times[i+1]-times[i])*u);vs.push(values[i]+(values[i+1]-values[i])*s);}}ts.push(times.at(-1));vs.push(values.at(-1));return [path,ts,vs];
}
const tr=easedTrack,pi=Math.PI;
export function knifeMotion(id,variant=0){
 if(!['butterfly','karambit'].includes(id))throw Error('Unsupported articulated knife');
 const carry=(t,x,y,z,rx,rz)=>[tr('KnifeMotion.position[x]',t,x),tr('KnifeMotion.position[y]',t,y),tr('KnifeMotion.position[z]',t,z),tr('R_Hand.rotation[x]',t,rx),tr('R_Hand.rotation[z]',t,rz)];
 const t=[0,.10,.22,.35,.48,.61,.76,.90,1];
 const inspect=carry(t,[0,-.03,-.075,-.045,-.09,-.05,-.075,-.02,0],[0,.035,.065,.04,.09,.055,.075,.025,0],[0,-.015,-.055,-.04,-.075,-.05,-.045,-.01,0],[0,-.12,.18,-.20,.24,-.12,.14,-.06,0],[0,.16,-.12,.30,-.18,.26,-.08,.10,0]);
 // During a release, the index/thumb grip is forward of the palm; the free parts clear the sleeve.
 for(const [axis,v] of [['x',[0,-.003,-.006,-.006,-.008,-.006,-.005,-.002,0]],['y',[0,.002,.004,.004,.005,.004,.003,.001,0]],['z',[0,-.003,-.01,-.01,-.015,-.01,-.008,-.002,0]]])inspect.push(tr(`KnifeGrip.position[${axis}]`,t,v));
 const equip=carry([0,.18,.42,.68,.86,1],[.035,.02,-.025,-.012,.006,0],[-.24,-.08,.035,.02,-.007,0],[.06,.01,-.03,-.015,0,0],[-.35,-.12,.18,-.08,.04,0],[.18,-.12,.18,-.06,.025,0]);
 if(id==='butterfly'){
  // Two coherent close/reopen rolls: blade carrier + free handle, held safe handle stays fixed.
  const phases=[0,.08,.16,.27,.35,.43,.51,.60,.70,.81,.91,1];
  const swing=variant?[0,-.1,-pi,-pi,-2*pi,-2*pi,-2*pi,-3*pi,-3*pi,-4*pi,-4*pi,-4*pi]:[0,0,-pi,-pi,-2*pi,-2*pi,-3*pi,-3*pi,-4*pi,-4*pi,-4*pi,-4*pi];
  const bite=variant?[0,-pi,-pi,-2*pi,-2*pi,-3*pi,-3*pi,-3*pi,-4*pi,-4*pi,-4*pi,-4*pi]:[0,-pi,-pi,-2*pi,-2*pi,-3*pi,-3*pi,-4*pi,-4*pi,-4*pi,-4*pi,-4*pi];
  inspect.push(tr('SwingPivot.rotation[y]',phases,swing),tr('BiteHandle.rotation[y]',phases,bite));
  equip.push(tr('SwingPivot.rotation[y]',[0,.10,.42,.70,.88,1],[pi,pi,.1,-.07,0,0]),tr('BiteHandle.rotation[y]',[0,.10,.42,.70,.88,1],[pi,pi,pi,-.10,0,0]));
 }else{
  // Forward/outward reverse grip. A fast index roll, second pass and crisp catch, never a Z propeller.
  inspect.push(tr('RingPivot.rotation[y]',[0,.08,.28,.36,.58,.76,.88,1],variant?[0,0,-2*pi,-2*pi,-2*pi,-4*pi,-4*pi,-4*pi]:[0,0,-2*pi,-2*pi,-4*pi,-4*pi,-4*pi,-4*pi]));
  equip.push(tr('RingPivot.rotation[y]',[0,.12,.52,.76,.9,1],[2*pi,2*pi,.12,-.06,0,0]));
 }
 for(let f=1;f<=3;f++){
  inspect.push(tr(`R_Finger${f}_1.rotation[x]`,t,[0,.30,.75,.18,.75,.18,.55,.12,0]));
  inspect.push(tr(`R_Finger${f}_0.rotation[z]`,t,[0,(f-2)*.10,(f-2)*.20,0,(f-2)*.20,0,(f-2)*.12,0,0]));
  equip.push(tr(`R_Finger${f}_1.rotation[x]`,[0,.20,.48,.72,1],[.55,.7,.45,.08,0]));
 }
 const fire=carry([0,.17,.36,.56,.78,1],[0,.04,-.27,-.16,.01,0],[0,.045,.035,-.02,-.008,0],[0,.025,-.12,-.075,.01,0],[0,.17,-.24,-.12,.04,0],[0,.30,-.48,-.22,.04,0]);
 const heavy=carry([0,.20,.38,.56,.76,1],[0,.06,.025,-.055,-.02,0],[0,.045,.025,-.045,-.015,0],[0,.09,.035,-.30,-.14,0],[0,.22,.12,-.30,-.10,0],[0,.18,.06,-.24,-.08,0]);
 return [{name:'inspect',duration:id==='butterfly'?(variant?1.85:1.65):(variant?1.65:1.45),tracks:inspect},{name:'equip',duration:id==='butterfly'?.62:.54,tracks:equip},{name:'fire',duration:.45,tracks:fire},{name:'heavy',duration:.85,tracks:heavy}];
}
