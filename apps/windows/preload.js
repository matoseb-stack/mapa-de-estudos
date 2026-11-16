// Ponte com o site: avisa o programa quando a chamada começa e termina.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("logicApp", {
  plataforma: "windows",
  chamada: (ativa, titulo) => ipcRenderer.send("chamada", !!ativa, String(titulo || ""))
});
