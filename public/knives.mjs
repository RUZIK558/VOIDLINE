import * as T from '/vendor/three.module.js';
import {clip} from './rigging.mjs';
import {createKnifeController} from './knife-controller.mjs';
import {knifeMotion} from './knife-motion.mjs';
import {KNIFE_GRIPS,KNIFE_BLEND_SECONDS} from './knife-grip.mjs';
import {karambitBlade,karambitGrip} from './knife-geometry.mjs';
// Original procedural knife meshes. Metallic bevels, physical hinge pivots, no external models.
export function buildKnife(id){
 const g=new T.Group();
 const steel=new T.MeshStandardMaterial({color:'#b7cdd5',metalness:.68,roughness:.25});
 const grip=new T.MeshStandardMaterial({color:id==='m9'?'#344a3c':'#253443',metalness:.5,roughness:.36});
 const edge=new T.MeshStandardMaterial({color:'#e2eef4',metalness:.96,roughness:.15});
 const accent=new T.MeshStandardMaterial({color:id==='butterfly'?'#55d5e0':id==='karambit'?'#657780':'#9caa8c',metalness:.8,roughness:.28});
 const add=(parent,geometry,mat,x=0,y=0,z=0,role)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);if(role)m.userData.paintRole=role;parent.add(m);return m;};
 const box=(p,x,y,z,w,h,d,mat=grip,role)=>add(p,new T.BoxGeometry(w,h,d),mat,x,y,z,role);
 function blade(parent,points){
  const shape=new T.Shape();shape.moveTo(...points[0]);for(const v of points.slice(1))shape.lineTo(...v);shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.004,bevelThickness:.003});geo.rotateX(-Math.PI/2);geo.translate(0,-.005,0);
  const m=add(parent,geo,steel,0,0,0,'body');
  // Tapered sharpened edge strip as an actual bevel highlight.
  const line=points.slice(1).map(([x,z])=>new T.Vector3(x,.005,-z));
  parent.add(new T.Line(new T.BufferGeometry().setFromPoints(line),new T.LineBasicMaterial({color:'#d5efff'})));return m;
 }
 function pin(p,x,z){const m=add(p,new T.CylinderGeometry(.013,.013,.026,14),accent,x,0,z,'trim');return m;}
 if(id==='butterfly'){
  const swing=new T.Group();swing.name='SwingPivot';swing.position.set(-.025,0,-.11);g.add(swing);
  const pivot=new T.Group();pivot.name='BladePivot';pivot.position.x=.025;swing.add(pivot);
  blade(pivot,[[-.021,0],[-.023,.12],[0,.233],[.026,.12],[.022,0]]).name='KnifeBlade';
  const tip=new T.Object3D();tip.name='BladeTip';tip.position.set(0,0,-.233);pivot.add(tip);
  for(const [name,x] of [['SafeHandle',-.025],['BiteHandle',.025]]){
   const h=new T.Group();h.name=name;if(name==='SafeHandle'){h.position.set(x,0,-.11);g.add(h);}else{h.position.x=.05;swing.add(h);}
   for(const side of [-1,1]){box(h,0,side*.018,.115,.035,.012,.25,grip,'trim');for(let j=0;j<5;j++)box(h,0,side*.025,.04+j*.039,.016,.004,.016,accent);}
   box(h,0,0,.235,.035,.04,.014,grip,'trim');pin(h,0,0);pin(h,0,.225);
  }
  box(g.getObjectByName('BiteHandle'),0,0,.255,.012,.035,.04,accent);
 }else if(id==='karambit'){
  add(g,karambitBlade(),steel,0,0,0,'body').name='KnifeBlade';
  add(g,karambitGrip(),grip,0,0,0,'trim');
  const ring=add(g,new T.TorusGeometry(.022,.006,12,36),edge,.006,0,.09);ring.name='IndexRing';ring.rotation.x=Math.PI/2;
  pin(g,-.008,-.025);pin(g,-.008,.043);
  const body=new T.Group();body.name='KnifeBody';for(const child of [...g.children])body.add(child);body.position.set(-.006,0,-.09);
  const tip=new T.Object3D();tip.name='BladeTip';tip.position.set(-.094,0,-.303);body.add(tip);
  const spin=new T.Group();spin.name='RingPivot';spin.add(body);g.add(spin);
 }else{
  blade(g,[[-.035,.1],[-.039,.34],[-.018,.49],[.037,.37],[.038,.1]]);
  box(g,0,0,-.1,.16,.025,.027,steel);box(g,0,0,.02,.059,.045,.22,grip,'trim');
  for(let i=0;i<7;i++)box(g,0,.026,-.06+i*.025,.064,.009,.009,accent);
  box(g,0,0,.14,.072,.055,.025,steel);for(let i=0;i<8;i++)box(g,-.038,0,-.13-i*.019,.012,.013,.009,grip);
  const ring=add(g,new T.TorusGeometry(.026,.006,8,24),steel,.065,0,-.1);ring.rotation.x=Math.PI/2;
  // Fuller / shallow blood groove on the flat.
  box(g,.008,.009,-.25,.011,.002,.19,grip);
 }
 g.userData.factory={body:steel,trim:grip};g.userData.privateMaterials=[steel,grip,edge,accent];g.userData.kind=id;g.userData.skin='standard';g.userData.muzzle=new T.Vector3();
 return g;
}
function buildArticulatedView(id,hands){
 const root=new T.Group(),motion=new T.Group(),weapon=buildKnife(id);motion.name='KnifeMotion';hands.name='KnifeHands';weapon.name='Knife';root.add(motion);motion.add(hands);
 const hand=hands.getObjectByName('R_Hand');
 if(!hand)throw new Error('Knife requires a right-hand grip bone');
 // Calibrate the actual palm contact, not the model origin at the wrist.
 const grip=new T.Group();grip.name='KnifeGrip';hand.add(grip);grip.add(weapon);
 const spec=KNIFE_GRIPS[id];weapon.rotation.set(...spec.rotation);weapon.scale.set(spec.scale*(spec.side??1),spec.scale,spec.scale);
 const contact=new T.Vector3(...spec.anchor).multiply(weapon.scale).applyQuaternion(weapon.quaternion);
 weapon.position.copy(new T.Vector3(...spec.palm).sub(contact));
 if(id==='butterfly'){for(let f=0;f<4;f++){const finger=hands.getObjectByName(`R_Finger${f}_0`);finger.rotation.x=.25;finger.position.z-=.020;}const thumb=hands.getObjectByName('R_Finger4_0');thumb.rotation.set(.9,0,.65);}
 const clips=knifeMotion(id).map(c=>clip(c.name,c.duration,c.tracks));
 const secondary=knifeMotion(id,1).find(c=>c.name==='inspect');clips.push(clip('inspectAlternate',secondary.duration,secondary.tracks));
 root.userData.hands=hands;root.userData.weapon=weapon;root.userData.muzzle=new T.Vector3();root.userData.grip=grip;
 root.userData.animations=createKnifeController(root,clips,{blendSeconds:KNIFE_BLEND_SECONDS});
 return root;
}
export function buildKnifeView(id,hands){
 if(id==='butterfly'||id==='karambit')return buildArticulatedView(id,hands);
 const root=new T.Group(),weapon=buildKnife(id);weapon.name='Knife';hands.name='KnifeHands';weapon.position.set(.22,-.20,-.49);weapon.rotation.set(.28,-.12,-.35);root.add(weapon,hands);
 const extra=[
 ['Knife.rotation[y]',[0,.23,.5,.75,1],[0,1.15,1.15,-.7,0]],
 ['Knife.rotation[z]',[0,.23,.5,.75,1],[-.22,-.6,-.6,.35,-.22]]
 ];
 const inspect=clip('inspect',2.4,[
 ['Knife.position[y]',[0,.18,.75,1],[-.20,-.06,-.06,-.20]],
 ['Knife.position[x]',[0,.18,.75,1],[.22,.12,.12,.22]],
 ['KnifeHands.position[y]',[0,.18,.75,1],[0,.14,.14,0]],['KnifeHands.position[x]',[0,.18,.75,1],[0,-.1,-.1,0]],...extra]);
 const equip=clip('equip',.6,[
 ['Knife.position[y]',[0,.5,1],[-.65,-.12,-.20]],
 ['Knife.rotation[x]',[0,.6,1],[-1.5,.45,.28]],
 ['KnifeHands.position[y]',[0,.5,1],[-.45,.08,0]]]);
 const fire=clip('fire',.45,[
 ['Knife.position[x]',[0,.3,.6,1],[.22,-.17,.05,.22]],
 ['Knife.position[z]',[0,.3,.6,1],[-.49,-.75,-.64,-.49]],
 ['Knife.rotation[z]',[0,.3,.6,1],[-.22,-1.15,-.6,-.22]],
 ['KnifeHands.position[x]',[0,.3,.6,1],[0,-.39,-.17,0]],['KnifeHands.position[z]',[0,.3,.6,1],[0,-.26,-.15,0]]]);
 const heavy=clip('heavy',.85,[
 ['Knife.position[z]',[0,.2,.5,.75,1],[-.49,-.33,-.9,-.7,-.49]],
 ['Knife.rotation[x]',[0,.2,.5,.75,1],[.28,.5,.1,.2,.28]],
 ['KnifeHands.position[z]',[0,.2,.5,.75,1],[0,.16,-.41,-.21,0]]]);
 root.userData.hands=hands;root.userData.weapon=weapon;root.userData.muzzle=new T.Vector3();
 root.userData.animations=createKnifeController(root,[inspect,equip,fire,heavy]);
 return root;
}
