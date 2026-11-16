// Logic Academy: só para mostrar notificações do pomodoro (não guarda páginas em cache)
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
// tocar na notificação: abre o site na tela certa (ex.: ?abrir=pomodoro) ou foca a aba que já está aberta e avisa qual tela abrir
self.addEventListener("notificationclick",e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if("focus" in c){c.postMessage({tipo:"abrir",url});return c.focus()}}return self.clients.openWindow(url)}))});
