const ROOT=require('node:path').resolve(__dirname,'..'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const {startServer}=await import('../server.mjs'),server=await startServer({port:3190,host:'127.0.0.1'});const b=await chromium.launch({executablePath:require('child_process').execSync('which chromium').toString().trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.route('**/game.mjs',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto('http://127.0.0.1:3190');
const result=await p.evaluate(async()=>{
 const T=await import('/vendor/three.module.js'),{buildViewModel,buildOperator}=await import('/models.mjs');
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new T.Scene();scene.background=new T.Color('#172730');scene.add(new T.HemisphereLight('#e7f4ff','#534636',3));const key=new T.DirectionalLight('#f8fbff',4);key.position.set(-2,4,2);scene.add(key);const rim=new T.DirectionalLight('#5fd2e4',2);rim.position.set(2,1,-1);scene.add(rim);
 const camera=new T.PerspectiveCamera(65,1.6,.01,20);document.body.replaceChildren(renderer.domElement);
 const label=document.createElement('div');label.style='position:fixed;top:32px;left:36px;font:24px Arial;color:white;letter-spacing:3px';document.body.append(label);
 const v={};for(const id of ['butterfly','karambit','m9']){v[id]=buildViewModel(id);scene.add(v[id]);}
 await new Promise(r=>setTimeout(r,350));
 window.drawKnife=(id,action='idle',time=0)=>{for(const [k,m]of Object.entries(v)){m.visible=k===id;for(const a of Object.values(m.userData.animations.actions))a.stop();}const m=v[id];if(action!=='idle'){m.userData.animations.play(action);m.userData.animations.mixer.update(time);}renderer.render(scene,camera);label.textContent=id.toUpperCase()+' / '+action.toUpperCase();return m.userData.weapon.rotation.toArray();};
 const op=buildOperator();let bone;op.traverse(o=>{if(o.name==='Spine')bone=o;});
 for(let i=0;i<3600;i++)op.userData.update(1/60,{speed:3,pitch:-.35,reload:true});
 const spine=bone.rotation.x;for(let i=0;i<60;i++)op.userData.update(1/60,{speed:3,pitch:0,reload:false});const reset=bone.rotation.x;
 return {spine,reset,clips:Object.fromEntries(Object.entries(v).map(([id,m])=>[id,Object.keys(m.userData.animations.actions)]))};
});assert.ok(Math.abs(result.spine)<.5,JSON.stringify(result));assert.ok(Math.abs(result.reset)<.05,JSON.stringify(result));console.log('SKELETON 3600 frames: no accumulated tilt, returns neutral',JSON.stringify(result));
for(const id of ['butterfly','karambit','m9'])for(const [action,time]of [['idle',0],['equip',.35],['inspect',.7],['fire',.15],['heavy',.45]]){await p.evaluate(([id,a,t])=>drawKnife(id,a,t),[id,action,time]);await p.screenshot({path:ROOT+`/previews/09-${id}-${action}.png`});}
assert.deepEqual(errors,[]);console.log('15 knife frames rendered. No page errors.');await p.close();}finally{await b.close();server.close();}process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});
