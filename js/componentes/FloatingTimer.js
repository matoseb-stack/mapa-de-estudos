/* FloatingTimer — tempo de estudo flutuando por cima do site (pomodoro e cronômetro).
   - Quadro flutuante (dá para arrastar): tempo grande, anel de progresso no pomodoro, pausar/continuar,
     janela por cima de outros apps (Picture-in-Picture), notificação do sistema e abrir o relógio.
   - O ✕ fecha o quadro, mas fica uma faixinha no alto da tela com os minutos; tocar nela reabre o quadro.
   - Notificação do sistema (opcional, a pessoa liga no 🔔): fica na barra de notificações do celular, tablet
     ou PC e é atualizada a cada minuto, em silêncio.
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
      if (a === "fechar") { PREF.fechado = chaveDe(ultimo); salvar(); atualizar(ultimo); return; }
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
      box.querySelector('[data-ft="notif"]').classList.toggle("on", !!PREF.notif && Notification.permission === "granted");
      pill.querySelector(".ft2-pt").textContent = `${estado.tipo === "pomodoro" ? "🍅" : "⏱"} ${estado.resumo || estado.texto}${estado.rodando ? "" : " · pausado"}`;
      pill.title = "Toque para mostrar o tempo";
    }
    desenharPip(estado);
    notificar(estado);
  }

  /* ---------- janela por cima de outros apps ---------- */
  let pipWin = null, pipVideo = null, pipCanvas = null;
  const pipPossivel = () => "documentPictureInPicture" in window || (!!document.pictureInPictureEnabled && !!HTMLCanvasElement.prototype.captureStream);
  async function abrirPip() {
    if (!ultimo) return;
    try {
      if ("documentPictureInPicture" in window) {
        if (pipWin && !pipWin.closed) { pipWin.close(); pipWin = null; return; }
        const w = await documentPictureInPicture.requestWindow({ width: 280, height: 150 }); pipWin = w;
        w.document.head.innerHTML = `<style>body{margin:0;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;height:100vh;user-select:none}
          b{font:600 44px/1 ui-monospace,monospace;letter-spacing:-1px}small{display:block;opacity:.7;font-size:12px;margin-bottom:6px}span{display:block;opacity:.85;font-size:13px;margin-top:6px}
          button{width:46px;height:46px;border-radius:50%;border:0;background:#22d3ee;color:#0f172a;cursor:pointer;display:grid;place-items:center}.p b{opacity:.6}</style>`;
        w.document.body.innerHTML = `<div><small id="r"></small><b id="t"></b><span id="m"></span></div><button id="a" aria-label="Pausar ou continuar"></button>`;
        w.document.getElementById("a").onclick = () => acoes.alternar(ultimo.tipo);
        w.addEventListener("pagehide", () => { pipWin = null; });
        desenharPip(ultimo); return;
      }
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      pipCanvas = pipCanvas || document.createElement("canvas"); pipCanvas.width = 480; pipCanvas.height = 270;
      desenharPip(ultimo);
      if (!pipVideo) {
        pipVideo = document.createElement("video"); pipVideo.muted = true; pipVideo.playsInline = true; pipVideo.setAttribute("playsinline", "");
        pipVideo.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0";
        document.body.appendChild(pipVideo);
        pipVideo.srcObject = pipCanvas.captureStream(4);
        try { navigator.mediaSession.setActionHandler("play", () => acoes.alternar(ultimo.tipo)); navigator.mediaSession.setActionHandler("pause", () => acoes.alternar(ultimo.tipo)); } catch (e) {}
      }
      await pipVideo.play(); await pipVideo.requestPictureInPicture();
    } catch (e) { console.warn("pip", e); avisar("Este aparelho não deixou abrir a janela por cima. Ligue a notificação 🔔 para ver os minutos na barra de notificações."); }
  }
  function desenharPip(e) {
    if (pipWin && !pipWin.closed) {
      const d = pipWin.document, t = d.getElementById("t"); if (!t) return;
      t.textContent = e.ativo ? e.texto : "--:--"; d.getElementById("r").textContent = e.rotulo || ""; d.getElementById("m").textContent = e.ativo ? (e.resumo || "") + (e.rodando ? "" : " · pausado") : "Sem tempo rodando";
      d.getElementById("a").innerHTML = e.rodando ? ICON.pause : ICON.play; d.body.className = e.rodando ? "" : "p";
    }
    if (pipCanvas && document.pictureInPictureElement === pipVideo) {
      const c = pipCanvas.getContext("2d"), W = 480, H = 270, g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#1e293b"); c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (e.pct != null) { c.strokeStyle = "rgba(255,255,255,.15)"; c.lineWidth = 10; c.beginPath(); c.arc(W / 2, 128, 100, 0, 7); c.stroke();
        c.strokeStyle = "#22d3ee"; c.lineCap = "round"; c.beginPath(); c.arc(W / 2, 128, 100, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.pct); c.stroke(); }
      c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "600 64px ui-monospace,monospace"; c.globalAlpha = e.rodando ? 1 : 0.6; c.fillText(e.ativo ? e.texto : "--:--", W / 2, 148); c.globalAlpha = 1;
      c.font = "20px system-ui,sans-serif"; c.fillStyle = "rgba(255,255,255,.8)"; c.fillText((e.resumo || "") + (e.rodando ? "" : " · pausado"), W / 2, 250);
    }
  }

  /* ---------- notificação do sistema com os minutos ---------- */
  let ultimaNotif = "";
  async function alternarNotif() {
    if (!("Notification" in window)) { avisar("Este navegador não mostra notificações."); return; }
    if (PREF.notif && Notification.permission === "granted") { PREF.notif = false; salvar(); fecharNotif(); avisar("Notificação desligada."); if (ultimo) atualizar(ultimo); return; }
    let p = Notification.permission; if (p === "default") { try { p = await Notification.requestPermission(); } catch (e) {} }
    if (p !== "granted") { avisar("Libere as notificações do site nas configurações do navegador para ver os minutos na barra de notificações."); return; }
    try { if (navigator.serviceWorker && !(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("sw.js"); } catch (e) {}
    PREF.notif = true; salvar(); ultimaNotif = ""; if (ultimo) atualizar(ultimo); avisar("Pronto: os minutos aparecem na barra de notificações.");
  }
  async function notificar(e) {
    if (!PREF.notif || !("Notification" in window) || Notification.permission !== "granted") return;
    if (!e.ativo) { if (ultimaNotif) { ultimaNotif = ""; fecharNotif(); } return; }
    const chave = (e.resumo || "") + e.rodando + (e.rotulo || ""); if (chave === ultimaNotif) return; ultimaNotif = chave;
    const titulo = `${e.tipo === "pomodoro" ? "🍅" : "⏱"} ${e.resumo || e.texto}${e.rodando ? "" : " · pausado"}`;
    const o = { body: (e.rotulo || "") + " · Logic Academy", tag: "la-tempo", silent: true, renotify: false, requireInteraction: true, icon: "icones/icone-192.png", badge: "icones/icone-192.png" };
    try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) await r.showNotification(titulo, o); else new Notification(titulo, o); } catch (er) {}
  }
  async function fecharNotif() { try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) (await r.getNotifications({ tag: "la-tempo" })).forEach(n => n.close()); } catch (e) {} }
  function avisar(t) { if (acoes.toast) acoes.toast(t); }

  (window.LAComp = window.LAComp || {}).FloatingTimer = { atualizar, configurar(a) { acoes = Object.assign(acoes, a || {}); } };
})();
