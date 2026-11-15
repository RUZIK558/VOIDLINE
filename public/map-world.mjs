import * as THREE from '/vendor/three.module.js';
import {batchStatic} from './batch.mjs';
import {disposeOwnedTree} from './resources.mjs';
// Built on demand: only one playable map resides on the GPU.
export function createMapWorld(map){
 const root=new THREE.Group(),t=map.theme,hw=map.w/2,hd=map.d/2;
 const mat=(c,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness:metalness?.6:.92,metalness});
 const wall=mat(t.wall),metal=mat(t.metal,.45),crate=mat(t.crate),floor=mat(t.floor),dark=mat('#354449'),accent=mat(t.accent),glass=mat('#314d59',.35);
 const loader=new THREE.TextureLoader();wall.map=loader.load('./assets/plaster-albedo.jpg');wall.map.colorSpace=THREE.SRGBColorSpace;
 wall.normalMap=loader.load('./assets/plaster-normal.png');wall.normalScale=new THREE.Vector2(.3,.3);wall.roughnessMap=loader.load('./assets/plaster-roughness.png');for(const tex of [wall.map,wall.normalMap,wall.roughnessMap])tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 function box(x,y,z,w,h,d,m=wall,shadow=true){
  const g=new THREE.BoxGeometry(w,h,d);
  if(m===wall){const uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<uv.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))*.5,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))*.5);}
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;root.add(o);return o;
 }
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=t.floor;ctx.fillRect(0,0,128,128);ctx.strokeStyle='#00000025';ctx.lineWidth=2;ctx.strokeRect(0,0,128,128);ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,128);ctx.stroke();
 floor.map=new THREE.CanvasTexture(c);floor.map.colorSpace=THREE.SRGBColorSpace;floor.map.wrapS=floor.map.wrapT=THREE.RepeatWrapping;floor.map.repeat.set(map.w/2.5,map.d/2.5);
 box(0,-.16,0,map.w+2,.3,map.d+2,floor,false);
 // Ground treatment makes the level's circulation legible at player height.
 const road=mat(['port','rail','factory'].includes(t.style)?'#59666a':t.style==='snow'?'#adc5d2':'#8f927e');
 if(t.style==='rail')for(const x of [-22,-7,9]){box(x,.006,0,8,.012,map.d-3,road,false);for(const side of [-1,1])box(x+side*1.7,.02,0,.09,.02,map.d-3,metal,false);for(let z=-hd+3;z<hd-3;z+=1.8)box(x,.015,z,4.4,.02,.2,dark,false);}
 else if(t.style==='port'){box(0,.007,-hd+7,map.w-3,.014,9,road,false);for(let x=-hw+4;x<hw-4;x+=5)box(x,.018,-hd+7,2,.02,.15,accent,false);}
 else if(t.style==='factory'){for(const x of [-19,19]){box(x,.007,0,8,.014,map.d-3,road,false);for(let z=-hd+4;z<hd-4;z+=4)box(x,.018,z,.15,.02,1.8,accent,false);}}
 else if(t.style==='palms'){box(0,.007,0,28,.014,30,road,false);const pool=mat('#509e9c',.25);box(-3,1.115,0,7.6,.025,5.6,pool,false);}
 else if(t.style==='fort'){for(const z of [-35,35])box(0,.007,z,map.w-4,.014,8,road,false);}
 else{box(0,.007,0,9,.014,map.d-3,road,false);for(let z=-hd+4;z<hd-4;z+=5)box(0,.018,z,.15,.02,2,accent,false);}
 for(const [x,z,w,d,h,type,base=0] of map.boxes){
  const m=[wall,metal,crate,metal][type]||wall;box(x,base+h/2,z,w,h,d,m);
  if(base>0||type===3)continue;
  if(type===1){for(let a=-w/2+.15;a<w/2;a+=.45)box(x+a,h/2,z+d/2+.02,.04,h-.1,.04,dark);box(x,h+.04,z,w+.02,.08,d+.02,accent);}
  if(type===2){for(const side of [-.36,.36])box(x+w*side,h/2,z,.06,h+.02,d+.03,dark);box(x,h*.35,z,w+.03,.06,d+.04,dark);}
  if(type===0&&w>=3&&d>=3&&w<map.w*.75&&d<map.d*.75){
   box(x,h+.08,z,w+.18,.16,d+.18,accent);
   if(h>=3.8){
    for(const side of [-1,1]){
     for(let dx=-w/2+1.5;dx<w/2-1;dx+=3){const zz=z+side*(d/2+.025);for(let yy=2.3;yy<h-1;yy+=2.7){box(x+dx,yy,zz,1.05,1.25,.035,glass);box(x+dx,yy-.68,zz,1.25,.08,.16,metal);}}
     for(let dz=-d/2+1.5;dz<d/2-1;dz+=3){const xx=x+side*(w/2+.025);for(let yy=2.3;yy<h-1;yy+=2.7)box(xx,yy,z+dz,.035,1.25,1.05,glass);}
     box(x,1.1,z+side*(d/2+.04),1.25,2.2,.055,metal);box(x,.1,z+side*(d/2+.09),1.5,.18,.12,dark);
    }
    box(x-w*.22,h+.45,z+d*.2,Math.min(2,w*.2),.65,Math.min(2,d*.2),metal);
    for(let i=0;i<3;i++)box(x-w*.22+i*.25-.25,h+.79,z+d*.2,.06,.04,1,dark);
   }
  }
 }
 function sign(text,x,y,z,rot=0,w=5,h=1.4){const c=document.createElement('canvas');c.width=512;c.height=160;const x2=c.getContext('2d');x2.fillStyle='#14252d';x2.fillRect(0,0,512,160);x2.fillStyle=t.accent;x2.fillRect(14,16,5,128);x2.font='bold 48px Arial';x2.fillText(text,35,75);x2.font='18px monospace';x2.fillText('VOIDLINE  /  '+map.name,35,121);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));o.position.set(x,y,z);o.rotation.y=rot;root.add(o);}
 sign(map.name,0,6,(-hd+.55),0,10,2.6);sign('OPERATION',0,6,(hd-.55),Math.PI,10,2.6);
 for(const s of map.sites){const ring=new THREE.Mesh(new THREE.RingGeometry(s.radius-.07,s.radius,40),new THREE.MeshBasicMaterial({color:t.accent,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(s.x,.025,s.z);root.add(ring);const label=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),new THREE.MeshBasicMaterial({color:t.accent,transparent:true,opacity:.12,depthWrite:false}));label.rotation.x=-Math.PI/2;label.position.set(s.x,.024,s.z);root.add(label);sign('SITE '+s.id,s.x,3.2,s.z,0,2.5,1);}
 // Upper floors are navigable architecture, not decorative window rectangles.
 for(const g of map.structures||[]){
  sign(g.label,g.x,g.height+2,g.z-g.d/2-.04,0,Math.min(g.w-1,6),.75);
  // Windows occupy side walls only; both stair mouths and balcony door stay clear.
  for(const side of [-1,1])for(let dz=-g.d/2+1.2;dz<g.d/2-1;dz+=2.2)
   box(g.x+side*(g.w/2+.02),g.height+1.65,g.z+dz,.04,.85,1.1,glass);
  for(const stair of g.stairs){
   for(const side of [-1,1]){
    // Handrails are visual only and sit outside the 2.8m stair width.
    const length=stair.n*stair.run,angle=Math.atan2(stair.height,length);
    const rail=box(g.x+side*1.65,stair.height/2+.9,(stair.z+stair.edge)/2,.06,.06,Math.hypot(length,stair.height),metal);
    rail.rotation.x=stair.side*angle;
    for(let i=0;i<=stair.n;i+=3)box(g.x+side*1.65,i*.25+.45,stair.z-stair.side*i*.8,.07,.9,.07,metal);
   }
  }
 }
 // Skyline and theme-specific structures are outside the collision boundary.
 for(let i=0;i<12;i++){const x=-hw-5+i*(map.w+10)/11,z=-hd-6-(i%3)*3,h=6+(i*7%6);box(x,h/2,z,4.5,h,4,wall,false);box(x,h+.1,z,4.7,.2,4.2,accent,false);}
 if(['port','rail','factory'].includes(t.style)){
  for(const z of [-hd+2,hd-2]){for(const x of [-hw+2,hw-2])box(x,6,z,.35,12,.35,metal);box(0,11.8,z,map.w-4,.4,.55,metal);for(let x=-hw+4;x<=hw-4;x+=3){const o=box(x,10.9,z,.13,2,.13,accent);o.rotation.z=.6;}}
  if(t.style==='port')for(const x of [-hw-7,hw+7]){box(x,10,0,.6,20,.6,accent,false);box(x-4,19,0,12,.5,.5,accent,false);}
  if(t.style==='rail')for(const x of [-2,2])box(x,.01,0,.07,.02,map.d-2,metal,false);
  if(t.style==='factory')for(const x of [-hw-7,hw+7]){box(x,10,5,3,20,3,dark,false);box(x,19,5,3.1,.4,3.1,accent,false);}
 }else if(t.style==='palms'){
  const leaf=mat('#557c50');for(const x of [-hw-4,hw+4])for(const z of [-hd+9,0,hd-9]){box(x,3,z,.35,6,.35,crate,false);for(let i=0;i<6;i++){const o=box(x,5.9,z,.9,.14,4,leaf,false);o.rotation.set(.2,i*Math.PI/3,.1);}}
 }else if(t.style==='fort'){
  for(const x of [-hw+.2,hw-.2])for(let z=-hd+2;z<hd-1;z+=3)box(x,9.4,z,1.4,.8,1.4,wall,false);
 }else if(t.style==='snow'){
  for(const x of [-hw-5,hw+5])for(const z of [-14,8]){box(x,8,z,.18,16,.18,dark,false);box(x,12,z,2.3,.1,.1,accent,false);}
 }else{
  for(const dx of [-.4,.4]){const pts=[];for(let i=0;i<=20;i++){const a=i/20;pts.push(new THREE.Vector3(-hw+2+(map.w-4)*a,7-Math.sin(a*Math.PI),dx));}root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#344345'})));}
 }
 for(const [cx,z] of Object.values(map.spawns)){box(cx,.015,z,18,.025,.06,accent,false);for(const x of [cx-9,cx+9])box(x,.015,z,.06,.025,8,accent,false);}

 batchStatic(root);
 return {root,dispose(){disposeOwnedTree(root,{materials:true,textures:true});}};
}
