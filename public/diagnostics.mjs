export function setupDiagnostics(getInfo){
 const records=[];let failed=false;
 try{records.push(...JSON.parse(localStorage.getItem('voidline.diagnostics')||'[]').slice(-15));}catch{}
 const log=(kind,message)=>{
  const entry={time:new Date().toISOString(),kind,message:String(message).slice(0,3000),...getInfo()};
  records.push(entry);if(records.length>30)records.shift();
  try{localStorage.setItem('voidline.diagnostics',JSON.stringify(records));}catch{}
  window.voidlineDiagnostics?.record(entry)?.catch(()=>{});
 };
 async function saveReport(){
  const security={client:await window.voidlineAntiCheat?.status(),localServer:(await window.voidlineHost?.invoke('status'))?.result?.antiCheat};
  const text=JSON.stringify({version:'1.0.9',info:getInfo(),security,events:records},null,2),a=document.createElement('a');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.href=url;a.download='VOIDLINE-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function safeReload(){
  const value={frameCap:60,renderScale:.65,renderResolution:'native',shadows:'off',aa:'fxaa'};
  try{const old=JSON.parse(localStorage.getItem('voidline.settings.v1')||'{}');localStorage.setItem('voidline.settings.v1',JSON.stringify({...old,...value}));}catch{}
  if(window.voidlineSettings){try{const r=await window.voidlineSettings.invoke('load');await window.voidlineSettings.invoke('save',{...(r.result||{}),...value});}catch{}}
  location.reload();
 }
 function fail(kind,message){
  if(failed)return;failed=true;log(kind,message);document.exitPointerLock?.();
  const el=document.getElementById('fatal');el.replaceChildren();el.hidden=false;
  const title=document.createElement('h2');title.textContent='ИГРА ПРИОСТАНОВЛЕНА';
  const p=document.createElement('p');p.textContent=kind==='webgl'?'Графический контекст потерян. Такое возможно при нехватке видеопамяти или сбое драйвера. Можно перезапустить на сниженных настройках.':'Произошла ошибка. Сохрани отчёт — он поможет найти точную причину.';
  const detail=document.createElement('pre');detail.textContent=String(message).slice(0,350);
  const save=document.createElement('button');save.textContent='СОХРАНИТЬ ОТЧЁТ';save.onclick=saveReport;
  const safe=document.createElement('button');safe.textContent='ПЕРЕЗАПУСТИТЬ · НИЗКАЯ ГРАФИКА';safe.onclick=safeReload;
  const restart=document.createElement('button');restart.textContent='ПЕРЕЗАПУСТИТЬ';restart.onclick=()=>location.reload();
  el.append(title,p,detail,save,safe,restart);
 }
 window.addEventListener('error',e=>{if(e.error)fail('javascript',e.error.stack||e.message);});
 window.addEventListener('unhandledrejection',e=>fail('promise',e.reason?.stack||e.reason));
 document.getElementById('world').addEventListener('webglcontextlost',e=>{e.preventDefault();fail('webgl','webglcontextlost');});
 const button=document.createElement('button');button.id='saveDiagnostics';button.className='secondary';button.textContent='СОХРАНИТЬ ОТЧЁТ ОБ ОШИБКАХ';button.onclick=saveReport;
 document.getElementById('pauseSettings').after(button);
 return {get failed(){return failed;},log};
}
