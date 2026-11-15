const {_electron:electron}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),env={...process.env,DISPLAY:':97',XDG_SESSION_TYPE:'x11'};
(async()=>{
 const app=await electron.launch({executablePath:ROOT+'/node_modules/electron/dist/electron',args:[ROOT,'--ozone-platform=x11','--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--user-data-dir=/data/voidline-qa-102-'+Date.now()],env,timeout:60000});
 const errors=[],audioErrors=[],results=[];let p;
 const pass=s=>{console.log('PASS',s);results.push('PASS '+s);};
 try{
 p=await app.firstWindow();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.stack));p.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[audio]'))audioErrors.push(m.text());});
 await p.waitForLoadState('load');await p.waitForFunction(()=>document.getElementById('createOpen'));await p.waitForTimeout(400);
 await p.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);window.qaAudioContext=this;}createDynamicsCompressor(){const node=super.createDynamicsCompressor();const analyser=this.createAnalyser();analyser.fftSize=2048;node.connect(analyser);this.qaAnalyser=analyser;return node;}};});
 const hook=`
window.qa102={audio:gameAudio,steps:stepTracker,state:()=>({me,phase:state?.phase,nativeMouse,yaw,backend:mouseBackendLabel.textContent}),
 preview:async(id)=>{releaseGameControls();window.qaPreviewActive=true;const m=getMap(id);let qaScene=new THREE.Scene();qaScene.background=new THREE.Color(m.theme.sky);const world=createMapWorld(m);qaScene.add(world.root);qaScene.add(new THREE.HemisphereLight('#ffffff','#777777',2.2));const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(-20,60,10);qaScene.add(light);const qc=new THREE.PerspectiveCamera(58,960/640,.1,400);qc.position.set(m.w*.65,m.d*.72,m.d*.67);qc.lookAt(0,0,-m.d*.08);const qr=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});qr.setSize(960,640);qr.setPixelRatio(1);qr.outputColorSpace=THREE.SRGBColorSpace;qr.domElement.id='qaMapPreview';qr.domElement.style='position:fixed;inset:0;z-index:999999;width:960px;height:640px';document.body.append(qr.domElement);await new Promise(r=>setTimeout(r,600));qr.render(qaScene,qc);const image=qr.domElement.toDataURL('image/png');window.qaClearPreview=()=>{world.dispose();qr.dispose();qr.forceContextLoss();qr.domElement.remove();window.qaPreviewActive=false;};return {image,id,objects:world.root.children.length,structures:m.structures.length};}
};`;
 await p.route('**/game.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(ROOT+'/public/game.mjs','utf8').replace('  requestAnimationFrame(animate);','  requestAnimationFrame(animate);if(window.qaPreviewActive)return;')+hook}));
 await p.evaluate(async()=>{await window.voidlineSettings.invoke('save',{frameCap:30,renderScale:.5,renderResolution:'1280x720',shadows:'off',aa:'off',volume:.7});});
 await p.reload();await p.waitForFunction(()=>window.qa102);
 for(const id of ['terminal','courtyard','dockyard','foundry','oasis','depot','frost','bastion']){
  const info=await p.evaluate(id=>qa102.preview(id),id);assert.equal(info.structures,2);assert.ok(info.objects>5);fs.writeFileSync(ROOT+'/previews/1.0.2-'+id+'.png',Buffer.from(info.image.split(',')[1],'base64'));await p.evaluate(()=>qaClearPreview());
 }pass('All eight multilevel maps render in real Electron; screenshots saved; GPU worlds disposed');
 await p.locator('#createOpen').click();await p.locator('#botsA').selectOption('0');await p.locator('#botsB').selectOption('0');await p.locator('#createPlay').click();await p.locator('[data-team=T]').click();await p.waitForFunction(()=>qa102.state().me?.alive);
 await p.waitForFunction(()=>qa102.audio.stats().loaded===47);assert.deepEqual(audioErrors,[]);pass('All 47 local PCM samples decode successfully in actual Web Audio context');
 await p.waitForFunction(()=>qa102.audio.stats().state==='running');
 const started=await p.evaluate(()=>qa102.audio.play('shot',{weapon:'awp',cooldown:0}));assert.equal(started,true);await p.waitForTimeout(60);
 const rms=await p.evaluate(()=>{const a=qaAudioContext.qaAnalyser,x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);});assert.ok(rms>1e-5,'non-silent actual audio graph RMS '+rms);pass('Actual shot playback produces nonzero samples after compressor and gain (RMS '+rms.toFixed(5)+')');
 await p.evaluate(async()=>{const ids=(await import('/audio.mjs')).SOUND_IDS;for(const id of ids){qa102.audio.play(id,{cooldown:0,key:id});await new Promise(r=>setTimeout(r,35));}});await p.waitForTimeout(1800);assert.equal(await p.evaluate(()=>qa102.audio.stats().voices),0);pass('Every sample plays and every voice disconnects after completion');
 await p.evaluate(()=>{qa102.audio.play('explosion',{cooldown:0});window.voidlinePrefs.volume=0;qa102.audio.update();});assert.equal(await p.evaluate(()=>qa102.audio.stats().volume),0);await p.waitForTimeout(220);const muted=await p.evaluate(()=>{const a=qaAudioContext.qaAnalyser,x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);});assert.ok(muted<1e-4);await p.evaluate(()=>{window.voidlinePrefs.volume=.7;qa102.audio.update();});pass('Volume zero mutes an already-playing sound, not just future shots');
 assert.deepEqual(errors,[]);assert.equal(await p.locator('#fatal').isVisible(),false);pass('No JavaScript page errors or fatal overlays in map/audio checks');
 fs.writeFileSync(ROOT+'/tests/native-audio-maps-1.0.2.txt',results.join('\n')+'\n');
 }catch(e){if(p)await p.screenshot({path:'/data/qa102-failure.png'});console.error(e);throw e;}finally{await app.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
