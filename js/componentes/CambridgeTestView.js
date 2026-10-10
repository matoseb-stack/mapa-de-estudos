/* CambridgeTestView — teste de nivelamento adaptativo (A1 → C2).
   Cada etapa tem 5 ou 6 questões de um nível, alternando marcar, escrever, montar a frase e falar.
   Acertou 75% ou mais → sobe para o próximo nível. Acertou metade → fica nesse nível. Menos → fica no anterior.
   Uso: LAComp.CambridgeTestView.abrir(container, { app, aoConcluir(resultado), aoCancelar() }) */
(function () {
  "use strict";
  const XP_POR_ACERTO = 5;

  function abrir(container, op) {
    const { app } = op, IN = window.LA_INGLES, Srv = window.LAService || window.FirebaseServiceMock, Ex = window.LAComp.Exercicio, esc = app.esc;
    const N = IN.NIVEIS, porNivel = {};
    let iN = 0, iQ = 0, acertos = 0, validas = 0, totalAcertos = 0, feitas = 0, final = null;

    function pintar() {
      const lista = IN.NIVELAMENTO[N[iN]], ex = lista[iQ];
      container.innerHTML = `<div class="page" style="max-width:720px">
        ${app.pageHead("Teste de nivelamento", "Inglês no padrão Cambridge. As questões ficam mais difíceis conforme você acerta. Se não souber, tente mesmo assim: errar também ajuda a achar o seu nível.")}
        <div class="card stack cbt">
          <div class="row" style="justify-content:space-between"><span class="eyebrow">Etapa ${iN + 1} de ${N.length} · questão ${iQ + 1} de ${lista.length}</span><button class="btn ghost sm" type="button" data-cbt="sair">Sair do teste</button></div>
          <div class="cbt-etapas" aria-hidden="true">${N.map((n, k) => `<i class="${k < iN ? "feita" : k === iN ? "atual" : ""}"></i>`).join("")}</div>
          <div data-ex-area></div>
        </div></div>`;
      container.querySelector('[data-cbt="sair"]').onclick = () => { Ex.pararFala(); container.onclick = null; op.aoCancelar && op.aoCancelar(); };
      Ex.render(container.querySelector("[data-ex-area]"), ex, {
        app, rotuloContinuar: iQ === lista.length - 1 ? "Concluir etapa" : "Próxima",
        aoResultado: (ok, info) => { feitas++; if (!info.pulado) { validas++; if (ok) { acertos++; totalAcertos++; } } },
        aoContinuar: avancar
      });
    }
    function avancar() {
      const lista = IN.NIVELAMENTO[N[iN]];
      if (iQ < lista.length - 1) { iQ++; pintar(); return; }
      const pct = validas ? acertos / validas : 0;
      porNivel[N[iN]] = { acertos, total: validas };
      if (pct >= 0.75 && iN < N.length - 1) { iN++; iQ = 0; acertos = 0; validas = 0; transicao(); return; }
      final = pct >= 0.5 ? N[iN] : N[Math.max(0, iN - 1)];
      if (pct >= 0.75) final = N[iN];                      // passou do C2
      concluir();
    }
    function transicao() {
      container.innerHTML = `<div class="page" style="max-width:720px"><div class="card stack" style="align-items:center;text-align:center;padding:36px 20px">
        <span class="cbt-nivel" style="width:84px;height:84px;font-size:2rem">${esc(N[iN - 1])} ✓</span>
        <h2 style="margin:0">Muito bem! Você passou do ${esc(N[iN - 1])}.</h2>
        <p class="muted">Agora vêm questões do nível <b>${esc(N[iN])}</b>, mais difíceis.</p>
        <button class="btn primary" type="button" data-cbt="seguir">Continuar</button></div></div>`;
      const b = container.querySelector('[data-cbt="seguir"]'); b.onclick = pintar; b.focus({ preventScroll: true });
    }
    async function concluir() {
      container.innerHTML = `<div class="page" style="max-width:720px"><div class="card stack" style="align-items:center;text-align:center;padding:40px 20px"><span class="spinner"></span><p class="muted">Calculando e salvando seu nível…</p></div></div>`;
      try {
        const reg = await Srv.saveUserLevel(app.uid(), "ingles", { nivel: final, pontos: totalAcertos, total: feitas, porNivel });
        const xp = await Srv.addLanguageXP(app.uid(), totalAcertos * XP_POR_ACERTO, "Teste de nivelamento");
        if (app.xpPerfil) app.xpPerfil("nivelamento");                // XP no perfil: só na primeira vez
        container.innerHTML = `<div class="page" style="max-width:720px"><div class="card stack cbt-res" style="align-items:center;text-align:center">
          <span class="eyebrow">Resultado do nivelamento</span>
          <div class="cbt-nivel">${esc(reg.nivel)}</div>
          <h2 style="margin:0">${esc(IN.EXAME[reg.nivel])}</h2>
          <p class="muted">Você acertou ${totalAcertos} de ${feitas} questões${xp.ganho ? ` e ganhou <b>+${xp.ganho} XP</b> de idiomas` : ""}.</p>
          <div class="cbt-barras">${N.map(n => { const p = porNivel[n]; return `<div title="${p ? `${p.acertos} de ${p.total}` : "não testado"}"><span style="height:${p && p.total ? p.acertos / p.total * 100 : 0}%"></span><small>${n}</small></div>`; }).join("")}</div>
          <p class="small muted" style="max-width:54ch">As trilhas do nível ${esc(reg.nivel)} foram liberadas para você. Os níveis abaixo continuam abertos para revisar.</p>
          <button class="btn primary" type="button" data-cbt="fim">Ver minhas aulas</button></div></div>`;
        container.querySelector('[data-cbt="fim"]').onclick = () => op.aoConcluir && op.aoConcluir(reg);
      } catch (e) {
        app.toast("Não foi possível salvar o nível agora. Tente de novo.");
        op.aoCancelar && op.aoCancelar();
      }
    }
    container.onclick = null;
    pintar();
  }
  (window.LAComp = window.LAComp || {}).CambridgeTestView = { abrir };
})();
