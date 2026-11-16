const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("widget", {
  aoReceber: f => ipcRenderer.on("dados", (_e, d) => f(d)),
  abrir: () => ipcRenderer.send("widget-abrir"),
  fechar: () => ipcRenderer.send("widget-fechar")
});
