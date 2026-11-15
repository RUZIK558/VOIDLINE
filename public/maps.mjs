// Shared authoritative collision layouts, world dimensions and spawn/buy origins.
const themes = {
 terminal:{wall:'#d5c6a6',metal:'#647873',crate:'#b48c52',floor:'#acaa92',sky:'#a7d5e5',fog:'#d9c39b',sun:'#ffe0bc',accent:'#a3f0de',style:'city'},
 courtyard:{wall:'#e5c6a2',metal:'#496d69',crate:'#9c7552',floor:'#d2bc9b',sky:'#b2dcf2',fog:'#e3c9a9',sun:'#ffe8ca',accent:'#e59d62',style:'arches'},
 dockyard:{wall:'#a5b8c2',metal:'#3c788d',crate:'#d49152',floor:'#788f95',sky:'#a7cadc',fog:'#b3ced6',sun:'#e4f3ff',accent:'#f6c968',style:'port'},
 foundry:{wall:'#8a8d89',metal:'#b06345',crate:'#756b51',floor:'#707978',sky:'#9aafb8',fog:'#b2b6b2',sun:'#ffccb0',accent:'#ffb66b',style:'factory'},
 oasis:{wall:'#dfbf7c',metal:'#56817c',crate:'#b8874c',floor:'#d5bd89',sky:'#87cde6',fog:'#e7c797',sun:'#fff0d5',accent:'#5ce4cc',style:'palms'},
 depot:{wall:'#c0b4a4',metal:'#677c50',crate:'#ad7751',floor:'#9c9d8b',sky:'#b4d3df',fog:'#c5cdbd',sun:'#ffeac6',accent:'#d7e99f',style:'rail'},
 frost:{wall:'#d4e0e8',metal:'#4d7189',crate:'#879b9c',floor:'#c8dbe4',sky:'#9cb9d8',fog:'#d9e7f0',sun:'#e5f4ff',accent:'#b9e5ff',style:'snow'},
 bastion:{wall:'#b4a28c',metal:'#555f57',crate:'#8b6b4b',floor:'#a79c86',sky:'#bfd1df',fog:'#c6bcac',sun:'#ffdfc1',accent:'#dfc488',style:'fort'}
};

// Boxes: [x,z,width,depth,height,material,baseY]. Elevated solids use the same
// authoritative collision representation on server, client, bullets and grenades.
const boundary=(w,d)=>[[-w/2,0,1,d+1,12,0],[w/2,0,1,d+1,12,0],[0,-d/2,w,1,12,0],[0,d/2,w,1,12,0]];
const B=(x,z,w,d,h=5,type=0,y=0)=>[x,z,w,d,h,type,y];
function gallery(boxes,x,z,w,d,h,label){
 const stairs=[];const slab=.22,step=.25,n=Math.round(h/step),run=.8;
 // An open ground storey, a real upper floor and a projecting balcony.
 boxes.push(B(x,z,w,d,slab,1,h-slab),B(x,z-d/2-1.5,w+2,3,slab,1,h-slab));
 for(const sx of [-1,1])for(const sz of [-1,1])boxes.push(B(x+sx*(w/2-.25),z+sz*(d/2-.25),.5,.5,h,0));
 // Rear upper-storey wall is split into two openings: stairs never end in a wall.
 for(const sx of [-1,1]){
  boxes.push(B(x+sx*(w/2-.15),z,.3,d,2.7,0,h));
  boxes.push(B(x+sx*(w/2-1.35),z+d/2,2.1,.3,2.7,0,h));
  boxes.push(B(x+sx*(w/2+.85),z-d/2-1.5,.3,3,.95,1,h));
  boxes.push(B(x+sx*(w/2-1.3),z-d/2-3,2.4,.25,.95,1,h));
 }
 // Solid ceiling over the room; balcony is open to the sky. Back/front stairs
 // provide two independent accesses and a ground-floor through passage.
 boxes.push(B(x,z,w,d,.2,0,h+2.7));
 for(const side of [-1,1]){
  const edge=side===1?z+d/2:z-d/2-3;
  const start=edge+side*n*run;
  for(let i=0;i<n;i++)boxes.push(B(x,start-side*(i+.5)*run,2.8,run+.015,(i+1)*step,3));
  stairs.push({x,z:start,edge,side,run,n,height:h,width:2.8});
 }
 return {label,x,z,w,d,height:h,stairs,balcony:{x,z:z-d/2-1.5,w:w+2,d:3}};
}
function define(id,name,subtitle,w,d,layout,buildings,surface){
 const boxes=[...boundary(w,d),...layout];
 const structures=buildings.map(([x,z,bw,bd,h,label])=>gallery(boxes,x,z,bw,bd,h,label));
 const sites=[{id:'A',x:-w*.29,z:-d*.24,radius:3.8},{id:'B',x:w*.29,z:-d*.21,radius:3.8}];
 // Site cover: a low forward planter/crate and an offset flank stack. Neither
 // seals the plant disk; attackers can split either side and defenders can rotate.
 for(const [i,s]of sites.entries()){
  boxes.push(B(s.x,s.z+5.3,4.5,2,1.25,2));
  boxes.push(B(s.x+(i?-5.3:5.3),s.z-.4,2,4.5,1.6,['port','rail','factory'].includes(themes[id].style)?1:2));
 }
 const attackZ={terminal:29,courtyard:32,dockyard:31,foundry:29,oasis:34,depot:28,frost:30,bastion:31}[id];
 const map={id,name,subtitle,w,d,boxes,sites,spawns:{T:[0,attackZ],CT:[0,-d/2+7]},theme:themes[id],structures,surface};
 const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
 return freeze(map);
}
export const MAPS=Object.freeze({
 terminal:define('terminal','TERMINAL','Терминал · кассовый зал, балконы диспетчерской и рынок',76,100,[
 B(0,-28,12,9,6),B(-23,-36,9,5,3),B(24,-34,8,5,3),B(-31,0,8,18,6),B(31,5,8,18,6),B(-28,34,8,10,5),B(28,34,8,10,5),
 B(0,5,10,18,6),B(-7,32,7,4,2,2),B(10,28,6,6,2,2),B(-27,-15,3,3,1.1,2),B(27,-12,3,3,1.1,2)
 ],[[-17,10,9,8,3,'Диспетчерская'],[19,13,8,7,3.5,'Рынок']], 'stone'),
 courtyard:define('courtyard','COURTYARD','Старый квартал · два двора, жилые этажи и аркады',92,84,[
 B(0,-24,17,9,7),B(-36,-28,8,10,6),B(36,-28,8,10,6),B(-40,0,6,12,5),B(40,0,6,12,5),B(-35,29,10,8,5),B(35,29,10,8,5),B(0,8,7,23,6),
 B(-29,-8,4,3,1,2),B(29,-6,3,4,1,2),B(-8,28,8,4,3),B(10,28,7,4,3)
 ],[[-23,8,12,7,3,'Дом с аркадой'],[24,10,9,8,3,'Гостевой дом']], 'stone'),
 dockyard:define('dockyard','DOCKYARD','Порт · контейнерные петли, склад и капитанский мостик',110,76,[
 B(0,-22,20,6,5,1),B(-42,-25,8,5,3.4,1),B(42,-25,8,5,3.4,1),B(-10,-3,5,18,3.4,1),
 B(7,8,5,20,3.4,1),B(-43,10,8,20,3.4,1),B(43,10,8,20,3.4,1),B(-40,26,8,8,5),B(40,26,8,8,5),B(-21,25,7,4,2,2),B(24,25,6,4,2,2)
 ],[[-28,5,12,7,3,'Склад 04'],[28,6,8,6,3.5,'Капитанский мостик']], 'metal'),
 foundry:define('foundry','FOUNDRY','Литейная · печной зал, ремонтный этаж и галерея',84,104,[
 B(0,-29,15,10,10),B(-31,-39,6,5,5,1),B(31,-37,6,6,5,1),B(-7,5,5,20,7),B(7,5,5,20,7),
 B(-32,14,8,22,6),B(32,18,8,22,6),B(-29,40,10,10,5),B(29,40,10,10,5),B(0,34,12,5,2,2),B(-30,-15,3,4,1.2,2),B(30,-13,3,4,1.2,2)
 ],[[-20,12,9,10,3.5,'Ремонтный этаж'],[21,14,8,8,4,'Галерея печи']], 'metal'),
 oasis:define('oasis','OASIS','Оазис · базар, караван-сарай и открытая площадь',108,92,[
 B(0,-28,13,8,6),B(-41,-31,6,6,5),B(41,-29,6,6,5),B(-3,0,8,6,1.1,2),
 B(-10,23,6,6,4),B(10,23,6,6,4),B(-43,5,8,18,5),B(43,7,8,18,5),B(-40,32,10,8,5),B(40,32,10,8,5),B(-34,-13,3,3,1,2),B(34,-10,3,3,1,2)
 ],[[-27,9,11,8,3,'Караван-сарай'],[27,11,12,7,3,'Базарные комнаты']], 'sand'),
 depot:define('depot','DEPOT','Депо · вагоны, сигнальная башня и ремонтный ангар',70,128,[
 B(0,-38,10,12,5,1),B(-25,-46,5,9,4,1),B(25,-43,5,9,4,1),B(-6,-7,5,17,4,1),
 B(6,9,5,20,4,1),B(-26,21,5,20,5,1),B(26,30,5,20,5,1),B(-23,50,12,10,6),B(23,50,12,10,6),B(-7,46,5,6,2,2),B(7,46,5,6,2,2)
 ],[[-17,15,7,10,3.5,'Сигнальная башня'],[17,22,8,11,3,'Ремонтный ангар']], 'metal'),
 frost:define('frost','FROST','Полярная станция · ветровые экраны, лаборатория и обсерватория',100,100,[
 B(0,-29,18,8,6),B(-37,-35,7,5,4),B(37,-32,7,5,4),B(-9,-3,5,13,4,1),B(9,13,5,16,4,1),
 B(-39,14,10,20,6),B(39,12,10,20,6),B(-34,37,12,10,5),B(34,37,12,10,5),B(-9,34,8,5,2,2),B(10,34,6,5,2,2)
 ],[[-25,10,12,9,3,'Лаборатория'],[25,14,9,9,4,'Обсерватория']], 'snow'),
 bastion:define('bastion','BASTION','Бастион · бастионные дворы, казарма и надвратная галерея',96,112,[
 B(0,-31,18,5,9),B(-37,-40,5,9,9),B(37,-38,5,9,9),B(-8,-4,4,19,7),B(8,5,4,19,7),
 B(-36,20,6,24,8),B(36,22,6,24,8),B(-32,43,12,12,8),B(32,43,12,12,8),B(0,37,14,5,5),B(-31,-17,3,3,1.2,2),B(31,-14,3,3,1.2,2)
 ],[[-24,14,11,10,4,'Казарма'],[24,18,10,8,3.5,'Надвратная галерея']], 'stone')
});
export const validMap=id=>typeof id==='string'&&Object.hasOwn(MAPS,id);
export const getMap=id=>validMap(id)?MAPS[id]:MAPS.terminal;
