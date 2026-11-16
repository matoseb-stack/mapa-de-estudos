// Ponte com o site (window.logicApp): chamada, widget, lembretes agendados, versão e links.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("logicApp", {
  plataforma: "windows",
  versao: () => ipcRenderer.sendSync("versao"),
  chamada: (ativa, titulo) => ipcRenderer.send("chamada", !!ativa, String(titulo || "")),
  widget: dados => ipcRenderer.send("widget", JSON.parse(JSON.stringify(dados || {}))),
  agendar: lista => ipcRenderer.send("agendar", JSON.parse(JSON.stringify(lista || []))),
  abrirLink: url => ipcRenderer.send("abrir-link", String(url || ""))
});
