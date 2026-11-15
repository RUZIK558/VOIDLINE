// Frozen tiny arena used by pre-0.9 mechanics regression cases (not shipped / playable).
import * as S from '../public/shared.mjs';
import * as U from '../public/utilities.mjs';
import {TacticalMatch as Match} from '../match.mjs';
export * from '../public/shared.mjs';
export * from '../public/utilities.mjs';
export const BOXES=[[-19,0,1,49,9,0],[19,0,1,49,9,0],[0,-24,38,1,9,0],[0,24,38,1,9,0],[-10,-14,6,9,4,0],[10,14,6,9,4,0],[-10,14,6,9,4,0],[10,-14,6,9,4,0],[-5,0,3,10,3.4,1],[5,0,3,10,3.4,1],[0,0,5,3,1.9,2],[-14,0,3,5,2.3,2],[14,0,3,5,2.3,2],[-1,-12,4,2,1.8,2],[1,12,4,2,1.8,2],[-15,-20,2,2,2,2],[15,20,2,2,2,2],[-15,20,2,2,2,2],[15,-20,2,2,2,2]];
export const SITES=[{id:'A',x:-15,z:-7,radius:2.6},{id:'B',x:15,z:-7,radius:2.6}];
export const LEGACY={id:'fixture',w:38,d:48,boxes:BOXES,sites:SITES,spawns:{T:[0,20],CT:[0,-20]}};
export class TacticalMatch extends Match{constructor(...a){super(...a);this.map=LEGACY;}}
export const blocked=(x,z,r=.36,boxes=BOXES)=>S.blocked(x,z,r,boxes);
export const move=(p,x,z,boxes=BOXES)=>S.move(p,x,z,boxes);
export const accelerate=(p,i,dt,boxes=BOXES)=>S.accelerate(p,i,dt,boxes);
export const atSite=(p,sites=SITES)=>S.atSite(p,sites);
export const advanceGrenade=(g,dt,boxes=BOXES)=>U.advanceGrenade(g,dt,boxes);
export const flashPower=(p,g,boxes=BOXES)=>U.flashPower(p,g,boxes);
export const fireCells=(g,boxes=BOXES)=>U.fireCells(g,boxes);
