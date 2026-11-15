import * as THREE from '/vendor/three.module.js';
import {BOXES} from './shared.mjs';
export function addMapDetails(scene,concrete){
 const loader=new THREE.TextureLoader();concrete.map=loader.load('./assets/plaster-albedo.jpg');concrete.map.colorSpace=THREE.SRGBColorSpace;concrete.normalMap=loader.load('./assets/plaster-normal.png');concrete.normalScale=new THREE.Vector2(.4,.4);concrete.roughnessMap=loader.load('./assets/plaster-roughness.png');concrete.color.set('#e0d5bd');
 const stone=new THREE.MeshStandardMaterial({color:'#b7aa8d',roughness:.9}),frame=new THREE.MeshStandardMaterial({color:'#4c625b',roughness:.75}),glass=new THREE.MeshStandardMaterial({color:'#263b40',metalness:.4,roughness:.3}),pipe=new THREE.MeshStandardMaterial({color:'#726b5a',metalness:.35,roughness:.7});
 const box=(x,y,z,w,h,d,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);return o;};
 for(const [x,z,w,d,h,type] of BOXES){if(type!==0||w>10||h>6)continue;
  for(const side of [-1,1]){
   const zz=z+side*(d/2+.025);
   // Recess-like dark glazing and actual window frames on inaccessible wall faces.
   for(const xx of [-1.5,1.5]){box(x+xx,2.25,zz,.95,1.1,.025,glass);box(x+xx,1.65,zz,.99,.08,.09,stone);for(const sx of [-.5,.5])box(x+xx+sx,2.25,zz,.06,1.2,.06,frame);box(x+xx,2.25,zz,.04,1.1,.06,frame);for(const yy of [1.65,2.85])box(x+xx,yy,zz,1.06,.07,.06,frame);}
   box(x,h-.12,zz,w+.04,.12,.12,stone);
  }
  box(x-w/2+.12,h/2,z+d/2+.06,.075,h,.075,pipe);
 }
 // Roofscape stays outside the collision/playable boundary, not fake cover.
 for(let i=0;i<12;i++){const x=-25+i*4.8,z=-28-(i%3)*3,h=6+(i*7%5);box(x,h/2,z,4.6,h,4,concrete);box(x,h+.1,z,4.8,.2,4.2,stone);for(let j=0;j<2;j++)box(x-.9+j*1.8,h-1.5,z+2.02,.65,1,.03,frame);}
 const wireMat=new THREE.LineBasicMaterial({color:'#3b4545'});
 for(const dx of [-.4,.4]){const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new THREE.Vector3(-18+36*t,7-1.1*Math.sin(t*Math.PI),-11+dx));}scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),wireMat));}
}
