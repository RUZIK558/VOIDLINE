import {randomUUID} from 'node:crypto';
import {direction,wallDistance,feetY,blocked} from './public/shared.mjs';
import {commandById,TACTICAL_TTL} from './public/tactical.mjs';
export function pingPosition(p,map){
 const from=[p.x,p.y,p.z],d=direction(p.yaw,p.pitch),floor=d[1]<-.0001?-p.y/d[1]:Infinity;
 const distance=Math.min(wallDistance(from,d,map.boxes),floor);
 if(!Number.isFinite(distance)||distance<.05||distance>120)return null;
 return {x:from[0]+d[0]*Math.max(0,distance-.035),y:Math.max(.06,from[1]+d[1]*Math.max(0,distance-.035)),z:from[2]+d[2]*Math.max(0,distance-.035)};
}
function midPosition(map){
 for(let r=0;r<=10;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if((Math.abs(x)===r||Math.abs(z)===r)&&!blocked(x,z,.5,map.boxes))return{x,y:.12,z};
 return null;
}
export function createTacticalChannel(getGame){
 let markers=[];const sent=new WeakMap();
 function snapshot(team,now=Date.now()){markers=markers.filter(m=>m.until>now);return markers.filter(m=>m.team===team).map(m=>({...m,pos:{...m.pos}}));}
 function handle(p,m,now=Date.now()){
  const game=getGame();
  if(!p?.alive||p.disconnected||!['live','freeze'].includes(game.phase))return {error:'Метки и команды доступны живым игрокам во время раунда'};
  const command=m.action==='command'?commandById(m.command):null;
  if(m.action!=='ping'&&!command)return {error:'Неизвестная быстрая команда'};
  const prev=sent.get(p)||{any:-Infinity,curse:-Infinity};
  if(now-prev.any<900||(command?.id==='curse'&&now-prev.curse<5000))return {error:'Подожди немного перед следующей командой'};
  let pos=null,text='Метка';
  if(m.action==='ping'){pos=pingPosition(p,game.map);if(!pos)return {error:'Наведи прицел на поверхность в пределах 120 м'};}
  else{
   text=command.text;
   if(command.target==='sender')pos={x:p.x,y:feetY(p)+.15,z:p.z};
   else if(command.target==='mid')pos=midPosition(game.map);
   else if(command.target){const s=game.map.sites.find(s=>s.id===command.target);if(s)pos={x:s.x,y:.12,z:s.z};}
  }
  sent.set(p,{any:now,curse:command?.id==='curse'?now:prev.curse});
  const event={id:randomUUID().slice(0,12),senderId:p.id,name:p.name,team:p.team,kind:command?'command':'ping',command:command?.id||null,text,pos,at:now,until:now+TACTICAL_TTL};
  snapshot(p.team,now);
  if(pos){markers=markers.filter(e=>e.senderId!==p.id||e.team!==p.team).concat(event);const own=markers.filter(e=>e.team===p.team);if(own.length>6){const remove=new Set(own.slice(0,own.length-6).map(e=>e.id));markers=markers.filter(e=>!remove.has(e.id));}}
  return {event,markers:snapshot(p.team,now)};
 }
 return {handle,snapshot,clear(){markers=[];}};
}
