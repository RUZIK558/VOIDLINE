const ROOT=require('node:path').resolve(__dirname,'..'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const {startServer}=await import('../server.mjs'),{createHostController}=await import('../host-controller.mjs');
 const server=await startServer({port:3188,host:'127.0.0.1',rules:{buyMs:30000}}),host=createHostController(server);
 const b=await chromium.launch({executablePath:require('child_process').execSync('which chromium').toString().trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[];try{
 const c=await b.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();p.setDefaultTimeout(60000);
 await p.exposeFunction('qaHost',(command,args)=>host.invoke(command,args));
 await p.addInitScript(()=>{window.voidlineHost={invoke:(cmd,args)=>window.qaHost(cmd,args)};if(!localStorage.getItem('voidline.settings.v1'))localStorage.setItem('voidline.settings.v1',JSON.stringify({frameCap:60,renderScale:.5,shadows:'off'}));const WS=WebSocket;window.WebSocket=class extends WS{constructor(...a){super(...a);window.qaSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='state')window.qaState=m;if(m.type==='welcome')window.qaId=m.id;});}};});
 p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:3188',{waitUntil:'domcontentloaded'});
 await p.locator('#createOpen').click();assert.equal(await p.locator('#mapChoice option').count(),8);
 await p.locator('#mapChoice').selectOption('frost');await p.locator('#botsA').selectOption('0');await p.locator('#botsB').selectOption('1');
 await p.screenshot({path:ROOT+'/previews/08-map-select.png'});
 await p.locator('#createPlay').click();await p.locator('#teamDialog').waitFor({state:'visible'});assert.equal(server.getStatus().connections,0);
 await p.screenshot({path:ROOT+'/previews/08-team-desktop.png'});
 await p.locator('[data-team=CT]').click();await p.waitForFunction(()=>window.qaState?.mapId==='frost');const state=await p.evaluate(()=>qaState),id=await p.evaluate(()=>qaId);assert.equal(state.players.find(p=>p.id===id).team,1-state.attackTeam);
 await p.waitForTimeout(500);await p.screenshot({path:ROOT+'/previews/08-frost-game.png'});
 await p.evaluate(()=>document.exitPointerLock());await p.locator('#pause').waitFor({state:'visible'});await p.locator('#leave').click();
 await p.locator('[data-pane=inventory]').click();assert.equal(await p.locator('#skinWeapon option').count(),10);
 for(const [id,skin] of [['ak47','ember'],['awp','arctic'],['deagle','cobalt'],['glock','carbon'],['p90','circuit'],['mp9','arctic'],['m4a1s','ember'],['ssg08','cobalt'],['rifle','carbon'],['pistol','circuit']]){
  await p.locator('#skinWeapon').selectOption(id);await p.locator(`[data-skin=${skin}]`).click();
 }
 await p.locator('#skinWeapon').selectOption('ak47');await p.screenshot({path:ROOT+'/previews/08-all-skins.png'});
 const profile=await p.evaluate(()=>JSON.parse(localStorage.getItem('voidline.profile.v1')));assert.equal(Object.keys(profile.loadout).length,10);assert.equal(profile.loadout.ak47,'ember');assert.equal(profile.loadout.awp,'arctic');
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-pane=inventory]').click();await p.locator('#skinWeapon').selectOption('ak47');await p.locator('[data-skin=ember].selected').waitFor();
 console.log('DESKTOP: map selection8, explicit CT entry, frost snapshot, all10 independent skins + persistence PASS');
 // Recovery overlay and actual simulated WebGL loss.
 await p.evaluate(()=>document.getElementById('world').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await p.locator('#fatal').waitFor({state:'visible'});assert.match(await p.locator('#fatal').innerText(),/Графический контекст/);await p.screenshot({path:ROOT+'/previews/08-recovery.png'});
 const download=await Promise.all([p.waitForEvent('download'),p.locator('#fatal button').nth(0).click()]);
 const text=require('node:fs').readFileSync(await download[0].path(),'utf8');const report=JSON.parse(text);assert.equal(report.version,'0.8.0');assert.ok(report.events.some(e=>e.kind==='webgl'));
 await Promise.all([p.waitForEvent('load'),p.locator('#fatal button').nth(1).click()]);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('voidline.settings.v1')).renderScale),.65);assert.ok(await p.locator('#fatal').isHidden());
 console.log('WEBGL LOSS: recovery overlay, downloaded report and safe-settings reload PASS');
 await c.close();
 const m=await b.newContext({viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1});const q=await m.newPage();q.setDefaultTimeout(60000);q.on('pageerror',e=>errors.push(e.stack));
 await server.createMatch({mapId:'oasis',bots:[0,1]});
 await q.addInitScript(()=>localStorage.setItem('voidline.settings.v1',JSON.stringify({frameCap:60,renderScale:.5,shadows:'off'})));
 await q.goto('http://127.0.0.1:3188/?android=1',{waitUntil:'domcontentloaded'});await q.locator('#address').fill('127.0.0.1:3188');await q.locator('#join').click();await q.locator('#teamDialog').waitFor({state:'visible'});await q.screenshot({path:ROOT+'/previews/08-team-mobile.png'});await q.locator('[data-team=T]').tap();await q.locator('#movePad').waitFor({state:'visible'});await q.waitForTimeout(400);await q.screenshot({path:ROOT+'/previews/08-mobile-game.png'});console.log('MOBILE: landscape CT/T screen + Oasis entry + touch controls PASS');await m.close();
 assert.deepEqual(errors,[]);console.log('PAGEERRORS: none');
 }finally{await b.close();server.close();}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
