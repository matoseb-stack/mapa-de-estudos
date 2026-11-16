// Logic Academy: notificações (pomodoro, lembretes) e cópia local dos DADOS pesados para abrir rápido.
// As páginas e o código NÃO ficam em cache (sempre a versão mais nova). Ficam guardados no aparelho:
// questões (questoes/*.json), simulados, imagens das questões e as figuras do ENEM (enem.dev).
// JSON: mostra a cópia guardada na hora e atualiza em segundo plano. Imagens: usa a cópia guardada.
const DADOS="la-dados-v1";
const ehDado=u=>u.origin===self.location.origin&&/\/(questoes|simulados)\//.test(u.pathname);
const ehImgExterna=u=>/(^|\.)enem\.dev$/.test(u.hostname)&&/\.(png|jpe?g|webp|gif|svg)$/i.test(u.pathname);
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;let u;try{u=new URL(r.url)}catch(x){return}
  if(!ehDado(u)&&!ehImgExterna(u))return;
  const json=/\.json$/i.test(u.pathname);
  e.respondWith(caches.open(DADOS).then(async c=>{
    const guardada=await c.match(r);
    const rede=fetch(r).then(res=>{if(res&&(res.ok||res.type==="opaque"))c.put(r,res.clone()).catch(()=>{});return res});
    if(guardada){if(json)e.waitUntil(rede.catch(()=>{}));return guardada}
    return rede}).catch(()=>fetch(r)));
});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("la-dados-")&&k!==DADOS).map(k=>caches.delete(k))))));
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
// tocar na notificação: abre o site na tela certa (ex.: ?abrir=pomodoro) ou foca a aba que já está aberta e avisa qual tela abrir
self.addEventListener("notificationclick",e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if("focus" in c){c.postMessage({tipo:"abrir",url});return c.focus()}}return self.clients.openWindow(url)}))});
