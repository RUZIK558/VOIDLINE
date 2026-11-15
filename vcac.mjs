import{readFile,realpath}from'node:fs/promises';import path from'node:path';import{createHash}from'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function integrityHash(name,bytes){if(name==='package.json'){const p=JSON.parse(bytes);return sha(JSON.stringify({name:p.name,version:p.version,type:p.type,main:p.main,dependencies:Object.fromEntries(Object.entries(p.dependencies||{}).sort())}));}return sha(bytes);}
export function createClientIntegrity({root,required=false,clock=()=>Date.now(),onEvent=()=>{}}){
 let result={name:'VCAC',state:required?'unavailable':'development',checkedAt:0,build:'',digest:'',checkedFiles:0,issues:[]},pending=null,lastAttempt=-Infinity;
 async function run(){if(!required){result={...result,state:'development',checkedAt:clock()};return status();}
  const issues=[];try{const manifest=JSON.parse(await readFile(path.join(root,'vcac-manifest.json'),'utf8'));
   if(manifest.format!==1||!Array.isArray(manifest.files)||manifest.files.length<10||manifest.files.length>5000)throw Error('invalid-manifest');
   const base=await realpath(root),seen=new Set();let checkedFiles=0;
   for(const f of manifest.files){const name=f.path;if(typeof name!=='string'||name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')||!/^([\w-]+\.(mjs|cjs|json)|public\/.+|node_modules\/(three|ws)\/.+|build\/native\/(linux-raw-input|linux-launcher\.sh))$/.test(name)||seen.has(name)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('invalid-manifest-path');seen.add(name);
    try{const file=path.join(root,name),resolved=await realpath(file);if(!resolved.startsWith(base+path.sep)&&!(base.endsWith('.asar')&&name.startsWith('build/native/')&&resolved.startsWith(base+'.unpacked'+path.sep)))throw Error('outside-application');if(integrityHash(name,await readFile(file))!==f.sha256)issues.push(name);}catch{issues.push(name);}checkedFiles++;
   }
   // A damaged/truncated manifest must never silently remove critical checks.
   for(const key of ['package.json','electron.cjs','preload.cjs','server.mjs','match.mjs','vsac.mjs','vcac.mjs','public/game.mjs','public/knife-controller.mjs','public/vcac-client.mjs'])if(!seen.has(key))throw Error('missing-critical-entry');
   result={name:'VCAC',state:issues.length?'modified':'clean',checkedAt:clock(),build:String(manifest.build).slice(0,32),digest:sha(JSON.stringify(manifest)),checkedFiles,issues:issues.slice(0,16)};
  }catch{result={...result,state:'unavailable',checkedAt:clock(),issues:['manifest-or-read-error']};}
  try{onEvent(status());}catch{}return status();
 }
 function status(){return {...result,issues:[...result.issues]};}
 return {status,check({force=false}={}){if(pending)return pending;if(!force&&clock()-lastAttempt<30000)return Promise.resolve(status());lastAttempt=clock();pending=run().finally(()=>pending=null);return pending;}};
}
