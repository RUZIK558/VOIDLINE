import {spawn} from 'node:child_process';
// OS motion is read only during an explicitly acquired in-game pointer lock.
export function createLinuxInput({platform=process.platform,display=process.env.DISPLAY,ozone='x11',executable,getWindow,sendDelta=()=>{},sendStatus=()=>{},spawnHelper=spawn}){
 let session=null,closing=false;
 const stop=()=>{const s=session;session=null;if(!s)return;clearInterval(s.flush);clearTimeout(s.timeout);s.resolve?.({active:false,backend:'browser',reason:'Захват освобождён'});s.resolve=null;s.child.kill();};
 const fallback=reason=>({active:false,backend:'browser',reason});
 async function capture(value){
  if(!value){stop();return fallback('Захват освобождён');}
  const win=getWindow();
  if(closing||!win||win.isDestroyed()||!win.isFocused())return fallback('Окно игры не в фокусе');
  if(platform!=='linux')return fallback('Системный Pointer Lock');
  if(!display||ozone==='wayland')return fallback('Для XInput2 нужен X11 / XWayland. Запусти игру в сеансе с DISPLAY.');
  if(session)return session.promise;
  const handle=win.getNativeWindowHandle();if(!handle||handle.length<4)return fallback('Нет X11-окна');
  let resolve;const promise=new Promise(r=>resolve=r);
  const s={child:null,promise,resolve,ready:false,buffer:'',dx:0,dy:0,flush:null,timeout:null};session=s;
  const finish=result=>{s.resolve?.(result);s.resolve=null;};
  const fail=reason=>{if(session!==s)return;const resolve=s.resolve;s.resolve=null;stop();const status=fallback(reason);resolve?.(status);sendStatus(status);};
  try{s.child=spawnHelper(executable,[handle.readUInt32LE(0).toString(16)],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,DISPLAY:display}});}catch(e){session=null;return fallback('XInput2: '+e.message);}
  s.timeout=setTimeout(()=>fail('XInput2 не ответил; используется Pointer Lock'),3000);
  s.child.stdout.setEncoding('utf8');s.child.stdout.on('data',chunk=>{
   if(session!==s)return;s.buffer+=chunk;
   if(s.buffer.length>65536){fail('Некорректный поток XInput2');return;}
   let n;while((n=s.buffer.indexOf('\n'))>=0){const line=s.buffer.slice(0,n);s.buffer=s.buffer.slice(n+1);
    if(line==='READY'){s.ready=true;clearTimeout(s.timeout);finish({active:true,backend:'xinput2',reason:'Linux XInput2 · без границ экрана'});continue;}
    if(!s.ready)continue;const parts=line.trim().split(/\s+/);if(parts.length!==2)continue;
    const [dx,dy]=parts.map(Number);if(Number.isFinite(dx)&&Number.isFinite(dy)){s.dx+=Math.max(-10000,Math.min(10000,dx));s.dy+=Math.max(-10000,Math.min(10000,dy));}
   }
  });
  s.child.on('error',e=>fail('XInput2 недоступен: '+(e.code||e.message)));
  s.child.on('exit',()=>fail('XInput2 остановлен; используется Pointer Lock'));
  s.child.stderr.on('data',()=>{});
  s.flush=setInterval(()=>{if(session!==s||!s.ready)return;const w=getWindow();if(!w||w.isDestroyed()||!w.isFocused()){stop();sendStatus(fallback('Окно не в фокусе'));return;}if(s.dx||s.dy){const dx=s.dx,dy=s.dy;s.dx=s.dy=0;sendDelta({dx,dy});}},8);
  s.flush.unref?.();return promise;
 }
 return {capture,stop,close(){closing=true;stop();}};
}
export function linuxOzone({platform=process.platform,env=process.env,explicit}={}){
 if(platform!=='linux')return null;if(explicit)return explicit;
 if(['x11','wayland'].includes(env.VOIDLINE_OZONE_PLATFORM))return env.VOIDLINE_OZONE_PLATFORM;
 return env.DISPLAY?'x11':env.WAYLAND_DISPLAY?'wayland':null;
}
