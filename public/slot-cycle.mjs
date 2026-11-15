import {weaponSlot} from './shared.mjs';
export function availableSlots(player,knife='butterfly'){
 if(!player?.alive)return [];
 const inv=player.inventory||[],slots=[];
 for(const slot of ['primary','secondary'])for(const id of inv)if(weaponSlot(id)===slot)slots.push({kind:'weapon',id});
 const blade=inv.includes(knife)?knife:inv.find(id=>weaponSlot(id)==='knife');if(blade)slots.push({kind:'weapon',id:blade});
 for(const id of ['he','flash','smoke','fire'])if(player.grenades?.[id]>0)slots.push({kind:'grenade',id});
 return slots;
}
export function cycleSlot(player,knife,direction,current){
 const slots=availableSlots(player,knife);if(!slots.length)return null;
 const active=current||{kind:player.utility?'grenade':'weapon',id:player.utility||player.weapon};
 const at=slots.findIndex(s=>s.kind===active.kind&&s.id===active.id);
 const i=at<0?(direction<0?slots.length-1:0):(at+(direction<0?-1:1)+slots.length)%slots.length;
 return slots[i];
}
