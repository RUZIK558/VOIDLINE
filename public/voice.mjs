// Opt-in, direct LAN/VPN WebRTC audio. No recording, external STUN/TURN, or cloud service.
export function createVoice({send,myId,status}){
 let stream=null,enabled=false;const peers=new Map();
 async function peer(id,offer=false){
  if(!enabled||id===myId()||peers.has(id))return;
  const pc=new RTCPeerConnection({iceServers:[]}),audio=new Audio();audio.autoplay=true;peers.set(id,{pc,audio,queue:[]});
  for(const t of stream.getTracks())pc.addTrack(t,stream);
  pc.onicecandidate=e=>{if(e.candidate)send({type:'voice-signal',target:id,signal:{ice:e.candidate.toJSON()}});};
  pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>status('Нажми кнопку микрофона для разрешения аудио.'));};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')status('Голос: прямое соединение недоступно. Нужна одна LAN/VPN; relay отсутствует.');};
  if(offer){await pc.setLocalDescription(await pc.createOffer());send({type:'voice-signal',target:id,signal:{description:pc.localDescription.toJSON()}});}
 }
 function drop(id){const v=peers.get(id);if(v){v.pc.close();v.audio.srcObject=null;peers.delete(id);}}
 return {
  diagnostics(){return {enabled,connections:[...peers.values()].map(v=>v.pc.connectionState),remoteStreams:[...peers.values()].filter(v=>v.audio.srcObject).length};},
  async toggle(){if(enabled){this.stop();return false;}if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Голос требует localhost или HTTPS. По обычному LAN HTTP доступен текстовый чат.');
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});enabled=true;send({type:'voice-join'});status('Микрофон включён · прямой голос LAN/VPN');return true;
  },
  stop(){if(enabled)send({type:'voice-leave'});enabled=false;for(const id of peers.keys())drop(id);stream?.getTracks().forEach(t=>t.stop());stream=null;status('Микрофон выключен');},
  async handle(m){if(!enabled)return;try{
   if(m.type==='voice-peers')for(const id of m.peers)await peer(id,myId()<id);
   if(m.type==='voice-peer')await peer(m.id,myId()<m.id);
   if(m.type==='voice-left')drop(m.id);
   if(m.type==='voice-signal'){
    await peer(m.from,false);const v=peers.get(m.from);if(!v)return;
    const s=m.signal;
    if(s.description){if(s.description.type==='offer'&&v.pc.signalingState!=='stable')await v.pc.setLocalDescription({type:'rollback'});await v.pc.setRemoteDescription(s.description);for(const c of v.queue)await v.pc.addIceCandidate(c);v.queue=[];if(s.description.type==='offer'){await v.pc.setLocalDescription(await v.pc.createAnswer());send({type:'voice-signal',target:m.from,signal:{description:v.pc.localDescription.toJSON()}});}}
    if(s.ice){if(v.pc.remoteDescription)await v.pc.addIceCandidate(s.ice);else v.queue.push(s.ice);}
   }
  }catch(e){status('Голос: '+e.message);}},
 };
}
