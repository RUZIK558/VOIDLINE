const fs=require('fs'),assert=require('assert/strict'),path=require('path');
(async()=>{const asar=await import('@electron/asar'),results=[];
for(const target of ['linux-unpacked','win-unpacked']){
 const file='dist/'+target+'/resources/app.asar';assert.ok(fs.existsSync(file));
 const files=['public/maps.mjs','public/map-world.mjs','public/shared.mjs','public/utilities.mjs','public/navigation.mjs','public/audio.mjs','public/game.mjs','public/utility-fx.mjs','match.mjs','server.mjs','linux-input.mjs','electron.cjs','preload.cjs','public/assets/audio/manifest.json','RELEASE-1.0.2-RU.md'];
 const ids=JSON.parse(fs.readFileSync('public/assets/audio/manifest.json')).sounds;for(const id of Object.keys(ids))files.push('public/assets/audio/'+id+'.wav');
 for(const f of files)assert.ok(fs.readFileSync(f).equals(asar.extractFile(file,f)),target+': '+f);
 assert.equal(JSON.parse(asar.extractFile(file,'package.json')).version,'1.0.2');
 const listed=asar.listPackage(file);assert.ok(!listed.some(f=>f.includes('/tools/qa-')));assert.ok(!asar.extractFile(file,'public/game.mjs').toString().includes('window.qa102'));
 results.push(`${target}: 62 updated files including all 47 samples match source; version 1.0.2; no QA hooks included`);
}
const unpacked='dist/linux-unpacked/resources/app.asar.unpacked/build/native/';
for(const f of ['linux-raw-input','linux-launcher.sh'])assert.ok(fs.readFileSync(unpacked+f).equals(fs.readFileSync('build/native/'+f)));
assert.ok(fs.readFileSync('dist/linux-unpacked/voidline-arena').equals(fs.readFileSync('build/native/linux-launcher.sh')));
results.push('Linux entry-point wrapper and unpacked XInput2 helper match source');
fs.writeFileSync('tests/package-integrity-1.0.2.txt',results.join('\n')+'\n');console.log(results.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});
