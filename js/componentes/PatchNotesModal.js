/* PatchNotesModal — aviso de novidades depois de cada deploy.
   Aparece uma única vez por versão: a versão vista fica no localStorage ("la_patch_visto").
   Uso: LAComp.PatchNotesModal.mostrarSeNecessario({ versao, titulo, itens, aoFechar, silencioso })
   - silencioso: true só registra a versão como vista (ex.: conta nova, que não precisa de "o que mudou"). */
(function () {
  "use strict";
  const CHAVE = "la_patch_visto";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lerVisto = () => { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } };
  const marcarVisto = v => { try { localStorage.setItem(CHAVE, v); } catch (e) { /* sem armazenamento: aparece de novo, sem problema */ } };

  function mostrarSeNecessario(cfg) {
    if (!cfg || !cfg.versao || lerVisto() === cfg.versao) return false;
    if (cfg.silencioso) { marcarVisto(cfg.versao); return false; }
    if (document.querySelector(".modal-bg")) return false;          // não empilha com outro modal aberto
    const bg = document.createElement("div");
    bg.className = "modal-bg patch-bg";
    bg.innerHTML = `<div class="card stack modal patch" role="dialog" aria-modal="true" aria-labelledby="patch-t">
      <div class="patch-topo"><span class="patch-ver">v${esc(cfg.versao)}</span><span class="eyebrow">Atualização</span></div>
      <h2 id="patch-t">${esc(cfg.titulo || "Novidades no Logic Academy")}</h2>
      <ul class="patch-lista">${(cfg.itens || []).map(i => `<li><b>${esc(i.t)}</b>${i.d ? `<span>${esc(i.d)}</span>` : ""}</li>`).join("")}</ul>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-patch="ok">Entendi</button></div></div>`;
    document.body.appendChild(bg);
    const fechar = () => { marcarVisto(cfg.versao); bg.remove(); if (cfg.aoFechar) cfg.aoFechar(); };
    bg.querySelector('[data-patch="ok"]').onclick = fechar;
    bg.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
    setTimeout(() => { const b = bg.querySelector('[data-patch="ok"]'); if (b) b.focus({ preventScroll: true }); }, 60);
    return true;
  }
  (window.LAComp = window.LAComp || {}).PatchNotesModal = { mostrarSeNecessario, CHAVE };
})();
