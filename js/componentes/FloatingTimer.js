/* FloatingTimer — mini-janela flutuante do pomodoro/cronômetro.
   Aparece quando há um timer ativo e a pessoa saiu da tela dele ou rolou até o relógio sumir.
   O "X" esconde a janela até o próximo timer (ou até a pessoa voltar à tela do relógio).

   Integração: o app chama LAComp.FloatingTimer.atualizar(estado) a cada tique, com
   estado = { ativo, tipo:"pomodoro"|"cronometro", texto:"12:34", rotulo, rodando, naTela, alvoSel }
   e registra as ações com LAComp.FloatingTimer.configurar({ abrir(tipo), alternar(tipo) }). */
(function () {
  "use strict";
  let acoes = { abrir() {}, alternar() {} };
  let el = null, ultimo = null, fechadoPara = null, observador = null, relogioVisivel = true, relogioAlvo = null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = {
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    abrir: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>'
  };

  function criar() {
    el = document.createElement("div");
    el.className = "ftimer"; el.hidden = true; el.setAttribute("role", "status"); el.setAttribute("aria-live", "off");
    el.innerHTML = `<button type="button" class="ftimer-corpo" data-ft="abrir" aria-label="Abrir o relógio"><span class="ftimer-ponto"></span><span class="ftimer-txt"><b class="ftimer-t">00:00</b><small class="ftimer-r"></small></span></button>
      <button type="button" class="ftimer-b" data-ft="alternar" aria-label="Pausar ou continuar">${ICON.pause}</button>
      <button type="button" class="ftimer-b" data-ft="abrir2" aria-label="Abrir o relógio" title="Abrir">${ICON.abrir}</button>
      <button type="button" class="ftimer-x" data-ft="fechar" aria-label="Fechar a mini-janela" title="Fechar">✕</button>`;
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-ft]"); if (!b || !ultimo) return;
      const a = b.dataset.ft;
      if (a === "fechar") { fechadoPara = ultimo.tipo + ":" + (ultimo.sessao || ""); el.hidden = true; return; }
      if (a === "alternar") { acoes.alternar(ultimo.tipo); return; }
      acoes.abrir(ultimo.tipo);
    });
    document.body.appendChild(el);
  }

  // observa o relógio grande: se ele sair da tela ao rolar, a mini-janela aparece
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
    if (!el) criar();
    const alvo = estado.alvoSel ? document.querySelector(estado.alvoSel) : null;
    vigiarRelogio(estado.naTela && alvo ? alvo : null);
    const chave = estado.tipo + ":" + (estado.sessao || "");
    if (fechadoPara && fechadoPara !== chave) fechadoPara = null;            // timer novo: volta a aparecer
    if (estado.naTela && relogioVisivel) fechadoPara = null;                 // voltou para o relógio: "X" vale de novo
    const mostrar = estado.ativo && !(estado.naTela && relogioVisivel) && fechadoPara !== chave;
    el.hidden = !mostrar;
    if (!mostrar) return;
    el.classList.toggle("pausado", !estado.rodando);
    el.querySelector(".ftimer-t").textContent = estado.texto;
    el.querySelector(".ftimer-r").textContent = estado.rotulo || "";
    el.querySelector('[data-ft="alternar"]').innerHTML = estado.rodando ? ICON.pause : ICON.play;
    el.querySelector('[data-ft="alternar"]').setAttribute("aria-label", estado.rodando ? "Pausar" : "Continuar");
  }

  (window.LAComp = window.LAComp || {}).FloatingTimer = { atualizar, configurar(a) { acoes = Object.assign(acoes, a || {}); } };
})();
