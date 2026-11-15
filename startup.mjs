import http from 'node:http';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function privateURL(origin){const url=new URL('/',origin);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw Error('UI must use private IPv4 loopback');return url;}
// A diagnostic probe, not permission to navigate. Some hosts block Node HTTP
// separately from Chromium; the actual game session must still get a chance.
export function probeLocalUI(origin,{timeout=5000}={}){
 let url;try{url=privateURL(origin);}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let size=0,body='',settled=false;const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(value);};
 const req=http.get(url,{agent:false},res=>{res.setEncoding('utf8');res.on('data',s=>{size+=Buffer.byteLength(s);if(size>1024*1024){req.destroy(Error('UI response too large'));return;}body+=s;});res.on('end',()=>res.statusCode===200&&body.includes('id="createOpen"')?finish(null,{status:200,bytes:size}):finish(Error('Local UI not ready: HTTP '+res.statusCode)));res.on('error',e=>finish(e));res.on('aborted',()=>finish(Error('Local UI response aborted')));});
 const timer=setTimeout(()=>req.destroy(Error('Local UI readiness timeout')),Math.max(1,timeout));req.on('error',e=>finish(e));
 });
}
function deadline(work,ms,label){let timer;return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label)),ms))]).finally(()=>clearTimeout(timer));}
export async function loadLocalUI({origin,load,ready=()=>false,probe=probeLocalUI,log=()=>{},attempts=3,delay=sleep,isClosed=()=>false,navigationTimeout=60000,readyTimeout=15000,stop=()=>{}}){
 const url=privateURL(origin).href;let last;
 const note=(...args)=>{try{log(...args);}catch{}};
 // Start only one bounded diagnostic probe. It must never hold navigation hostage.
 Promise.resolve().then(()=>deadline(()=>probe(origin),5000,'Local UI readiness timeout')).then(status=>note('ui-ready',JSON.stringify(status)),error=>note('ui-probe-warning',error.message));
 for(let i=0;i<attempts;i++){
  if(isClosed())return {closed:true};
  try{note('ui-navigation-start',JSON.stringify({attempt:i+1,url}));await deadline(()=>load(url),navigationTimeout,'Local UI navigation timeout');if(!await deadline(ready,readyTimeout,'Local UI document check timeout'))throw Error('Loaded document has no game interface');note('ui-loaded',url);return {attempts:i+1,url};}
  catch(e){last=e;note('ui-load-failed',JSON.stringify({attempt:i+1,code:e.code,errno:e.errno,message:e.message,url}));
   if(isClosed())return {closed:true};
   if(await deadline(ready,readyTimeout,'Local UI recovery check timeout').catch(()=>false)){note('ui-recovered','Interface already loaded');return {attempts:i+1,url,recovered:true};}
   try{stop();}catch{}if(i+1<attempts)await delay([300,1000,2000][i]??2000);
  }
 }
 throw new Error('Не удалось открыть локальный интерфейс после '+attempts+' попыток. '+(last?.message||''),{cause:last});
}
