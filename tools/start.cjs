const {spawn}=require('node:child_process'),path=require('node:path');
(async()=>{const root=path.resolve(__dirname,'..'),{linuxOzone}=await import('../linux-input.mjs');
 const args=process.argv.slice(2),explicit=args.some(a=>a==='--ozone-platform'||a.startsWith('--ozone-platform=')),backend=linuxOzone();
 const child=spawn(require('electron'),[...(!explicit&&backend?['--ozone-platform='+backend]:[]),root,...args],{stdio:'inherit',env:process.env});
 child.on('error',e=>{console.error(e.message);process.exit(1);});child.on('exit',code=>process.exit(code??1));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
})();
