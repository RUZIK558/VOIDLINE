const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const temp=ROOT+'/.qa-server-v1.mjs';fs.writeFileSync(temp,fs.readFileSync(ROOT+'/server.mjs','utf8').replace('    port: app.address().port,','    qaGame:game,\n    port: app.address().port,'));
 const {startServer}=await import(temp),{createHostController}=await import('../host-controller.mjs');
 const server=await startServer({port:0,host:'127.0.0.1',rules:{buyMs:600000,roundMs:600000}}),game=server.qaGame,host=createHostController(server);
 const browser=await chromium.launch({executablePath:require('child_process').execSync('which chromium').toString().trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],results=[];const push=results.push.bind(results);results.push=(...xs)=>{console.log(...xs);return push(...xs);};fs.mkdirSync(ROOT+'/previews/1.0',{recursive:true});
 try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(30000);p.on('pageerror',e=>{errors.push(e.stack);console.error('PAGE ERROR',e.stack);});
 await p.exposeFunction('qaHost',(cmd,args)=>host.invoke(cmd,args));
 const hook=`\nwindow.qa={state:()=>({me,state,spectateId,actor:pov(),camera:camera.position.toArray(),rotation:camera.rotation.toArray(),locked:capture.locked,yaw,pitch}),muzzle:()=>{const w=getView(pov().weapon).userData.weapon;gun.updateMatrixWorld(true);const expected=gun.worldToLocal(w.localToWorld(w.userData.muzzle.clone()));return {expected:expected.toArray(),actual:flash.position.toArray()};},model:()=>[...models].map(([id,m])=>({id,side:m.root.userData.side,visible:m.root.visible})),palettes:()=>{const a=buildOperator(0),b=buildOperator(1);const colors=o=>{const s=[];o.traverse(n=>{if(n.isSkinnedMesh)s.push(n.material.color.getHexString())});return s;};const result=[colors(a),colors(b)];disposeOwnedTree(a);disposeOwnedTree(b);return result;}};`;
 await p.route('**/game.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(ROOT+'/public/game.mjs','utf8')+hook}));
 await p.addInitScript(()=>{window.voidlineHost={invoke:(cmd,args)=>window.qaHost(cmd,args)};localStorage.setItem('voidline.settings.v1',JSON.stringify({frameCap:60,renderScale:.5,shadows:'off',aa:'off'}));});
 await p.goto('http://127.0.0.1:'+server.port,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qa);
 await p.locator('[data-pane=settings]').click();await p.locator('[data-settings-tab=crosshair]').click();
 let bars=await p.locator('#crossSample i').evaluateAll(ns=>ns.map(n=>({position:getComputedStyle(n).position,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
 assert.equal(bars.length,4);assert.ok(bars.every(b=>b.position==='absolute'&&b.w>0&&b.h>0));
 await p.locator('#pref-crossSize').fill('18');await p.locator('#pref-crossSize').dispatchEvent('input');assert.equal(await p.locator('#crossSample i').nth(0).evaluate(n=>n.style.height),'18px');await p.screenshot({path:ROOT+'/previews/1.0/crosshair.png'});results.push('crosshair live DOM / slider PASS');
 await p.locator('#settingsClose').click();
 const palettes=await p.evaluate(()=>qa.palettes());assert.notDeepEqual(palettes[0],palettes[1]);results.push('separate CT/T skinned material palettes PASS');
 await p.locator('#createOpen').click();await p.locator('#botsA').selectOption('0');await p.locator('#botsB').selectOption('0');await p.locator('#createPlay').click();await p.locator('[data-team=T]').click();await p.waitForFunction(()=>qa.state().me?.alive);
 const id=await p.evaluate(()=>qa.state().me.id),me=game.players.get(id);me.money=16000;assert.equal(game.buy(me,'awp'),null);assert.equal(game.buy(me,'flash'),null);
 await p.waitForFunction(()=>qa.state().me.weapon==='awp');await p.waitForTimeout(400);
 const muzzle=await p.evaluate(()=>qa.muzzle());for(let i=0;i<3;i++)assert.ok(Math.abs(muzzle.expected[i]-muzzle.actual[i])<1e-6);results.push('AWP muzzle sprite uses exact model transform PASS');
 // Every firearm exercises the lazy view-model path and its own muzzle socket.
 for(const id of ['rifle','pistol','ak47','m4a1s','awp','ssg08','mp9','p90','deagle','glock']){
  const {WEAPONS}=await import('../public/shared.mjs');const w=WEAPONS[id];
  me.guns[id]={ammo:w.mag,reserve:w.reserve,skin:'standard',owner:me.id};me.weapon=id;
  await p.waitForFunction(id=>qa.state().me.weapon===id,id);await p.waitForTimeout(160);
  const muzzle=await p.evaluate(()=>qa.muzzle());for(let i=0;i<3;i++)assert.ok(Math.abs(muzzle.expected[i]-muzzle.actual[i])<1e-5,id);
 }
 results.push('all ten firearm view-models and muzzle sockets PASS');
 const ally=game.make('ALLY ONE',0),ally2=game.make('ALLY TWO',0),enemy=game.make('ENEMY',1);ally.bot=ally2.bot=enemy.bot=false;
 ally.money=16000;assert.equal(game.buy(ally,'mp9'),null);ally.guns.mp9.ammo=17;
 game.phase='live';game.until=Date.now()+600000;
 game.kill(me,enemy,Date.now());await p.waitForFunction(()=>qa.state().spectateId&&qa.state().actor.name==='ALLY ONE');await p.waitForTimeout(400);
 const observed=await p.evaluate(()=>qa.state());assert.equal(observed.actor.id,ally.id);assert.ok(observed.camera.every((v,i)=>Math.abs(v-[ally.x,ally.y,ally.z][i])<.05));await p.waitForFunction(()=>document.getElementById('ammo').textContent==='17');assert.equal((await p.evaluate(()=>qa.model())).find(p=>p.id===ally.id).visible,false);results.push('first-person ally camera / body hidden / weapon-ammo HUD PASS');await p.screenshot({path:ROOT+'/previews/1.0/spectator.png'});
 // Genuine browser lock from a user gesture, not a synthetic locked flag.
 await p.waitForTimeout(1300);if(!await p.evaluate(()=>qa.state().locked)){await p.locator('#resume').click();}
 await p.waitForFunction(()=>qa.state().locked);await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>qa.state().actor.name==='ALLY TWO');assert.notEqual(await p.evaluate(()=>qa.state().actor.id),enemy.id);results.push('real pointer lock + spectator key cycling PASS');
 game.kill(ally2,enemy,Date.now());await p.waitForFunction(()=>qa.state().actor.name==='ALLY ONE');
 Object.assign(ally,{x:0,z:0,y:1.65,yaw:0,pitch:0});const boxes=game.map.boxes;game.map={...game.map,boxes:[]};game.detonate({kind:'flash',x:0,y:1.65,z:-3},Date.now());
 await p.waitForFunction(()=>Number(document.getElementById('flashBlind').style.opacity)>.98);await p.screenshot({path:ROOT+'/previews/1.0/flash.png'});results.push('real server flash replicated into full-white spectator overlay PASS');game.map={...game.map,boxes};
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!qa.state().locked);
 game.startRound(Date.now());await p.waitForFunction(()=>qa.state().me.alive&&!qa.state().spectateId);assert.equal(await p.evaluate(()=>qa.state().actor.id),me.id);results.push('respawn exits spectating PASS');
 // Live relative input on an alive player: repeated motions cannot hit desktop edges.
 await p.waitForTimeout(1300);await p.locator('#resume').click();await p.waitForFunction(()=>qa.state().locked);const yaw=await p.evaluate(()=>qa.state().yaw);for(let i=0;i<4;i++){await p.mouse.move(3000,450);await p.mouse.move(-2000,450);}assert.equal(await p.evaluate(()=>qa.state().locked),true);assert.notEqual(await p.evaluate(()=>qa.state().yaw),yaw);results.push('headless Chromium real lock: beyond-window aim PASS');
 await p.keyboard.press('Escape');await p.locator('#leave').click();await p.locator('#menu').waitFor({state:'visible'});await p.locator('#openSocial').click();assert.equal(await p.locator('#scanPeers').isVisible(),true);results.push('P2P discovery UI available PASS');
 assert.deepEqual(errors,[]);results.push('No page errors / no fatal overlay PASS');
 console.log(results.join('\n'));fs.writeFileSync(ROOT+'/tests/browser-1.0.txt',results.join('\n')+'\n');await p.close();
 }catch(e){for(const c of browser.contexts())for(const p of c.pages()){console.error('QA FAIL',await p.evaluate(()=>({state:window.qa?.state(),fatal:document.getElementById('fatal')?.textContent})));await p.screenshot({path:ROOT+'/previews/1.0/failure.png'});}throw e;}finally{await browser.close();server.close();fs.unlinkSync(temp);}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
