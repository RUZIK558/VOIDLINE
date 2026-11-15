const ROOT=require('node:path').resolve(__dirname,'..'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const {startServer}=await import('../server.mjs'),s=await startServer({port:3189,host:'127.0.0.1'});
 const b=await chromium.launch({executablePath:require('child_process').execSync('which chromium').toString().trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{const p=await b.newPage({viewport:{width:1200,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.route('**/game.mjs',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto('http://127.0.0.1:3189',{waitUntil:'domcontentloaded'});
 await p.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{createMapWorld}=await import('/map-world.mjs'),{MAPS}=await import('/maps.mjs');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1.5,.1,180);scene.add(new T.HemisphereLight('#e1f0ff','#5c5546',2.2));const sun=new T.DirectionalLight('#fff2d4',3);sun.position.set(-20,40,15);scene.add(sun);camera.position.set(35,47,55);camera.lookAt(0,0,0);
  document.body.replaceChildren(renderer.domElement);const label=document.createElement('div');label.style='position:fixed;top:28px;left:32px;background:#10232be8;color:#eaf5f7;padding:16px 24px;font:24px Arial;border-left:3px solid #98eee5';document.body.append(label);
  let world;window.drawMap=async id=>{if(world)world.dispose();world=createMapWorld(MAPS[id]);scene.add(world.root);scene.background=new T.Color(MAPS[id].theme.sky);sun.color.set(MAPS[id].theme.sun);label.textContent=MAPS[id].name+' / '+MAPS[id].subtitle;await new Promise(r=>setTimeout(r,250));renderer.render(scene,camera);return {...renderer.info.memory,calls:renderer.info.render.calls};};window.mapIds=Object.keys(MAPS);
 });
 const ids=await p.evaluate(()=>mapIds),stats={};for(const id of ids){stats[id]=await p.evaluate(id=>drawMap(id),id);await p.screenshot({path:ROOT+'/previews/08-map-'+id+'.png'});}
 // Changing maps must not retain all previous GPU resources.
 const warm=await p.evaluate(()=>drawMap('terminal'));for(let i=0;i<16;i++)await p.evaluate(id=>drawMap(id),ids[i%8]);const end=await p.evaluate(()=>drawMap('terminal'));assert.ok(end.geometries<=warm.geometries+2,JSON.stringify({warm,end}));assert.ok(end.textures<=warm.textures+2,JSON.stringify({warm,end}));
 console.log('ALL MAP RENDERS',JSON.stringify(stats));console.log('24 MAP SWITCHES: bounded GPU memory',JSON.stringify({warm,end}));assert.deepEqual(errors,[]);
 await p.close();
 }finally{await b.close();s.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
