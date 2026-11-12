/* FloatingTimer — tempo de estudo flutuando por cima do site (pomodoro e cronômetro).
   - Quadro flutuante (dá para arrastar): tempo grande, anel de progresso no pomodoro, pausar/continuar,
     janela por cima de outros apps (Picture-in-Picture), notificação do sistema e abrir o relógio.
   - O ✕ fecha o quadro, mas fica uma faixinha no alto da tela com os minutos; tocar nela reabre o quadro.
   - Notificação do sistema "o app está aberto" (aparece sozinha ao fechar o quadro ou sair do app; o 🔔 desliga):
     mostra os minutos estudados, ou o que falta no pomodoro, e a ligação em andamento.
   Integração: o app chama LAComp.FloatingTimer.atualizar(estado) a cada tique, com
   estado = { ativo, tipo:"pomodoro"|"cronometro", texto:"12:34", rotulo, rodando, naTela, alvoSel, sessao, pct, resumo }
   e registra as ações com LAComp.FloatingTimer.configurar({ abrir(tipo), alternar(tipo) }). */
(function () {
  "use strict";
  let acoes = { abrir() {}, alternar() {} };
  let box = null, pill = null, ultimo = null, observador = null, relogioVisivel = true, relogioAlvo = null;
  const PREF = (() => { try { return JSON.parse(localStorage.getItem("la_ftimer") || "{}"); } catch (e) { return {}; } })();
  const salvar = () => { try { localStorage.setItem("la_ftimer", JSON.stringify(PREF)); } catch (e) {} };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const I = (d, f) => `<svg viewBox="0 0 24 24" width="18" height="18" ${f ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${d}</svg>`;
  const ICON = {
    play: I('<path d="M8 5v14l11-7z"/>', 1), pause: I('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>', 1),
    abrir: I('<path d="M14 4h6v6M20 4l-8 8M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>'),
    pip: I('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor"/>'),
    sino: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    fechar: I('<path d="M18 6L6 18M6 6l12 12"/>')
  };
  const fechadoPara = () => PREF.fechado || "";
  const chaveDe = e => e.tipo + ":" + (e.sessao || "");

  /* ---------- quadro flutuante ---------- */
  function criar() {
    box = document.createElement("div"); box.className = "ft2"; box.hidden = true; box.setAttribute("role", "status"); box.setAttribute("aria-live", "off");
    box.innerHTML = `<div class="ft2-anel"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="ft2-trilho"/><circle cx="50" cy="50" r="44" class="ft2-prog"/></svg><span class="ft2-ponto"></span></div>
      <div class="ft2-txt"><small class="ft2-r"></small><b class="ft2-t">00:00</b><span class="ft2-m"></span></div>
      <div class="ft2-bs">
        <button type="button" class="ft2-b ft2-play" data-ft="alternar" aria-label="Pausar">${ICON.pause}</button>
        <button type="button" class="ft2-b" data-ft="pip" aria-label="Janela por cima de outros apps" title="Janela por cima de outros apps">${ICON.pip}</button>
        <button type="button" class="ft2-b" data-ft="notif" aria-label="Notificação com os minutos" title="Notificação com os minutos">${ICON.sino}</button>
        <button type="button" class="ft2-b" data-ft="abrir" aria-label="Abrir o relógio" title="Abrir o relógio">${ICON.abrir}</button>
      </div>
      <button type="button" class="ft2-x" data-ft="fechar" aria-label="Fechar o quadro (fica uma faixa no alto da tela)" title="Fechar">${ICON.fechar}</button>`;
    document.body.appendChild(box);
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-ft]"); if (!b || !ultimo || box.dataset.arrastou === "1") return;
      const a = b.dataset.ft;
      if (a === "fechar") { PREF.fechado = chaveDe(ultimo); salvar(); atualizar(ultimo);
        if (ehIOS && !("Notification" in window) && !PREF.dicaInstalar) { PREF.dicaInstalar = 1; salvar(); avisar("No iPhone, as notificações só aparecem com o app na Tela de Início: toque em Compartilhar › Adicionar à Tela de Início. Para ver o tempo fora do Safari, use o botão da janela por cima."); }
        if (!PREF.semNotif) pedirNotificacao().then(() => { ultimaNotif = ""; notificar(); }); return; }
      if (a === "alternar") { acoes.alternar(ultimo.tipo); return; }
      if (a === "pip") { abrirPip(); return; }
      if (a === "notif") { alternarNotif(); return; }
      acoes.abrir(ultimo.tipo);
    });
    // arrastar pelo corpo do quadro
    let arr = null;
    box.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      const r = box.getBoundingClientRect(); arr = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, mexeu: false };
      try { box.setPointerCapture(e.pointerId); } catch (er) {}
    });
    box.addEventListener("pointermove", e => {
      if (!arr || e.pointerId !== arr.id) return;
      if (!arr.mexeu && Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) < 6) return;
      arr.mexeu = true; box.classList.add("arrastando");
      posicionar(e.clientX - arr.dx, e.clientY - arr.dy);
    });
    const soltar = e => { if (!arr || e.pointerId !== arr.id) return; const m = arr.mexeu; arr = null; box.classList.remove("arrastando");
      if (m) { const r = box.getBoundingClientRect(); PREF.pos = { x: r.left / innerWidth, y: r.top / innerHeight }; salvar(); box.dataset.arrastou = "1"; setTimeout(() => { box.dataset.arrastou = ""; }, 50); } };
    box.addEventListener("pointerup", soltar); box.addEventListener("pointercancel", soltar);
    addEventListener("resize", () => { if (PREF.pos && !box.hidden) aplicarPos(); });

    pill = document.createElement("button"); pill.type = "button"; pill.className = "ft2-pill"; pill.hidden = true;
    pill.innerHTML = `<span class="ft2-ponto"></span><span class="ft2-pt"></span>`;
    pill.addEventListener("click", () => { PREF.fechado = ""; salvar(); if (ultimo) atualizar(ultimo); });
    document.body.appendChild(pill);
  }
  function posicionar(x, y) {
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(6, Math.min(innerWidth - w - 6, x)) + "px"; box.style.top = Math.max(6, Math.min(innerHeight - h - 6, y)) + "px";
    box.style.right = "auto"; box.style.bottom = "auto";
  }
  function aplicarPos() { if (PREF.pos) posicionar(PREF.pos.x * innerWidth, PREF.pos.y * innerHeight); }

  // observa o relógio grande: se ele sair da tela ao rolar, o quadro aparece
  function vigiarRelogio(alvo) {
    if (alvo === relogioAlvo) return;
    relogioAlvo = alvo; relogioVisivel = !!alvo;
    if (observador) { observador.disconnect(); observador = null; }
    if (alvo && "IntersectionObserver" in window) {
      observador = new IntersectionObserver(ent => { relogioVisivel = ent[0].isIntersecting; if (ultimo) atualizar(ultimo); }, { threshold: 0.15 });
      observador.observe(alvo);
    }
  }

  function atualizar(estado) {
    ultimo = estado;
    if (!box) criar();
    const alvo = estado.alvoSel ? document.querySelector(estado.alvoSel) : null;
    vigiarRelogio(estado.naTela && alvo ? alvo : null);
    const chave = chaveDe(estado);
    if (PREF.fechado && PREF.fechado !== chave) { PREF.fechado = ""; salvar(); }   // timer novo: o quadro volta
    const noRelogio = estado.naTela && relogioVisivel;
    const fechado = PREF.fechado === chave;
    const era = box.hidden;
    box.hidden = !estado.ativo || noRelogio || fechado;
    pill.hidden = !estado.ativo || noRelogio || !fechado;
    if (era && !box.hidden) requestAnimationFrame(aplicarPos);
    if (estado.ativo) {
      box.classList.toggle("pausado", !estado.rodando); pill.classList.toggle("pausado", !estado.rodando);
      box.classList.toggle("pomo", estado.tipo === "pomodoro");
      box.querySelector(".ft2-t").textContent = estado.texto;
      box.querySelector(".ft2-r").textContent = estado.rotulo || "";
      box.querySelector(".ft2-m").textContent = estado.resumo || "";
      const prog = box.querySelector(".ft2-prog"), L = 2 * Math.PI * 44, pct = estado.pct == null ? 1 : estado.pct;
      prog.style.strokeDasharray = L; prog.style.strokeDashoffset = L * (1 - pct);
      const bp = box.querySelector('[data-ft="alternar"]'); bp.innerHTML = estado.rodando ? ICON.pause : ICON.play; bp.setAttribute("aria-label", estado.rodando ? "Pausar" : "Continuar");
      box.querySelector('[data-ft="pip"]').hidden = !pipPossivel();
      box.querySelector('[data-ft="notif"]').hidden = !("Notification" in window);
      box.querySelector('[data-ft="notif"]').classList.toggle("on", !PREF.semNotif && permitida());
      pill.querySelector(".ft2-pt").textContent = `${estado.tipo === "pomodoro" ? "🍅" : "⏱"} ${estado.resumo || estado.texto}${estado.rodando ? "" : " · pausado"}`;
      pill.title = "Toque para mostrar o tempo";
    }
    desenharPip(estado);
    if (estado.ativo) { relPreparar(estado); relSincronizar(estado); }
    else if (relVideo && relNaJanela()) { try { if (document.pictureInPictureElement) document.exitPictureInPicture(); else relVideo.webkitSetPresentationMode("inline"); } catch (er) {} relVideo.pause(); }
    notificar();
  }

  /* ---------- janela por cima de outros apps ----------
     PC (Chrome/Edge): janela própria com botões. Celular e tablet: um vídeo feito com o desenho do tempo
     (o vídeo precisa ter imagem antes de pedir a janela, senão o aparelho recusa). */
  let pipWin = null, pipVideo = null, pipCanvas = null, CH = null;
  const pipPossivel = () => "documentPictureInPicture" in window || !!document.pictureInPictureEnabled || !!HTMLVideoElement.prototype.webkitSetPresentationMode;
  const estadoPip = () => ultimo || { ativo: false };
  /* relógio em vídeo (iPhone, iPad e Android): um vídeo de verdade com o tempo andando. Ele continua tocando na janela
     por cima mesmo quando a pessoa sai do navegador e o site fica parado. O site só pula para o segundo certo. */
  const REL = { cronometro: "midia/relogio-cronometro.mp4", pomodoro: "midia/relogio-pomodoro.mp4", maxC: 14400, maxP: 7200 };
  let relVideo = null, relTipo = "";
  const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
  function relSegundo(e) {
    if (e.tipo === "pomodoro") { const falta = (e.restante != null ? e.restante : (e.fim ? e.fim - Date.now() : 0)) / 1000; return Math.max(0, Math.min(REL.maxP - 0.5, REL.maxP - falta)); }
    const ms = e.ms != null ? e.ms : (e.inicio ? Date.now() - e.inicio : 0); return Math.max(0, Math.min(REL.maxC - 0.5, ms / 1000));
  }
  function relPreparar(e) {                                   // carrega antes, para o toque abrir a janela na hora (exigência do iPhone)
    if (!e || !e.ativo || "documentPictureInPicture" in window) return;
    if (!relVideo) { relVideo = document.createElement("video"); relVideo.muted = true; relVideo.playsInline = true; relVideo.preload = "auto";
      relVideo.setAttribute("playsinline", ""); relVideo.setAttribute("webkit-playsinline", ""); relVideo.setAttribute("muted", "");
      relVideo.style.cssText = "position:fixed;width:2px;height:2px;opacity:.01;pointer-events:none;bottom:0;left:0;z-index:-1";
      document.body.appendChild(relVideo); }
    if (relTipo !== e.tipo) { relTipo = e.tipo; relVideo.src = REL[e.tipo] || REL.cronometro; try { relVideo.load(); } catch (er) {} }
  }
  function relSincronizar(e) {
    if (!relVideo || !e.ativo || relTipo !== e.tipo || relVideo.readyState < 1) return;
    const alvo = relSegundo(e); if (Math.abs((relVideo.currentTime || 0) - alvo) > 1.5) try { relVideo.currentTime = alvo; } catch (er) {}
    if (e.rodando && relVideo.paused) relVideo.play().catch(() => {}); else if (!e.rodando && !relVideo.paused) relVideo.pause();
  }
  const relNaJanela = () => relVideo && (document.pictureInPictureElement === relVideo || relVideo.webkitPresentationMode === "picture-in-picture");
  async function abrirPip(auto) {
    try {
      if ("documentPictureInPicture" in window) {
        if (pipWin && !pipWin.closed) { if (!auto) { pipWin.close(); pipWin = null; } return; }
        const w = await documentPictureInPicture.requestWindow({ width: 300, height: 170 }); pipWin = w;
        w.document.head.innerHTML = `<style>body{margin:0;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100vh;user-select:none}
          .l{display:flex;align-items:center;gap:14px}b{font:600 42px/1 ui-monospace,monospace;letter-spacing:-1px}small{display:block;opacity:.7;font-size:12px;margin-bottom:6px}span{display:block;opacity:.85;font-size:13px;margin-top:6px}
          button{width:44px;height:44px;border-radius:50%;border:0;background:#22d3ee;color:#0f172a;cursor:pointer;display:grid;place-items:center}.p b{opacity:.6}#c{font-size:13px;opacity:.9;background:rgba(34,197,94,.18);padding:4px 10px;border-radius:999px}#c:empty{display:none}</style>`;
        w.document.body.innerHTML = `<div class="l"><div><small id="r"></small><b id="t"></b><span id="m"></span></div><button id="a" aria-label="Pausar ou continuar"></button></div><div id="c"></div>`;
        w.document.getElementById("a").onclick = () => { if (ultimo && ultimo.ativo) acoes.alternar(ultimo.tipo); };
        w.addEventListener("pagehide", () => { pipWin = null; });
        desenharPip(estadoPip()); return;
      }
      const e0 = estadoPip();
      if (e0.ativo) {
        relPreparar(e0);
        if (relNaJanela()) { if (!auto) { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else relVideo.webkitSetPresentationMode("inline"); } return; }
        try { relVideo.currentTime = relSegundo(e0); } catch (er) {}
        const tocar = relVideo.play(); if (tocar && tocar.catch) tocar.catch(() => {});
        if (!e0.rodando) setTimeout(() => relVideo.pause(), 300);
        if (relVideo.webkitSupportsPresentationMode && relVideo.webkitSupportsPresentationMode("picture-in-picture") && (ehIOS || !relVideo.requestPictureInPicture)) relVideo.webkitSetPresentationMode("picture-in-picture");
        else if (relVideo.requestPictureInPicture) { if (relVideo.readyState < 1) await new Promise(ok => { relVideo.addEventListener("loadedmetadata", ok, { once: true }); setTimeout(ok, 2500); }); await relVideo.requestPictureInPicture(); }
        else throw new Error("sem pip");
        if (ehIOS && !auto && !PREF.dicaIOS) { PREF.dicaIOS = 1; salvar(); avisar("Pronto! Agora pode sair do Safari: o tempo continua correndo na janelinha por cima."); }
        return;
      }
      if (document.pictureInPictureElement === pipVideo && pipVideo) { if (!auto) await document.exitPictureInPicture(); return; }
      if (!pipCanvas) { pipCanvas = document.createElement("canvas"); pipCanvas.width = 480; pipCanvas.height = 270; }
      pintarCanvas(estadoPip());                                       // primeira imagem antes de ligar o vídeo
      if (!pipVideo) {
        pipVideo = document.createElement("video"); pipVideo.muted = true; pipVideo.playsInline = true; pipVideo.autoplay = true;
        pipVideo.setAttribute("playsinline", ""); pipVideo.setAttribute("muted", "");
        pipVideo.style.cssText = "position:fixed;width:2px;height:2px;opacity:.01;pointer-events:none;bottom:0;left:0;z-index:-1";
        document.body.appendChild(pipVideo);
        pipVideo.srcObject = pipCanvas.captureStream(5);
        pipVideo.addEventListener("leavepictureinpicture", () => {});
        try { navigator.mediaSession.setActionHandler("play", () => ultimo && acoes.alternar(ultimo.tipo)); navigator.mediaSession.setActionHandler("pause", () => ultimo && acoes.alternar(ultimo.tipo)); } catch (e) {}
      }
      const pronto = pipVideo.readyState >= 1 ? Promise.resolve() : new Promise(ok => { pipVideo.addEventListener("loadedmetadata", ok, { once: true }); setTimeout(ok, 1500); });
      const tocando = pipVideo.play().catch(() => {});
      // o pedido precisa sair logo após o toque: o desenho segue sendo atualizado enquanto o vídeo carrega
      const t = setInterval(() => pintarCanvas(estadoPip()), 100);
      await Promise.race([pronto, new Promise(ok => setTimeout(ok, 600))]); await tocando; clearInterval(t);
      if (pipVideo.requestPictureInPicture && document.pictureInPictureEnabled) await pipVideo.requestPictureInPicture();
      else if (pipVideo.webkitSupportsPresentationMode && pipVideo.webkitSupportsPresentationMode("picture-in-picture")) pipVideo.webkitSetPresentationMode("picture-in-picture");
      else throw new Error("sem pip");
    } catch (e) { console.warn("pip", e); if (!auto) avisar(ehIOS ? "O iPhone não deixou abrir a janela por cima. Confira em Ajustes › Geral › Imagem em Imagem se ela está ligada e tente de novo." : "Este aparelho não deixou abrir a janela por cima. Mesmo assim, ao sair do app, os minutos aparecem na notificação."); }
  }
  function desenharPip(e) {
    if (pipWin && !pipWin.closed) {
      const d = pipWin.document, t = d.getElementById("t"); if (!t) return;
      t.textContent = e.ativo ? e.texto : (CH ? "📞" : "--:--"); d.getElementById("r").textContent = e.ativo ? (e.rotulo || "") : "";
      d.getElementById("m").textContent = e.ativo ? (e.resumo || "") + (e.rodando ? "" : " · pausado") : CH ? "" : "Sem tempo rodando";
      const a = d.getElementById("a"); a.hidden = !e.ativo; a.innerHTML = e.rodando ? ICON.pause : ICON.play; d.body.className = e.ativo && !e.rodando ? "p" : "";
      d.getElementById("c").textContent = CH ? `📞 ${CH.titulo}${CH.mudo ? " · mudo" : ""}` : "";
    }
    if (pipCanvas) pintarCanvas(e);
  }
  function pintarCanvas(e) {
    const c = pipCanvas.getContext("2d"), W = 480, H = 270, g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#1e293b"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.textAlign = "center";
    if (e.ativo) {
      const cy = CH ? 112 : 128;
      if (e.pct != null) { c.strokeStyle = "rgba(255,255,255,.15)"; c.lineWidth = 10; c.beginPath(); c.arc(W / 2, cy, 92, 0, 7); c.stroke();
        c.strokeStyle = e.tipo === "pomodoro" ? "#22d3ee" : "#4ade80"; c.lineCap = "round"; c.beginPath(); c.arc(W / 2, cy, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.pct); c.stroke(); }
      c.fillStyle = "#fff"; c.font = "600 62px ui-monospace,monospace"; c.globalAlpha = e.rodando ? 1 : 0.6; c.fillText(e.texto, W / 2, cy + 20); c.globalAlpha = 1;
      c.font = "20px system-ui,sans-serif"; c.fillStyle = "rgba(255,255,255,.85)"; c.fillText((e.resumo || "") + (e.rodando ? "" : " · pausado"), W / 2, CH ? 228 : 248);
    } else if (CH) { c.fillStyle = "#fff"; c.font = "64px system-ui"; c.fillText("📞", W / 2, 120); }
    if (CH) { c.font = "600 19px system-ui,sans-serif"; c.fillStyle = "#4ade80"; c.fillText(`● ${CH.titulo}${CH.mudo ? " · mudo" : ""} · ${minDesde(CH.desde)}`, W / 2, e.ativo ? 258 : 190); }
    c.font = "13px system-ui,sans-serif"; c.fillStyle = "rgba(255,255,255,.45)"; c.textAlign = "left"; c.fillText("Logic Academy", 12, 22);
  }
  const minDesde = t => { const m = Math.max(0, Math.floor((Date.now() - (t || Date.now())) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

  /* ---------- notificação "o app está aberto": aparece sozinha ao fechar o quadro ou ao sair do app ----------
     No Android o próprio sistema conta o tempo na notificação (horário de início ou de fim), mesmo com o app pausado. */
  let ultimaNotif = "", ultimaVez = 0;
  const permitida = () => "Notification" in window && window.Notification.permission === "granted";
  async function pedirNotificacao() {
    if (!("Notification" in window) || window.Notification.permission !== "default") return permitida();
    try { const p = await Notification.requestPermission(); if (p === "granted") { try { if (navigator.serviceWorker && !(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("sw.js"); } catch (e) {} } return p === "granted"; } catch (e) { return false; }
  }
  async function alternarNotif() {
    if (!("Notification" in window)) { avisar("Este navegador não mostra notificações."); return; }
    if (permitida() && !PREF.semNotif) { PREF.semNotif = true; salvar(); fecharNotif(); avisar("Notificação desligada."); if (ultimo) atualizar(ultimo); return; }
    PREF.semNotif = false; salvar();
    if (!(await pedirNotificacao()) && !permitida()) { avisar("Libere as notificações do site nas configurações do navegador para ver os minutos na barra de notificações."); return; }
    ultimaNotif = ""; if (ultimo) atualizar(ultimo); avisar("Pronto: ao fechar o quadro ou sair do app, os minutos ficam na notificação.");
  }
  const hhmm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  async function notificar() {
    if (PREF.semNotif || !("Notification" in window) || Notification.permission !== "granted") return;
    const e = ultimo || { ativo: false }, fora = document.visibilityState !== "visible", fechado = e.ativo && PREF.fechado === chaveDe(e);
    const mostrar = (e.ativo && (fechado || fora)) || (CH && fora);
    if (!mostrar) { if (ultimaNotif) { ultimaNotif = ""; fecharNotif(); } return; }
    let titulo, corpo, ts;
    if (e.ativo) {
      titulo = `${e.tipo === "pomodoro" ? "🍅" : "⏱"} ${e.resumo || e.texto}${e.rodando ? "" : " · pausado"}`;
      corpo = `Logic Academy aberto · ${e.tipo === "pomodoro" ? (e.rodando && e.fim ? "termina às " + hhmm(e.fim) : "pomodoro") : (e.rodando ? "contando desde " + hhmm(e.inicio || Date.now()) : "cronômetro pausado")}${e.rotulo ? " · " + e.rotulo : ""}`;
      ts = e.tipo === "pomodoro" ? (e.rodando && e.fim ? e.fim : Date.now()) : (e.inicio || Date.now());
      if (CH) corpo += ` · 📞 ${CH.titulo}`;
    } else { titulo = `📞 ${CH.titulo}`; corpo = `Ligação ativa em segundo plano · ${minDesde(CH.desde)}${CH.mudo ? " · microfone desligado" : ""}`; ts = CH.desde || Date.now(); }
    const chave = titulo + corpo; if (chave === ultimaNotif && Date.now() - ultimaVez < 55000) return; ultimaNotif = chave; ultimaVez = Date.now();
    const o = { body: corpo, tag: "la-tempo", silent: true, renotify: false, requireInteraction: true, timestamp: ts, icon: "icones/icone-192.png", badge: "icones/icone-192.png", data: { url: location.href } };
    try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) await r.showNotification(titulo, o); else new Notification(titulo, o); } catch (er) {}
  }
  async function fecharNotif() { try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) (await r.getNotifications({ tag: "la-tempo" })).forEach(n => n.close()); } catch (e) {} }
  function avisar(t) { if (acoes.toast) acoes.toast(t); }
  document.addEventListener("visibilitychange", () => { ultimaNotif = ""; notificar(); if (document.visibilityState !== "visible" && (ultimo && ultimo.ativo && ultimo.rodando) && pipVideo && !document.pictureInPictureElement) abrirPip(true); });
  setInterval(() => { if ((ultimo && ultimo.ativo) || CH) { if (pipCanvas) pintarCanvas(estadoPip()); notificar(); } }, 30000);
  try { navigator.mediaSession.setActionHandler("enterpictureinpicture", () => abrirPip(true)); } catch (e) {}
  // a ligação informa aqui quando começa, muda e termina (para a janela por cima e a notificação)
  function chamada(info) { CH = info || null; if (!CH && !(ultimo && ultimo.ativo)) { fecharNotif(); ultimaNotif = ""; } desenharPip(estadoPip()); notificar(); }

  (window.LAComp = window.LAComp || {}).FloatingTimer = { atualizar, chamada, abrirPip, pipPossivel, pedirNotificacao, configurar(a) { acoes = Object.assign(acoes, a || {}); } };
})();
