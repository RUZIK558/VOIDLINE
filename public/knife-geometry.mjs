import * as T from '/vendor/three.module.js';
// Original silhouettes authored from visual references, not extracted third-party meshes.
export function extrudeProfile(shape,{thickness=.010,bevel=.002,handle=false}={}){
 const g=new T.ExtrudeGeometry(shape,{depth:thickness,steps:1,curveSegments:24,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel*.65,bevelSegments:3});
 g.rotateX(handle?Math.PI/2:-Math.PI/2);g.translate(0,handle?thickness/2:-thickness/2,0);return g;
}
export function butterflyBlade(){
 const s=new T.Shape();s.moveTo(-.015,0);s.lineTo(-.017,.11);s.bezierCurveTo(-.020,.167,-.009,.218,.002,.237);s.bezierCurveTo(.016,.218,.029,.173,.026,.12);s.lineTo(.018,.025);s.lineTo(.018,0);s.closePath();return extrudeProfile(s,{thickness:.007,bevel:.0025});
}
export function butterflyPlate(){
 const s=new T.Shape();s.moveTo(-.017,-.014);s.lineTo(.017,-.014);s.quadraticCurveTo(.020,.002,.017,.035);s.lineTo(.013,.232);s.quadraticCurveTo(.012,.248,0,.25);s.quadraticCurveTo(-.012,.248,-.013,.232);s.lineTo(-.017,.035);s.closePath();
 for(let i=0;i<5;i++){const z=.025+i*.041,w=.0065-i*.0003,l=.025;const h=new T.Path();h.moveTo(-w,z);h.lineTo(-w,z+l-.004);h.quadraticCurveTo(0,z+l+.002,w,z+l-.004);h.lineTo(w,z+.004);h.quadraticCurveTo(0,z-.002,-w,z);s.holes.push(h);}
 return extrudeProfile(s,{thickness:.005,bevel:.0008,handle:true});
}
export function karambitBlade(){
 const s=new T.Shape();s.moveTo(-.023,.052);s.bezierCurveTo(-.071,.082,-.132,.155,-.132,.213);s.bezierCurveTo(-.134,.246,-.117,.280,-.094,.303);s.bezierCurveTo(-.103,.267,-.093,.230,-.066,.201);s.bezierCurveTo(-.037,.172,.008,.143,.025,.071);s.lineTo(.013,.052);s.closePath();return extrudeProfile(s,{thickness:.008,bevel:.0025});
}
export function karambitGrip(){
 const s=new T.Shape();s.moveTo(-.017,-.088);s.bezierCurveTo(-.036,-.059,-.040,-.025,-.042,.001);s.quadraticCurveTo(-.060,.030,-.040,.052);s.lineTo(-.023,.060);s.lineTo(.023,.058);s.quadraticCurveTo(.044,.043,.023,.031);s.quadraticCurveTo(.042,.018,.024,.009);s.quadraticCurveTo(.043,-.007,.026,-.016);s.quadraticCurveTo(.044,-.031,.030,-.041);s.quadraticCurveTo(.043,-.058,.025,-.075);s.lineTo(.023,-.088);s.closePath();return extrudeProfile(s,{thickness:.026,bevel:.003});
}
