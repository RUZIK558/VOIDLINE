// Renderer reports are diagnostics, NOT remote attestation. VSAC never trusts
// this report to grant authority over movement, money, damage or match state.
export function createClientAntiCheat({bridge=globalThis.window?.voidlineAntiCheat,build='1.0.9',onStatus=()=>{}}={}){
 let socket=null,inputSeq=0,reportSeq=0,nonce='',busy=false,last={state:bridge?'unavailable':'browser',build,digest:''};
 async function report(){if(busy||!nonce||socket?.readyState!==1)return;busy=true;const current=socket;try{if(bridge){const s=await bridge.status();last={state:s.state,build:s.build||build,digest:s.digest||''};}if(current===socket&&current.readyState===1)current.send(JSON.stringify({type:'ac-report',nonce,seq:++reportSeq,client:last}));onStatus(last);}catch{}finally{busy=false;}}
 const timer=setInterval(()=>report(),15000);
 return {attach(ws){socket=ws;inputSeq=reportSeq=0;nonce='';ws.addEventListener('message',e=>{if(socket!==ws)return;try{const m=JSON.parse(e.data);if(m.type==='ac-challenge'&&m.protocol===1&&/^[a-f0-9]{32}$/.test(m.nonce)){nonce=m.nonce;report();}}catch{}});},join:()=>({protocol:1,build}),nextInput:()=>++inputSeq,status:()=>({...last}),dispose(){clearInterval(timer);socket=null;nonce='';}};
}
