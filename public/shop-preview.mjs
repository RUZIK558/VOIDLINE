import {disposeOwnedTree} from "./resources.mjs";
import * as THREE from '/vendor/three.module.js';
import {buildWeapon,buildGrenade,buildOperator} from './models.mjs';
import {WEAPONS,SHOP} from './shared.mjs';
import {validUtility} from './utilities.mjs';
import {createStudioEnvironment} from './lighting.mjs';
export function weaponSilhouette(id){
 const primary=WEAPONS[id]?.slot==='primary',pistol=!!WEAPONS[id]&&!primary;
 let path=primary?'M8 28h58v-5h35v7H64l-5 8h-9l3-8H32l-4 20h-9V31H8z':pistol?'M22 21h65v16H53l-5 19H30l5-19H22z':validUtility(id)?'M45 14h16v8h6v32H37V22h8zM61 17h9v9':'M27 16l17-5h17l17 5-6 39H32z';
 if(id==='ak47')path='M7 25h61v-5h34v7H64l-4 6 8 17-9 4-9-21H34l-5 19h-9l2-21H7z';
 if(WEAPONS[id]?.scope)path='M6 30h64v-5h34v8H59l-5 16H34l3-16H6zM37 12h33v8H37zM45 20h5v9h-5z';
 const unique={m4a1s:'M5 28h22v-4h38v-6h10v8h28v7H64l-6 18H47l3-18H30l-4 20H14V34H5z',mp9:'M15 24h56v-4h15v12H61l-4 22H44l3-22H33l-3 13H20V32h-5z',p90:'M11 24h61l20 10v12H77v-8H58v10H38V37H11zM23 16h49v6H23z',deagle:'M17 18h76v20H54l-6 20H28l5-20H17z',glock:'M21 22h68v14H51l-5 20H29l5-20H21z',armor:'M29 16l15-6h20l17 6-8 40H35zM44 10v17h20V10',helmet:'M24 37c0-34 60-34 60 0v9H54v12H27V37z',kit:'M21 26h36v23H21zM57 30l12-12 7 7-12 13zM74 43l15 12 5-6-17-12z',ammo:'M28 17l5-9 5 9v38H28zM45 17l5-9 5 9v38H45zM62 17l5-9 5 9v38H62z'};path=unique[id]||path;
 return `<svg viewBox="0 0 110 64" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>`;
}
export function createShopPreview(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,20);
 scene.add(new THREE.HemisphereLight('#e1f3ff','#5f5545',3));
 const sun=new THREE.DirectionalLight('#fff1dc',5);sun.position.set(2,3,2);scene.add(sun);scene.environment=createStudioEnvironment(renderer);
 let model=null,lastId=null,operator=null,lastSide=null;
 return {
  get side(){return lastSide;},
  show(id,side=0){
   side=side===1?1:0;
   if(side!==lastSide){
    if(model){disposeOwnedTree(model);model=null;}
    if(operator)disposeOwnedTree(operator);
    operator=buildOperator(side);operator.rotation.y=Math.PI-.25;scene.add(operator);operator.userData.weapon.visible=false;
    lastSide=side;lastId=null;
    canvas.setAttribute('aria-label','Предпросмотр агента '+(side===1?'Т · Атака':'КТ · Защита'));
   }
   if(id===lastId)return;lastId=id;
   if(model){disposeOwnedTree(model);model=null;}
   if(!WEAPONS[id]&&!validUtility(id))return;
   model=validUtility(id)?buildGrenade(id):buildWeapon(id);model.position.copy(operator.userData.weapon.position);model.rotation.copy(operator.userData.weapon.rotation);operator.userData.body.add(model);
  },
  render(time){
   if(!operator)return;
   const w=Math.max(200,canvas.clientWidth),h=Math.max(160,canvas.clientHeight);if(canvas.width!==w||canvas.height!==h)renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.position.set(.15,1.1,3.6);camera.lookAt(0,1,0);camera.updateProjectionMatrix();operator.rotation.y=Math.PI-.25+Math.sin(time*.3)*.1;renderer.render(scene,camera);
  }
 };
}
