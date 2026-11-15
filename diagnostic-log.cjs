const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
// Keep a bounded in-memory copy even if the profile directory is not writable.
function createDiagnosticLogger({directory,version=()=>'',fallbackDirectory=()=>path.join(os.tmpdir(),'VOIDLINE-diagnostics'),io=fs}={}){
 const entries=[];let selected=null,lastFailure='';
 function persist(){for(const getter of[directory,fallbackDirectory]){try{const dir=typeof getter==='function'?getter():getter;if(!dir)continue;io.mkdirSync(dir,{recursive:true});const file=path.join(dir,'diagnostics.log');if(io.existsSync(file)&&io.statSync(file).size>1024*1024){io.rmSync(file+'.previous',{force:true});io.renameSync(file,file+'.previous');}const rows=selected===file?[entries.at(-1)]:entries;io.appendFileSync(file,rows.join('\n')+'\n',{encoding:'utf8',mode:0o600});selected=file;return file;}catch(e){lastFailure=e.code||e.message;}}return null;}
 function record(kind,message){entries.push(JSON.stringify({time:new Date().toISOString(),version:typeof version==='function'?version():version,kind,message:String(message).slice(0,4000)}));if(entries.length>160)entries.shift();return persist();}
 return {record,path:()=>selected,summary:()=>entries.join('\n')+'\n',lastFailure:()=>lastFailure,exportTo(file){io.writeFileSync(file,entries.join('\n')+'\n',{encoding:'utf8',mode:0o600});return file;}};
}
module.exports={createDiagnosticLogger};
