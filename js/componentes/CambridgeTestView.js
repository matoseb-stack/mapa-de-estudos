/* CambridgeTestView — teste rápido de nivelamento (A1–C2), uma questão por vez.
   Uso: LAComp.CambridgeTestView.abrir(container, { app, aoConcluir(resultado), aoCancelar() })
   O resultado é salvo pelo serviço (FirebaseServiceMock.saveUserLevel) e vale XP por acerto. */
(function () {
  "use strict";
  const XP_POR_ACERTO = 5;

  function abrir(container, op) {
    const { app } = op, IN = window.LA_INGLES, Srv = window.FirebaseServiceMock, esc = app.esc;
    const itens = IN.NIVELAMENTO, resp = new Array(itens.length).fill(null);
    let i = 0;

    function pintar() {
      const it = itens[i], pct = Math.round(i / itens.length * 100);
      container.innerHTML = `<div class="page" style="max-width:720px">
        ${app.pageHead("Teste de nivelamento", "Inglês · estilo Cambridge. 18 questões rápidas, do básico ao avançado. Se não souber, pule: isso também ajuda a achar seu nível.")}
        <div class="card stack cbt">
          <div class="row" style="justify-content:space-between"><span class="eyebrow">Questão ${i + 1} de ${itens.length}</span><button class="btn ghost sm" type="button" data-cbt="sair">Sair do teste</button></div>
          <div class="prog"><i style="width:${pct}%"></i></div>
          <p class="cbt-q">${esc(it.q).replace("___", '<span class="cbt-gap">_____</span>')}</p>
          <div class="cbt-ops" role="radiogroup" aria-label="Alternativas">${it.op.map((o, k) => `<button type="button" class="opt cbt-op ${resp[i] === k ? "on" : ""}" role="radio" aria-checked="${resp[i] === k}" data-cbt-op="${k}"><b>${"ABCD"[k]}</b> ${esc(o)}</button>`).join("")}</div>
          <div class="row" style="justify-content:space-between">
            <button class="btn ghost" type="button" data-cbt="voltar" ${i === 0 ? "disabled" : ""}>Voltar</button>
            <div class="row"><button class="btn ghost" type="button" data-cbt="pular">Não sei</button>
            <button class="btn primary" type="button" data-cbt="prox" ${resp[i] == null ? "disabled" : ""}>${i === itens.length - 1 ? "Ver meu nível" : "Próxima"}</button></div>
          </div>
        </div></div>`;
    }
    async function concluir() {
      const porNivel = {};
      let pontos = 0;
      itens.forEach((it, k) => { const ok = resp[k] === it.r; porNivel[it.n] = (porNivel[it.n] || 0) + (ok ? 1 : 0); if (ok) pontos++; });
      const nivel = IN.nivelPorPontos(pontos);
      container.innerHTML = `<div class="page" style="max-width:720px"><div class="card stack" style="align-items:center;text-align:center;padding:40px 20px"><span class="spinner"></span><p class="muted">Calculando e salvando seu nível…</p></div></div>`;
      try {
        const reg = await Srv.saveUserLevel(app.uid(), "ingles", { nivel, pontos, total: itens.length, porNivel });
        const xp = await Srv.addLanguageXP(app.uid(), pontos * XP_POR_ACERTO, "Teste de nivelamento");
        container.innerHTML = `<div class="page" style="max-width:720px"><div class="card stack cbt-res" style="align-items:center;text-align:center">
          <span class="eyebrow">Resultado do nivelamento</span>
          <div class="cbt-nivel">${esc(reg.nivel)}</div>
          <h2 style="margin:0">${esc(IN.EXAME[reg.nivel])}</h2>
          <p class="muted">Você acertou ${pontos} de ${itens.length} questões${xp.ganho ? ` e ganhou <b>+${xp.ganho} XP</b> de idiomas` : ""}.</p>
          <div class="cbt-barras">${IN.NIVEIS.map(n => `<div><span style="height:${(porNivel[n] || 0) / 3 * 100}%"></span><small>${n}</small></div>`).join("")}</div>
          <p class="small muted" style="max-width:52ch">As aulas foram ajustadas para o seu nível. Você pode refazer o teste quando quiser ou estudar outros níveis.</p>
          <button class="btn primary" type="button" data-cbt="fim">Ver minhas aulas</button></div></div>`;
        container.querySelector('[data-cbt="fim"]').onclick = () => op.aoConcluir && op.aoConcluir(reg);
      } catch (e) {
        app.toast("Não foi possível salvar o nível agora. Tente de novo.");
        pintar();
      }
    }
    container.onclick = e => {
      const o = e.target.closest("[data-cbt-op]");
      if (o) { resp[i] = +o.dataset.cbtOp; pintar(); return; }
      const b = e.target.closest("[data-cbt]"); if (!b) return;
      const a = b.dataset.cbt;
      if (a === "sair") { container.onclick = null; op.aoCancelar && op.aoCancelar(); return; }
      if (a === "voltar" && i > 0) { i--; pintar(); return; }
      if (a === "pular") resp[i] = -1;
      if (a === "pular" || a === "prox") { if (i < itens.length - 1) { i++; pintar(); } else { container.onclick = null; concluir(); } }
    };
    pintar();
  }
  (window.LAComp = window.LAComp || {}).CambridgeTestView = { abrir };
})();
