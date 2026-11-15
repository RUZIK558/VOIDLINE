// Optional native settings bridge. Exposed only to the bundled Android origin.
if (window.AndroidSettings) {
 window.voidlineProfile={load:async()=>{try{return {ok:true,result:JSON.parse(AndroidSettings.loadProfile())};}catch(e){return {ok:false,error:e.message};}},save:async(value)=>{try{AndroidSettings.saveProfile(JSON.stringify(value));return {ok:true,result:value};}catch(e){return {ok:false,error:e.message};}}};
 window.voidlineSettings = {invoke:async(command,value)=>{
  try{
   if(command==='load')return {ok:true,result:JSON.parse(AndroidSettings.load())};
   if(command==='save'){AndroidSettings.save(JSON.stringify(value));return {ok:true,result:value};}
   if(command==='window')return {ok:false,error:'Android работает в полноэкранном альбомном режиме.'};
   if(command==='display-info')return {ok:true,result:{supported:false,reason:'Частота экрана управляется настройками Android.'}};
   return {ok:false,error:'Эта системная функция недоступна на Android.'};
  }catch(e){return {ok:false,error:e.message};}
 }};
}
