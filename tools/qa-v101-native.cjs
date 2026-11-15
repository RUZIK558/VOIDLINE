const {_electron:electron}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),env={...process.env,DISPLAY:':97',XDG_SESSION_TYPE:'wayland',WAYLAND_DISPLAY:'qa-no-wayland'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const app=await electron.launch({executablePath:ROOT+'/node_modules/electron/dist/electron',args:[ROOT,'--ozone-platform=x11','--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--user-data-dir=/data/voidline-qa-101-'+Date.now()],env,timeout:60000});
 const results=[],errors=[];let p;
 const pass=s=>{results.push(s+' PASS');console.log(s,'PASS');};
 try{
 p=await app.firstWindow();p.setDefaultTimeout(60000);p.on('pageerror',e=>{errors.push(e.stack);console.error('PAGE ERROR',e.stack);});
 await p.waitForLoadState('load');await p.waitForFunction(()=>document.getElementById('scanPeers'));await wait(300);
 await p.waitForSelector('#createOpen');
 const ozone=await app.evaluate(({app})=>app.commandLine.getSwitchValue('ozone-platform'));assert.equal(ozone,'x11');pass('Native Linux startup uses explicit pre-start X11 flag even with WAYLAND_DISPLAY');
 await p.route('**/game.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(ROOT+'/public/game.mjs','utf8')+`\nwindow.qa101={state:()=>({nativeMouse,locked:capture.locked,actual:document.pointerLockElement===canvas,yaw,pitch,me,phase:state?.phase,attackTeam:state?.attackTeam,backend:mouseBackendLabel.textContent,unread:chatNotices.unread}),shop:()=>{releaseGameControls();document.getElementById('buyMenu').hidden=false;document.getElementById('pause').hidden=true;renderShop();showShopModel('rifle');return shopPreview.side;},shopAs:(team,attackTeam)=>{const oldMe=me.team,oldAttack=state.attackTeam;me.team=team;state.attackTeam=attackTeam;showShopModel('rifle');const side={side:shopPreview.side,label:document.getElementById('shopCanvas').getAttribute('aria-label')};me.team=oldMe;state.attackTeam=oldAttack;return side;}};`}));
 await p.evaluate(async()=>{await window.voidlineSettings.invoke('save',{frameCap:30,renderScale:.5,renderResolution:'1280x720',shadows:'off',aa:'off'});});await p.reload();await p.waitForFunction(()=>window.qa101);
 await p.locator('#createOpen').click();await p.locator('#botsA').selectOption('0');await p.locator('#botsB').selectOption('0');await p.locator('#createPlay').click();await p.locator('[data-team=T]').click();await p.waitForFunction(()=>qa101.state().me?.alive);
 assert.equal(await p.evaluate(()=>qa101.shop()),1);assert.match(await p.locator('#shopCanvas').getAttribute('aria-label'),/Т · Атака/);await p.screenshot({path:ROOT+'/previews/1.0.1-shop-T.png'});pass('Shop renders current T model, not default CT');
 const ct=await p.evaluate(()=>qa101.shopAs(0,1));assert.equal(ct.side,0);assert.match(ct.label,/КТ · Защита/);assert.equal((await p.evaluate(()=>qa101.shopAs(1,1))).side,1);pass('Shop rebuilds same selected item on role change / halftime');
 await p.locator('#closeBuy').evaluate(b=>b.click());
 async function resume(){if(!await p.evaluate(()=>qa101.state().locked)){await wait(1400);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());await p.locator('#resume').click();}await p.waitForFunction(()=>qa101.state().locked&&qa101.state().nativeMouse);}
 await resume();assert.match(await p.evaluate(()=>qa101.state().backend),/XInput2/);pass('Real Electron pointer lock starts native XInput2 backend');
 const readings=[];
 for(let i=0;i<12;i++){
  const before=await p.evaluate(()=>qa101.state().yaw);
  execFileSync('xdotool',['mousemove_relative','--','700','0'],{env});
  await p.waitForFunction(before=>qa101.state().yaw!==before,before,{timeout:5000});
  readings.push(await p.evaluate(()=>qa101.state().yaw));
 }
 assert.equal(await p.evaluate(()=>qa101.state().nativeMouse),true);pass('12 repeated +700 relative motions rotate indefinitely without Esc / screen-edge clamp');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!qa101.state().locked&&!qa101.state().nativeMouse);const paused=await p.evaluate(()=>qa101.state().yaw);
 execFileSync('xdotool',['mousemove_relative','--','900','0'],{env});await wait(250);assert.equal(await p.evaluate(()=>qa101.state().yaw),paused);pass('Esc stops raw capture; out-of-game motion cannot rotate camera');
 await resume();await p.locator('#chatToggle').evaluate(b=>b.click());await p.waitForFunction(()=>!qa101.state().nativeMouse);await p.locator('#matchChatText').fill('no global capture');const beforeChat=await p.evaluate(()=>qa101.state().yaw);execFileSync('xdotool',['mousemove_relative','--','200','0'],{env});await wait(100);assert.equal(await p.evaluate(()=>qa101.state().yaw),beforeChat);await p.locator('#chatToggle').evaluate(b=>b.click());pass('Opening chat releases native input and preserves editable input');
 // A real second network client sends a message to the game, not a direct UI hook.
 await p.evaluate(async()=>{window.peer101=new WebSocket('ws://'+location.host);await new Promise(r=>peer101.addEventListener('open',r,{once:true}));peer101.send(JSON.stringify({type:'join',name:'NOTICE TEST',team:'CT'}));await new Promise(r=>{const fn=e=>{if(JSON.parse(e.data).type==='welcome'){peer101.removeEventListener('message',fn);r();}};peer101.addEventListener('message',fn);});});
 await p.evaluate(()=>peer101.send(JSON.stringify({type:'chat',text:'Hello <script>window.bad=1</script>'})));
 await p.waitForFunction(()=>qa101.state().unread.match===1);assert.equal(await p.locator('.chatNotice').count(),1);assert.ok((await p.locator('.chatNotice').innerText()).includes('<script>'));assert.equal(await p.evaluate(()=>window.bad),undefined);assert.match(await p.locator('#chatToggle').innerText(),/1/);pass('Real received chat message shows toast + unread badge, HTML stays inert');
 await p.locator('#chatToggle').evaluate(b=>b.click());await p.waitForFunction(()=>qa101.state().unread.match===0);await p.locator('#matchChatText').fill('Own outgoing message');await p.locator('#matchChatForm').evaluate(f=>f.requestSubmit());await wait(300);assert.equal(await p.evaluate(()=>qa101.state().unread.match),0);pass('Opening chat clears unread; own message does not notify');
 await p.locator('#chatToggle').evaluate(b=>b.click());await p.evaluate(()=>window.dispatchEvent(new CustomEvent('voidline-chat-message',{detail:{scope:'p2p',senderId:'test',name:'PEER',text:'P2P notice'}})));await p.waitForFunction(()=>qa101.state().unread.p2p===1);assert.match(await p.locator('#openSocial').innerText(),/1/);pass('P2P unread notification and menu badge');
 await p.evaluate(()=>peer101.close());assert.deepEqual(errors,[]);assert.equal(await p.locator('#fatal').isVisible(),false);pass('No JavaScript errors / fatal overlay');
 fs.writeFileSync(ROOT+'/tests/native-1.0.1.txt',results.join('\n')+'\n');fs.writeFileSync(ROOT+'/tests/mouse-readings-1.0.1.json',JSON.stringify(readings));
 }catch(e){if(p){fs.writeFileSync('/data/native101-failure.json',JSON.stringify(await p.evaluate(()=>({state:window.qa101?.state(),fatal:document.getElementById('fatal')?.textContent})),null,2));await p.screenshot({path:'/data/native101-failure.png'});}throw e;}finally{await app.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
