const {execFileSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/native/linux-raw-input');
if(process.platform!=='linux'){if(!fs.existsSync(out))throw Error('Build the Linux raw input helper on Linux before packaging an AppImage.');process.exit(0);}
fs.mkdirSync(path.dirname(out),{recursive:true});
execFileSync('gcc',['-std=c11','-O2','-Wall','-Wextra','-Werror','-fPIE','-pie','-Wl,-z,relro,-z,now','-o',out,path.join(root,'native/linux-raw-input.c'),'-lX11','-lXi'],{stdio:'inherit'});
fs.chmodSync(out,0o755);console.log('Built Linux XInput2 relative-input helper');
