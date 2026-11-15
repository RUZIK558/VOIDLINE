package studio.voidline.arena;
import android.app.Activity;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.graphics.Color;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;

// Bundled WebGL client. The local HTTP server serves assets only, not a match.
public final class MainActivity extends Activity {
 private PermissionRequest pendingMic;private WebView web; private ServerSocket server; private ExecutorService pool=Executors.newFixedThreadPool(8);private volatile boolean running=true;
 public void onCreate(Bundle b){super.onCreate(b);getWindow().setFlags(1024,1024);getWindow().addFlags(128);getWindow().getDecorView().setSystemUiVisibility(5894);
  web=new WebView(this);web.setBackgroundColor(Color.rgb(12,24,31));setContentView(web);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMediaPlaybackRequiresUserGesture(true);s.setSupportZoom(false);
  web.addJavascriptInterface(new Object(){
   @JavascriptInterface public String load(){return getSharedPreferences("voidline",0).getString("settings","{\"frameCap\":60,\"renderScale\":0.75,\"shadows\":\"low\"}");}
   @JavascriptInterface public void save(String value){if(value!=null&&value.length()<65536)getSharedPreferences("voidline",0).edit().putString("settings",value).apply();}
   @JavascriptInterface public String loadProfile(){return getSharedPreferences("voidline",0).getString("profile","{}");}
   @JavascriptInterface public void saveProfile(String value){if(value!=null&&value.length()<8192)getSharedPreferences("voidline",0).edit().putString("profile",value).apply();}
  },"AndroidSettings");s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){
   public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){
    android.util.Log.e("VOIDLINE","Renderer terminated, crashed="+detail.didCrash());
    ((ViewGroup)v.getParent()).removeView(v);v.destroy();web=null;
    new android.app.AlertDialog.Builder(MainActivity.this).setTitle("VOIDLINE: сбой графики").setMessage("Графический процесс завершился. Перезапустить игру с пониженными настройками?").setPositiveButton("Перезапустить",(d,w)->{try{org.json.JSONObject pref=new org.json.JSONObject(getSharedPreferences("voidline",0).getString("settings","{}"));pref.put("frameCap",60);pref.put("renderScale",0.65);pref.put("renderResolution","native");pref.put("shadows","off");pref.put("aa","fxaa");getSharedPreferences("voidline",0).edit().putString("settings",pref.toString()).apply();}catch(Exception ignored){}recreate();}).setNegativeButton("Закрыть",(d,w)->finish()).setCancelable(false).show();return true;
   }
   public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith("http://127.0.0.1:"+server.getLocalPort()+"/");}});
  web.setWebChromeClient(new WebChromeClient(){
   public void onPermissionRequest(final PermissionRequest req){runOnUiThread(()->{
    if(!req.getOrigin().toString().equals("http://127.0.0.1:"+server.getLocalPort()) && !req.getOrigin().toString().equals("http://127.0.0.1:"+server.getLocalPort()+"/")){req.deny();return;}
    boolean audio=false;for(String r:req.getResources())if(r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE))audio=true;
    if(!audio){req.deny();return;}if(checkSelfPermission("android.permission.RECORD_AUDIO")==android.content.pm.PackageManager.PERMISSION_GRANTED)req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
    else{pendingMic=req;requestPermissions(new String[]{"android.permission.RECORD_AUDIO"},41);}
   });}
   public void onPermissionRequestCanceled(PermissionRequest req){if(pendingMic==req)pendingMic=null;}
  });
  try{try{server=new ServerSocket(getSharedPreferences("voidline",0).getInt("assetPort",0),32,InetAddress.getByName("127.0.0.1"));}catch(IOException busy){server=new ServerSocket(0,32,InetAddress.getByName("127.0.0.1"));}getSharedPreferences("voidline",0).edit().putInt("assetPort",server.getLocalPort()).apply();new Thread(()->{while(running)try{Socket sock=server.accept();pool.execute(()->serve(sock));}catch(Exception e){if(running)android.util.Log.e("VOIDLINE","Local server",e);}},"VOIDLINE-assets").start();web.loadUrl("http://127.0.0.1:"+server.getLocalPort()+"/?android=1");}
  catch(Exception e){android.widget.TextView msg=new android.widget.TextView(this);msg.setText("Unable to start bundled client: "+e.getMessage());setContentView(msg);}
 }
 private void serve(Socket socket){try(Socket c=socket){c.setSoTimeout(5000);BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream(),"US-ASCII"));String first=r.readLine();if(first==null)return;String[] fields=first.split(" ");String path=fields.length>1?fields[1].split("\\?")[0]:"/";String h;while((h=r.readLine())!=null&&!h.isEmpty()){}if(path.equals("/"))path="/index.html";path=URLDecoder.decode(path,"UTF-8");if(path.contains("..")||path.contains("\\")||!path.startsWith("/"))throw new IOException("Path");
   byte[] bytes;try(InputStream in=getAssets().open("web"+path);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1)out.write(b,0,n);bytes=out.toByteArray();}
   String type=path.endsWith(".html")?"text/html; charset=utf-8":path.endsWith(".js")||path.endsWith(".mjs")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".jpg")?"image/jpeg":path.endsWith(".png")?"image/png":path.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
   OutputStream out=c.getOutputStream();out.write(("HTTP/1.1 200 OK\r\nContent-Type: "+type+"\r\nContent-Length: "+bytes.length+"\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:;\r\n\r\n").getBytes("US-ASCII"));out.write(bytes);out.flush();
  }catch(Exception e){android.util.Log.d("VOIDLINE","Asset request: "+e.getMessage());}}
 public void onRequestPermissionsResult(int code,String[] perms,int[] grants){super.onRequestPermissionsResult(code,perms,grants);if(code==41&&pendingMic!=null){if(grants.length>0&&grants[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else pendingMic.deny();pendingMic=null;}}
 public void onBackPressed(){if(web==null){finish();return;}web.evaluateJavascript("document.getElementById('pause').hidden=false;document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));",null);}
 protected void onPause(){super.onPause();if(web!=null){web.evaluateJavascript("window.dispatchEvent(new Event('blur'))",null);web.onPause();}}
 protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 protected void onDestroy(){running=false;try{if(server!=null)server.close();}catch(Exception ignored){}pool.shutdownNow();if(web!=null)web.destroy();super.onDestroy();}
}
