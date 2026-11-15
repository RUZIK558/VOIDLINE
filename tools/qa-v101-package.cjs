const {_electron:electron}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),env={...process.env,DISPLAY:':97',XDG_SESSION_TYPE:'wayland',WAYLAND_DISPLAY:'qa-no-wayland'};
(async()=>{const app=await electron.launch({executablePath:ROOT+'/dist/linux-unpacked/voidline-arena',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--user-data-dir=/data/voidline-packaged-qa-101-'+Date.now()],env,timeout:60000});const results=[],errors=[];let p;
 try{
 p=await app.firstWindow();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.stack));await p.waitForLoadState('load');await p.waitForFunction(()=>document.getElementById('scanPeers'));
 const info=await app.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,ozone:app.commandLine.getSwitchValue('ozone-platform')}));assert.deepEqual(info,{version:'1.0.1',packaged:true,ozone:'x11'});results.push('Packaged Linux launcher selects X11 before startup with both DISPLAY and WAYLAND_DISPLAY');
 await p.evaluate(()=>{const WS=WebSocket;window.WebSocket=class extends WS{constructor(...a){super(...a);this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='welcome')window.qaId=m.id;if(m.type==='state')window.qaState=m;});}};});
 await p.locator('#createOpen').click();await p.locator('#botsA').selectOption('0');await p.locator('#botsB').selectOption('0');await p.locator('#createPlay').click();await p.locator('[data-team=T]').click();await p.waitForFunction(()=>window.qaState?.players.some(p=>p.id===window.qaId));
 if(!await p.evaluate(()=>!!document.pointerLockElement)){await p.waitForTimeout(1400);await p.locator('#resume').click();}
 await p.waitForFunction(()=>document.getElementById('mouseBackend').textContent.includes('XInput2'));results.push('Packaged ASAR starts its unpacked native XInput2 helper');
 const readings=[];for(let i=0;i<4;i++){const before=await p.evaluate(()=>qaState.players.find(p=>p.id===qaId).yaw);execFileSync('xdotool',['mousemove_relative','--','900','0'],{env});await p.waitForFunction(before=>qaState.players.find(p=>p.id===qaId).yaw!==before,before,{timeout:6000});readings.push(await p.evaluate(()=>qaState.players.find(p=>p.id===qaId).yaw));}
 results.push('Packaged native deltas reach the authoritative server across four beyond-screen motions');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.pointerLockElement);assert.deepEqual(errors,[]);assert.equal(await p.locator('#fatal').isVisible(),false);results.push('Esc releases capture; no page errors in packaged client');
 fs.writeFileSync(ROOT+'/tests/packaged-linux-1.0.1.txt',results.map(s=>s+' PASS').join('\n')+'\n');console.log(results.join('\n'));
 }catch(e){if(p){await p.screenshot({path:'/data/package101-failure.png'});console.error(await p.locator('#mouseBackend').textContent());}throw e;}finally{await app.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
