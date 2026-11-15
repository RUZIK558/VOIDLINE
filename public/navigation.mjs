import {blocked,feetY} from './shared.mjs';
const edgeCache=new WeakMap();
// Shared BFS with segment checks. No hard-coded old 38x48 arena limits.
function groundRoute(map,p,t,lane=0){
 const step=2,key=(x,z)=>x+','+z;let sx=Math.round(p.x/step),sz=Math.round(p.z/step);
 const clear=(a,b,c,d)=>{const n=Math.ceil(Math.hypot(c-a,d-b)/.4);for(let i=0;i<=n;i++)if(blocked(a+(c-a)*i/Math.max(1,n),b+(d-b)*i/Math.max(1,n),.48,map.boxes))return false;return true;};
 const candidates=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)candidates.push([sx+dx,sz+dz]);
 candidates.sort((a,b)=>Math.hypot(a[0]*step-p.x,a[1]*step-p.z)-Math.hypot(b[0]*step-p.x,b[1]*step-p.z));
 const first=candidates.find(([x,z])=>!blocked(x*step,z*step,.48,map.boxes)&&clear(p.x,p.z,x*step,z*step));
 if(!first)return [];[sx,sz]=first;
 let edges=edgeCache.get(map);if(!edges){edges=new Map();edgeCache.set(map,edges);}
 const gridClear=(x,z,a,b)=>{const k=[key(x,z),key(a,b)].sort().join(";");if(!edges.has(k))edges.set(k,clear(x*step,z*step,a*step,b*step));return edges.get(k);};
 const queue=[[sx,sz]],seen=new Map([[key(sx,sz),null]]);let end=null,best=Infinity;
 for(let n=0;n<queue.length;n++){
  const [x,z]=queue[n],k=key(x,z),dist=Math.hypot(x*step-t.x,z*step-t.z);
  if(dist<best){best=dist;end=k;}
  if(dist<2.2&&clear(x*step,z*step,t.x,t.z)){end=k;break;}
  for(const [dx,dz] of (lane===1?[[-1,0],[0,-1],[0,1],[1,0]]:lane===2?[[0,-1],[0,1],[1,0],[-1,0]]:[[1,0],[-1,0],[0,1],[0,-1]])){
   const a=x+dx,b=z+dz,k2=key(a,b);
   if(Math.abs(a*step)>map.w/2-1||Math.abs(b*step)>map.d/2-1||seen.has(k2)||!gridClear(x,z,a,b))continue;
   seen.set(k2,k);queue.push([a,b]);
  }
 }
 const out=[];while(end&&seen.get(end)!==null){out.unshift(end.split(',').map(Number).map(n=>n*step));end=seen.get(end);}
 if(Math.hypot(sx*step-p.x,sz*step-p.z)>.02)out.unshift([sx*step,sz*step]);
 // Starting at an arbitrary coordinate must connect to the grid without cutting a wall.
 if(out.length&&!clear(p.x,p.z,...out[0]))return [];
 const last=out.at(-1)||[p.x,p.z];if(clear(...last,t.x,t.z))out.push([t.x,t.z]);
 return out;
}

// Elevated destinations route through explicit stair portals. Ground circulation
// remains on its own layer, so a bot cannot plan through a ceiling or teleport.
export function route(map,p,t,lane=0){
 const pf=Number.isFinite(p.y)?feetY(p):0,tf=Number.isFinite(t.y)?feetY(t):0;
 const locate=(q,h)=>(map.structures||[]).find(g=>h>.1&&h<=g.height+.15&&(
  (Math.abs(q.x-g.x)<g.w/2+1&&q.z>=g.z-g.d/2-3.4&&q.z<=g.z+g.d/2+.4)||
  g.stairs.some(st=>Math.abs(q.x-g.x)<1.8&&q.z>=Math.min(st.z,st.edge)-.4&&q.z<=Math.max(st.z,st.edge)+.4)));
 const start=locate(p,pf),end=locate(t,tf);
 if(!start&&!end)return groundRoute(map,p,t,lane);
 const entrance=(g,st)=>({x:g.x,z:st.z+st.side*.8});
 const onStair=(q,g,st)=>Math.abs(q.x-g.x)<1.8&&q.z>=Math.min(st.z,st.edge)-.4&&q.z<=Math.max(st.z,st.edge)+.4;
 const stairPath=(g,st,up,q=null)=>{
  const points=[];const n=st.n*2;
  for(let i=0;i<=n;i++){
   const a=up?i/n:1-i/n,z=st.z+(st.edge-st.z)*a;
   if(q&&onStair(q,g,st)&&((up&&st.side*(z-q.z)>.2)||(!up&&st.side*(z-q.z)<-.2)))continue;
   points.push([g.x,z]);
  }
  if(up)points.push([g.x,st.edge-st.side*.55]);else{const e=entrance(g,st);points.push([e.x,e.z]);}
  return points;
 };
 if(start&&start===end){
  const st=start.stairs.find(st=>onStair(p,start,st));
  return [...(st?stairPath(start,st,true,p):[]),[start.x,start.z],[t.x,t.z]];
 }
 let prefix=[],from={x:p.x,z:p.z};
 if(start){
  const st=start.stairs.find(st=>onStair(p,start,st))||[...start.stairs].sort((a,b)=>Math.hypot(t.x-start.x,t.z-a.z)-Math.hypot(t.x-start.x,t.z-b.z))[0];
  if(!onStair(p,start,st))prefix.push([start.x,start.z],[start.x,st.edge-st.side*.55]);
  prefix.push(...stairPath(start,st,false,p));from=entrance(start,st);
 }
 if(!end)return [...prefix,...groundRoute(map,from,t,lane)];
 let best=null,bestDistance=Infinity;
 for(const st of end.stairs){
  const e=entrance(end,st),path=groundRoute(map,from,e,lane);
  if(!path.length||Math.hypot(path.at(-1)[0]-e.x,path.at(-1)[1]-e.z)>.05)continue;
  let d=0,prev=from;for(const [x,z]of path){d+=Math.hypot(x-prev.x,z-prev.z);prev={x,z};}
  if(d<bestDistance){bestDistance=d;best=[...path,...stairPath(end,st,true),[end.x,end.z],[t.x,t.z]];}
 }
 return best?[...prefix,...best]:prefix;
}
