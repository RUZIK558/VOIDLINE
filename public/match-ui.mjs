export const sideLabel=(team,attackTeam)=>team===attackTeam?'Т':'КТ';
export function spectatorTarget(players,me,current,step=0){
 if(!me||me.alive)return null;
 const allies=players.filter(p=>p.id!==me.id&&p.team===me.team&&p.alive&&!p.disconnected);
 if(!allies.length)return null;
 const index=allies.findIndex(p=>p.id===current);
 return allies[(Math.max(0,index)+step%allies.length+allies.length)%allies.length];
}
export function flashOpacity(flash,now){
 if(!flash||now>=flash.until)return 0;
 const duration=flash.until-flash.start;if(duration<=0)return 0;
 const remaining=Math.min(1,Math.max(0,(flash.until-now)/duration));
 // Hold full white briefly for a close, front-facing detonation, then fade.
 return Math.min(1,flash.peak*1.8)*Math.min(1,remaining/0.65);
}
