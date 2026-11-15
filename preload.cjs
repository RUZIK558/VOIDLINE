const { contextBridge, ipcRenderer } = require("electron");
const commands = new Set([
  "status",
  "create",
  "lan-open",
  "lan-close",
  "bot-add",
  "bot-remove",
  "bot-clear",
  "restart",
  "stop",
]);
contextBridge.exposeInMainWorld(
  "voidlineHost",
  Object.freeze({
    invoke: (command, args = {}) =>
      commands.has(command)
        ? ipcRenderer.invoke("voidline:host", command, args)
        : Promise.resolve({ ok: false, error: "Команда не разрешена" }),
  }),
);

const socialCommands = new Set([
  "scan",
  "status",
  "open",
  "close",
  "name",
  "add",
  "connect",
  "disconnect",
  "send",
  "remove",
]);
contextBridge.exposeInMainWorld(
  "voidlineSocial",
  Object.freeze({
    invoke: (command, args = {}) =>
      socialCommands.has(command)
        ? ipcRenderer.invoke("voidline:social", command, args)
        : Promise.resolve({ ok: false, error: "Команда не разрешена" }),
  }),
);

contextBridge.exposeInMainWorld(
  "voidlineProfile",
  Object.freeze({
    load: () => ipcRenderer.invoke("voidline:profile", "load"),
    save: (value) => ipcRenderer.invoke("voidline:profile", "save", value),
  }),
);

const settingsCommands = new Set([
  "load",
  "save",
  "window",
  "display-info",
  "display-apply",
  "display-confirm",
  "display-revert",
]);
contextBridge.exposeInMainWorld(
  "voidlineSettings",
  Object.freeze({
    invoke: (command, value) =>
      settingsCommands.has(command)
        ? ipcRenderer.invoke("voidline:settings", command, value)
        : Promise.resolve({ ok: false, error: "Команда не разрешена" }),
  }),
);

contextBridge.exposeInMainWorld('voidlineDiagnostics',Object.freeze({record:entry=>ipcRenderer.invoke('voidline:diagnostic',entry)}));

// Boolean state only; no arbitrary key injection or native cursor control exposed.
contextBridge.exposeInMainWorld("voidlineInput",Object.freeze({setActive:value=>{if(typeof value==="boolean")ipcRenderer.send("voidline:input-state",value);}}));

if(process.platform==='linux')contextBridge.exposeInMainWorld('voidlineMouse',Object.freeze({
 capture:value=>typeof value==='boolean'?ipcRenderer.invoke('voidline:mouse-capture',value):Promise.resolve({active:false,backend:'browser'}),
 onDelta:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('voidline:relative-mouse',listener);return ()=>ipcRenderer.removeListener('voidline:relative-mouse',listener);},
 onStatus:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('voidline:mouse-status',listener);return ()=>ipcRenderer.removeListener('voidline:mouse-status',listener);}
}));

// Read-only integrity status; no file paths or arbitrary commands cross IPC.
contextBridge.exposeInMainWorld('voidlineAntiCheat',Object.freeze({status:()=>ipcRenderer.invoke('voidline:anti-cheat')}));
