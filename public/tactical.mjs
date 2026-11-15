// Canonical team-radio vocabulary; clients never supply display text or positions.
export const QUICK_COMMANDS=Object.freeze([
 {id:'go_b',text:'Идём Б!',short:'Б',target:'B'},
 {id:'go_a',text:'Идём А!',short:'А',target:'A'},
 {id:'follow',text:'Идите за мной!',short:'→',target:'sender'},
 {id:'mid',text:'Идём мид!',short:'МИД',target:'mid'},
 {id:'quiet',text:'Не шумите!',short:'ТИШЕ'},
 {id:'curse',text:'ЧЕРТОВ ПРИДУРОК!!!',short:'!!!'}
].map(Object.freeze));
export const commandById=id=>typeof id==='string'?QUICK_COMMANDS.find(c=>c.id===id):undefined;
export const TACTICAL_TTL=8000;
export function selectedSector(x,y,deadzone=38){
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<deadzone)return null;
 const tau=Math.PI*2,angle=((Math.atan2(y,x)+Math.PI/2)%tau+tau)%tau;
 return Math.round(angle/(tau/6))%6;
}
