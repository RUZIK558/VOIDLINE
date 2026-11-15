// Opt-in LAN discovery only. Advertisements are untrusted until TLS certificate pinning.
import dgram from 'node:dgram';
import {networkInterfaces} from 'node:os';
export const DISCOVERY_PORT=3091;
const GROUP='239.255.86.76';
export function parseAdvertisement(raw,host,myId){
 if(raw.length>2048 || !/^(\d{1,3}\.){3}\d{1,3}$/.test(host))return null;
 let m;try{m=JSON.parse(raw.toString());}catch{return null;}
 if(!m||typeof m!=='object'||m.protocol!=='VOIDLINE-LAN-1'||m.id===myId||!/^[a-f0-9]{64}$/.test(m.id)||typeof m.name!=='string'||!Number.isInteger(m.port)||m.port<1024||m.port>65535)return null;
 const name=m.name.replace(/[^\p{L}\p{N}_ -]/gu,'').trim().slice(0,24)||'OPERATOR';
 return {id:m.id,name,host,port:m.port,code:'VLF1.'+Buffer.from(JSON.stringify({v:1,id:m.id,name,host,port:m.port})).toString('base64url')};
}
export async function createPeerDiscovery({identity,port=DISCOVERY_PORT,group=GROUP,intervalMs=3000}){
 const socket=dgram.createSocket({type:'udp4',reuseAddr:true}),peers=new Map();
 let error='',timer,closed=false;
 socket.on('error',e=>{error='Обнаружение LAN: '+(e.code||e.message);});
 socket.on('message',(raw,rinfo)=>{
  const peer=parseAdvertisement(raw,rinfo.address,identity().id);
  if(peer){if(peers.size>=64&&!peers.has(peer.id))return;peers.set(peer.id,{...peer,seenAt:Date.now()});}
 });
 try{
  await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(port,'0.0.0.0',()=>{socket.removeListener('error',reject);resolve();});});
  socket.setMulticastTTL(1);socket.setMulticastLoopback(true);
  let memberships=0;
  for(const list of Object.values(networkInterfaces()))for(const iface of list||[])if(iface.family==='IPv4'&&!iface.internal){try{socket.addMembership(group,iface.address);memberships++;}catch{}}
  if(!memberships)socket.addMembership(group);
 }catch(e){try{socket.close();}catch{}throw e;}
 function announce(){if(closed)return;const m=identity();if(!m.port)return;const raw=Buffer.from(JSON.stringify({protocol:'VOIDLINE-LAN-1',id:m.id,name:m.name,port:m.port}));socket.send(raw,port,group,e=>{if(e)error='Обнаружение LAN: '+e.code;});}
 announce();timer=setInterval(announce,intervalMs);timer.unref();
 return {announce,snapshot(){const now=Date.now();for(const [id,p] of peers)if(now-p.seenAt>12000)peers.delete(id);return {nearby:[...peers.values()],discoveryError:error};},close(){if(closed)return;closed=true;clearInterval(timer);socket.close();peers.clear();}};
}
