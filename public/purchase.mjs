import {SHOP,WEAPONS} from './shared.mjs';
import {UTILITY,validUtility,utilityCount} from './utilities.mjs';
export function purchaseError(p,item,{phase,roundEvent:e={},map,attackTeam}){
 const offer=typeof item==='string'&&Object.hasOwn(SHOP,item)?SHOP[item]:null;
 if(!offer)return 'Неизвестный предмет';
 if(phase!=='freeze'||!p.alive)return 'Закупка только во время подготовки';
 const origin=map.spawns[p.team===attackTeam?'T':'CT'];
 if(Math.abs(p.z-origin[1])>4||Math.abs(p.x-origin[0])>9)return 'Нужна зона закупки';
 if(e.guns&&Object.hasOwn(WEAPONS,item))return 'В этом ивенте оружие уже выдано';
 if(e.noArmor&&['armor','helmet'].includes(item))return 'В этом ивенте нет брони';
 if(e.noUtility&&validUtility(item))return 'В этом ивенте нет гранат';
 if(offer.side&&offer.side!==(p.team===attackTeam?'T':'CT'))return 'Только для '+(offer.side==='T'?'Т · атаки':'КТ · защиты');
 if(item==='kit'&&(p.team===attackTeam||p.kit))return 'Набор доступен только защите, один на игрока';
 if(item==='armor'&&p.armor===100)return 'Броня уже полная';
 if(item==='helmet'&&(!p.armor||p.helmet))return 'Нужен бронежилет без шлема';
 const inventory=p.inventory||Object.keys(p.guns||{});
 if(WEAPONS[item]&&inventory.includes(item))return 'Оружие уже есть';
 if(item==='ammo'){
  const w=WEAPONS[p.weapon],g=p.guns?.[p.weapon];
  if(!w||w.melee||(!g&&!inventory.includes(p.weapon)))return 'Выбери огнестрельное оружие';
  if((g?.reserve??p.reserve)>=w.reserve)return 'Резерв уже полный';
 }
 if(validUtility(item)&&(utilityCount(p)>=4||p.grenades[item]>=UTILITY[item].max))return 'Лимит: четыре гранаты, не более двух FLASH и одной каждого другого типа';
 const price=Math.round(offer.price*(e.price??1));
 if(p.money<price)return 'Недостаточно денег: нужно $'+price;
 return null;
}
