// Logic Academy: notificações (pomodoro, lembretes) e funcionamento sem internet.
// - Site (página e código): com internet pega sempre a versão nova (espera até 4 s); sem internet usa a cópia guardada.
//   Arquivos com versão no endereço (?v=…) e as bibliotecas externas (Firebase, leitor de PDF, fontes) ficam guardados.
// - Dados pesados (questões, simulados, imagens das questões e figuras do ENEM): usa a cópia guardada na hora;
//   os JSON são atualizados em segundo plano para a próxima vez.
// - Firestore, login e IA NÃO passam por aqui (a nuvem tem a própria cópia offline e sincroniza sozinha).
const SITE = "la-site-v1", DADOS = "la-dados-v1";
const mesmo = u => u.origin === self.location.origin;
const ehDado = u => mesmo(u) && /\/(questoes|simulados)\//.test(u.pathname);
const ehImgExterna = u => /(^|\.)enem\.dev$/.test(u.hostname) && /\.(png|jpe?g|webp|gif|svg)$/i.test(u.pathname);
const ehBiblioteca = u => (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) ||
  u.hostname === "cdnjs.cloudflare.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
const ehCodigo = u => mesmo(u) && !/\/(questoes|simulados|apps)\//.test(u.pathname) && !/\/sw\.js$/.test(u.pathname);
const paginaKey = () => new URL("./", self.registration.scope).href;

async function guardar(cache, chave, res) { if (res && (res.ok || res.type === "opaque")) await cache.put(chave, res.clone()).catch(() => {}); return res; }
function comLimite(p, ms) { return new Promise((ok, no) => { const t = setTimeout(() => no(new Error("demorou")), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); no(e); }); }); }

self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  let u; try { u = new URL(r.url); } catch (x) { return; }
  // páginas do site (abrir o app, ?abrir=…): rede primeiro, cópia guardada se estiver sem internet
  if (r.mode === "navigate" && mesmo(u)) {
    e.respondWith(caches.open(SITE).then(async c => {
      try { const res = await comLimite(fetch(r), 4000); if (res && res.ok) { await guardar(c, paginaKey(), res); } return res; }
      catch (x) { return (await c.match(paginaKey())) || (await c.match(r)) || Response.error(); }
    }));
    return;
  }
  // dados pesados: cópia guardada na hora (JSON atualiza em segundo plano)
  if (ehDado(u) || ehImgExterna(u)) {
    const json = /\.json$/i.test(u.pathname);
    e.respondWith(caches.open(DADOS).then(async c => {
      const g = await c.match(r);
      const rede = fetch(r).then(res => guardar(c, r, res));
      if (g) { if (json) e.waitUntil(rede.catch(() => {})); return g; }
      return rede;
    }).catch(() => fetch(r)));
    return;
  }
  // bibliotecas externas e arquivos com versão no endereço: cópia guardada; o resto do código: rede primeiro
  if (ehBiblioteca(u) || ehCodigo(u)) {
    const fixo = ehBiblioteca(u) || u.search.includes("v=");
    e.respondWith(caches.open(SITE).then(async c => {
      if (fixo) { const g = await c.match(r); if (g) return g; return fetch(r).then(res => guardar(c, r, res)); }
      try { return await guardar(c, r, await comLimite(fetch(r), 4000)); }
      catch (x) { return (await c.match(r)) || Response.error(); }
    }));
  }
});

// a página manda a lista do que ela carregou (para já funcionar sem internet na próxima vez)
self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.tipo === "guardarSite" && Array.isArray(d.urls)) {
    e.waitUntil(caches.open(SITE).then(c => Promise.all(d.urls.map(async url => {
      try {
        const u = new URL(url); if (!(ehBiblioteca(u) || ehCodigo(u))) return;
        if (await c.match(url)) return;
        const res = await fetch(url, ehBiblioteca(u) ? { mode: "no-cors" } : {}); await guardar(c, url, res);
      } catch (x) {}
    })).then(() => fetch(paginaKey()).then(res => guardar(c, paginaKey(), res)).catch(() => {}))));
  }
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith("la-dados-") && k !== DADOS) || (k.startsWith("la-site-") && k !== SITE)).map(k => caches.delete(k))))
])));
// tocar na notificação: abre o site na tela certa (ex.: ?abrir=pomodoro) ou foca a aba que já está aberta e avisa qual tela abrir
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) { c.postMessage({ tipo: "abrir", url }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
