const { app, BrowserWindow, ipcMain, dialog, Menu, session, shell } = require("electron");
const path = require("node:path");
// Prefer XWayland on Linux when available: compositor-confined Wayland pointer
// motion must not be mistaken for an infinite relative stream.
if(process.platform==='linux'&&!app.commandLine.hasSwitch('ozone-platform')){
 const chosen=['x11','wayland'].includes(process.env.VOIDLINE_OZONE_PLATFORM)?process.env.VOIDLINE_OZONE_PLATFORM:process.env.DISPLAY?'x11':process.env.WAYLAND_DISPLAY?'wayland':null;
 if(chosen)app.commandLine.appendSwitch('ozone-platform',chosen);
}
const fs=require('node:fs');
const {createDiagnosticLogger}=require('./diagnostic-log.cjs');
const diagnostics=createDiagnosticLogger({directory:()=>app.getPath('userData'),version:()=>app.getVersion()});
const recordDiagnostic=(kind,message)=>diagnostics.record(kind,message);
recordDiagnostic('boot',JSON.stringify({platform:process.platform,arch:process.arch,electron:process.versions.electron}));

let server, win, social, display, linuxMouse, integrityTimer;
let openUI;
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    const {createClientIntegrity}=await import('./vcac.mjs');
    const integrity=createClientIntegrity({root:__dirname,required:app.isPackaged,onEvent:s=>recordDiagnostic('vcac',JSON.stringify(s))});
    const initialIntegrity=await integrity.check();
    if(app.isPackaged&&initialIntegrity.state!=='clean'){dialog.showErrorBox('VCAC: целостность игры','Файлы игры изменены или не могут быть проверены. Переустанови игру из доверенной сборки. Личные файлы не проверялись.');app.quit();return;}
    const { startServer } = await import("./server.mjs");
    const {isShellShortcut}=await import("./public/input-policy.mjs");
    const { createHostController } = await import("./host-controller.mjs");
    // Renderer is served on a private loopback listener. LAN is a separate listener
    // sharing the same match, opened only after an explicit action by the owner.
    server = await startServer({ port: 0, host: "127.0.0.1",onSecurity:e=>recordDiagnostic("vsac",JSON.stringify(e)) });
    const controller = createHostController(server);
    const { createPeerService } = await import("./p2p.mjs");
    social = await createPeerService({
      directory: path.join(app.getPath("userData"), "p2p"),
    });
    const { createProfileStore } = await import("./profile-store.mjs");
    const profile = createProfileStore(app.getPath("userData"));
    const { createSettingsStore } = await import("./settings-store.mjs");
    const settingsStore = createSettingsStore(app.getPath("userData"));
    const { createDisplayController } =
      await import("./display-controller.mjs");
    display = createDisplayController();
    const savedSettings = await settingsStore.load();
    const origin = `http://127.0.0.1:${server.port}`;
    // The private UI and LAN/P2P sockets must not go through OS/PAC/VPN HTTP proxies.
    // This is scoped to the game's own Chromium session, not the OS or other apps.
    const gameSession=session.fromPartition('persist:voidline-game');
    await gameSession.setProxy({mode:'direct'});
    await gameSession.closeAllConnections();
    recordDiagnostic('ui-proxy',await gameSession.resolveProxy(origin));
    win = new BrowserWindow({
      width: 1500,
      height: 940,
      minWidth: 1000,
      minHeight: 700,
      backgroundColor: "#0a1119",
      autoHideMenuBar: true,
      title: "VOIDLINE / Startup Recovery 1.0.9",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        session: gameSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    if(process.platform==='linux'){
      const {createLinuxInput}=await import('./linux-input.mjs');
      const executable=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/build/native/linux-raw-input'):path.join(__dirname,'build/native/linux-raw-input');
      linuxMouse=createLinuxInput({executable,ozone:app.commandLine.getSwitchValue('ozone-platform')||'x11',getWindow:()=>win,
        sendDelta:value=>{if(!win.isDestroyed())win.webContents.send('voidline:relative-mouse',value);},
        sendStatus:value=>{if(!win.isDestroyed())win.webContents.send('voidline:mouse-status',value);}});
      win.on('blur',()=>linuxMouse.stop());win.on('minimize',()=>linuxMouse.stop());win.on('closed',()=>linuxMouse.close());
    }
    const {loadLocalUI}=await import('./startup.mjs');
    const uiReady=async()=>{try{return !win.isDestroyed()&&new URL(win.webContents.getURL()).origin===origin&&await win.webContents.executeJavaScript('!!document.getElementById("createOpen")');}catch{return false;}};
    openUI=()=>loadLocalUI({origin,load:url=>win.loadURL(url),ready:uiReady,log:recordDiagnostic,isClosed:()=>shuttingDown||win.isDestroyed(),stop:()=>win.webContents.stop()});
    win.webContents.on('did-fail-load',(_e,code,description,url,main)=>{if(main)recordDiagnostic('navigation-failed',JSON.stringify({code,description,url}));});
    win.removeMenu();
    win.webContents.setIgnoreMenuShortcuts(true);
    win.webContents.setZoomFactor(1);
    win.webContents.setVisualZoomLevelLimits(1,1).catch(()=>{});
    let matchInputActive=false;
    ipcMain.handle('voidline:anti-cheat',event=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)return {state:'unavailable'};return integrity.status();});
    integrityTimer=setInterval(async()=>{const s=await integrity.check();if(app.isPackaged&&s.state!=='clean'){linuxMouse?.stop();win.webContents.send('voidline:integrity-failed');server?.close();recordDiagnostic('vcac-block','Local session stopped after integrity failure');await win.loadURL('about:blank');dialog.showErrorBox('VCAC: файлы игры изменены','Сессия остановлена. Переустанови игру из доверенной сборки. Это локальная проверка, не серверный бан.');app.quit();}},60000);integrityTimer.unref();
    const trustedInputEvent=event=>event.sender===win.webContents && event.senderFrame===win.webContents.mainFrame && event.senderFrame?.url?.startsWith(origin+"/");
    ipcMain.on("voidline:input-state",(event,value)=>{if(trustedInputEvent(event)&&typeof value==="boolean")matchInputActive=value;});
    ipcMain.handle('voidline:mouse-capture',async(event,value)=>{
      if(!trustedInputEvent(event)||typeof value!=='boolean')return {active:false,backend:'browser',reason:'Недопустимый запрос'};
      return linuxMouse?linuxMouse.capture(value):{active:false,backend:'browser',reason:'Системный Pointer Lock'};
    });
    win.webContents.on('did-start-loading',()=>linuxMouse?.stop());
    win.webContents.on("before-input-event",(event,input)=>{
      win.webContents.setIgnoreMenuShortcuts(true);
      // In a match, DOM handles prevention so Ctrl+W still reaches WASD.
      // Outside a match, block shell actions before Chromium processes them.
      if(!matchInputActive && isShellShortcut(input))event.preventDefault();
    });
    win.webContents.on("zoom-changed",event=>{event.preventDefault();win.webContents.setZoomFactor(1);});
    win.webContents.on("did-finish-load",()=>{matchInputActive=false;win.webContents.setZoomFactor(1);});
    win.webContents.on('render-process-gone',async(_event,details)=>{
      if(shuttingDown||details.reason==='clean-exit')return;
      linuxMouse?.stop();
      recordDiagnostic('renderer-gone',JSON.stringify(details));
      const r=await dialog.showMessageBox(win,{type:'error',title:'VOIDLINE: сбой графики',message:'Игровой процесс завершился: '+details.reason,detail:'Журнал сохранён в diagnostics.log в папке данных приложения. Можно перезапустить игру на низких настройках.',buttons:['Перезапустить · низкая графика','Закрыть'],defaultId:0,cancelId:1});
      if(r.response===0&&!win.isDestroyed()){const old=await settingsStore.load();await settingsStore.save({...old,frameCap:60,renderScale:.65,renderResolution:'native',shadows:'off',aa:'fxaa'});await openUI();}else app.quit();
    });
    let diagnosticCount=0;const logReset=setInterval(()=>diagnosticCount=0,60000);logReset.unref();
    ipcMain.handle('voidline:diagnostic',(event,entry)=>{
      if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)return;
      if(++diagnosticCount>20)return;
      recordDiagnostic('client',JSON.stringify(entry).slice(0,4000));
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    ipcMain.handle("voidline:host", (event, command, args) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== origin
      )
        return { ok: false, error: "Доступ запрещён" };
      return controller.invoke(command, args);
    });
    ipcMain.handle("voidline:social", (event, command, args) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== origin
      )
        return { ok: false, error: "Доступ запрещён" };
      return social.invoke(command, args);
    });
    ipcMain.handle("voidline:profile", async (event, command, value) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== origin
      )
        return { ok: false, error: "Доступ запрещён" };
      try {
        if (command === "load")
          return { ok: true, result: await profile.load() };
        if (command === "save")
          return { ok: true, result: await profile.save(value) };
        return { ok: false, error: "Команда не разрешена" };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    ipcMain.handle("voidline:settings", async (event, command, value) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== origin
      )
        return { ok: false, error: "Доступ запрещён" };
      try {
        if (command === "load")
          return { ok: true, result: await settingsStore.load() };
        if (command === "save")
          return { ok: true, result: await settingsStore.save(value) };
        if (command === "window") {
          if (!["windowed", "borderless"].includes(value))
            throw Error("Режим окна недоступен");
          win.setFullScreen(value === "borderless");
          return { ok: true, result: value };
        }
        if (command === "display-info")
          return { ok: true, result: await display.info() };
        if (command === "display-apply")
          return { ok: true, result: await display.apply(value) };
        if (command === "display-confirm")
          return { ok: true, result: await display.confirm() };
        if (command === "display-revert") {
          await display.revert();
          return { ok: true };
        }
        throw Error("Команда не разрешена");
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    if (savedSettings.windowMode === "borderless") win.setFullScreen(true);
    await openUI();
  } catch (error) {
    recordDiagnostic('startup-failed',error.stack||error.message);
    if(!win||win.isDestroyed()){dialog.showErrorBox('VOIDLINE: ошибка запуска',error.message);app.quit();return;}
    let errorMessage=error.message;
    while(!shuttingDown&&!win.isDestroyed()){
      const choice=await dialog.showMessageBox(win,{type:'error',title:'VOIDLINE: ошибка загрузки интерфейса',message:'Не удалось открыть игровой интерфейс.',detail:errorMessage+'\n\n'+(diagnostics.path()?'Журнал: '+diagnostics.path():'Журнал находится в памяти; кнопка «Показать журнал» позволит сохранить его.')+'\nНастройки и инвентарь не удалены.',buttons:['Повторить','Показать журнал','Закрыть'],defaultId:0,cancelId:2});
      if(choice.response===1){
        recordDiagnostic('diagnostics-request','Startup recovery log requested');
        if(diagnostics.path()){const error=await shell.openPath(diagnostics.path());if(error)recordDiagnostic('diagnostics-open-failed',error);}
        else {const selected=await dialog.showSaveDialog(win,{title:'Сохранить журнал VOIDLINE',defaultPath:'VOIDLINE-diagnostics.log'});if(!selected.canceled&&selected.filePath){try{diagnostics.exportTo(selected.filePath);}catch(e){dialog.showErrorBox('Не удалось сохранить журнал',e.message);}}}
        continue;
      }
      if(choice.response!==0||!openUI){app.quit();break;}
      try{await openUI();break;}catch(e){errorMessage=e.message;recordDiagnostic('startup-retry-failed',errorMessage);}
    }
  }
});
app.on('child-process-gone',(_event,details)=>recordDiagnostic('child-process-gone',JSON.stringify(details)));
app.on("window-all-closed", () => app.quit());
let shuttingDown = false;
app.on("before-quit", async (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;
  clearInterval(integrityTimer);
  linuxMouse?.close();
  server?.close();
  try {
    await display?.close();
    await social?.close();
  } finally {
    app.quit();
  }
});
