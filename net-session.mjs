import { randomBytes } from 'node:crypto';
export class SessionReservations {
 constructor(ttl=30000){this.ttl=ttl;this.tokens=new Map();}
 create(id){const token=randomBytes(32).toString('hex');this.tokens.set(token,{id,expires:Infinity,active:true});return token;}
 disconnect(token,now=Date.now()){const s=this.tokens.get(token);if(s){s.active=false;s.expires=now+this.ttl;}}
 resume(token,now=Date.now()){const s=typeof token==='string'?this.tokens.get(token):null;if(!s||s.active||s.expires<=now)return null;s.active=true;s.expires=Infinity;return s.id;}
 expire(now=Date.now()){const ids=[];for(const [t,s] of this.tokens)if(!s.active&&s.expires<=now){ids.push(s.id);this.tokens.delete(t);}return ids;}
 clear(){this.tokens.clear();}
}
