// Engineering check, not a win-rate claim. Uniform speed, no combat, same player
// radius, both site disks, all five slots; 8-direction Dijkstra with swept edges.
import {MAPS}from'../public/maps.mjs';
import {blocked}from'../public/shared.mjs';
import {writeFileSync}from'node:fs';
class Heap{a=[];push(v){let a=this.a,i=a.length;a.push(v);while(i){let j=(i-1)>>1;if(a[j][0]<=v[0])break;a[i]=a[j];i=j;}a[i]=v;}pop(){const a=this.a,o=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j;}a[i]=v;}return o;}}
const report=[];
for(const map of Object.values(MAPS)){
 const W=map.w-1,D=map.d-1,ox=-map.w/2+1,oz=-map.d/2+1,groundN=W*D,portals=[],extra=new Map();
 const addEdge=(a,b,c)=>{if(!extra.has(a))extra.set(a,[]);extra.get(a).push([b,c]);if(!extra.has(b))extra.set(b,[]);extra.get(b).push([a,c]);};
 const clear=new Uint8Array(groundN),edges=new Map();
 for(let iz=0;iz<D;iz++)for(let ix=0;ix<W;ix++)clear[iz*W+ix]=!blocked(ox+ix,oz+iz,.36,map.boxes);
 // Optional upper-storey shortcuts are included, not just the 2D ground grid.
 for(const g of map.structures){
  const ids=[];
  for(const st of g.stairs){
   const pos={x:g.x,z:st.z+st.side*.8},id=groundN+portals.length;portals.push(pos);ids.push(id);
   for(let ix=Math.max(0,Math.floor(pos.x-ox)-2);ix<=Math.min(W-1,Math.ceil(pos.x-ox)+2);ix++)for(let iz=Math.max(0,Math.floor(pos.z-oz)-2);iz<=Math.min(D-1,Math.ceil(pos.z-oz)+2);iz++){
    const k=iz*W+ix;if(!clear[k])continue;const dx=ox+ix-pos.x,dz=oz+iz-pos.z,d=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(d/.2));let pass=true;
    for(let i=0;i<=n;i++)if(blocked(pos.x+dx*i/n,pos.z+dz*i/n,.36,map.boxes)){pass=false;break;}
    if(pass)addEdge(id,k,d);
   }
  }
  addEdge(ids[0],ids[1],g.stairs.reduce((a,st)=>a+st.n*st.run+.8,0)+g.d+3);
 }
 const N=groundN+portals.length;
 for(const site of map.sites){
  const dist=new Float64Array(N);dist.fill(Infinity);const q=new Heap();
  for(let iz=0;iz<D;iz++)for(let ix=0;ix<W;ix++){const k=iz*W+ix;if(clear[k]&&Math.hypot(ox+ix-site.x,oz+iz-site.z)<=site.radius){dist[k]=0;q.push([0,k]);}}
  while(q.a.length){const[d,k]=q.pop();if(d!==dist[k])continue;for(const[v,c]of extra.get(k)||[]){const nd=d+c;if(nd<dist[v]){dist[v]=nd;q.push([nd,v]);}}if(k>=groundN)continue;const ix=k%W,iz=(k/W)|0;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    if((!dx&&!dz)||ix+dx<0||ix+dx>=W||iz+dz<0||iz+dz>=D)continue;
    const v=(iz+dz)*W+ix+dx;if(!clear[v])continue;
    if(dx&&dz&&(!clear[iz*W+ix+dx]||!clear[(iz+dz)*W+ix]))continue;
    const ek=Math.min(k,v)*N+Math.max(k,v);let pass=edges.get(ek);
    if(pass===undefined){pass=true;for(const a of [.25,.5,.75])if(blocked(ox+ix+dx*a,oz+iz+dz*a,.36,map.boxes)){pass=false;break;}edges.set(ek,pass);}
    if(!pass)continue;const nd=d+Math.hypot(dx,dz);if(nd<dist[v]){dist[v]=nd;q.push([nd,v]);}
   }
  }
  const times={};for(const role of['CT','T']){const [sx,sz]=map.spawns[role];times[role]=[-6,-3,0,3,6].map(off=>{const ix=Math.round(sx+off-ox),iz=Math.round(sz-oz),distance=dist[iz*W+ix];if(!Number.isFinite(distance))throw Error(map.id+' no path '+role);return {slot:off,metres:+distance.toFixed(3),seconds:+(distance/5.2).toFixed(3)};});}
  const ctSlow=Math.max(...times.CT.map(t=>t.seconds)),tFast=Math.min(...times.T.map(t=>t.seconds)),lead=+(tFast-ctSlow).toFixed(3);
  if(lead<.8)throw Error(`${map.id} ${site.id}: CT lead too small ${lead}`);
  report.push({map:map.id,site:site.id,speed:5.2,CT:times.CT,T:times.T,minimumCTLead:lead});
  console.log(`${map.name} ${site.id}: CT ${Math.min(...times.CT.map(t=>t.seconds)).toFixed(2)}–${ctSlow.toFixed(2)}s; T ${tFast.toFixed(2)}–${Math.max(...times.T.map(t=>t.seconds)).toFixed(2)}s; worst-slot CT lead ${lead.toFixed(2)}s`);
 }
}
writeFileSync(new URL('../tests/map-balance-1.0.2.json',import.meta.url),JSON.stringify({method:'8-neighbour 1m Dijkstra plus physical stair/upper-storey portal shortcuts, swept ground collision radius .36m, arrival at site disk, uniform 5.2m/s, no combat or special-event jumps, rounded milliseconds',results:report},null,2)+'\n');
