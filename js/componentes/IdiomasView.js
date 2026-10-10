/* IdiomasView — aba "Idiomas": curso em trilhas de aulas (primeiro idioma: Inglês, padrão Cambridge).
   - Na primeira visita a pessoa escolhe o idioma e a prova-meta e pode fazer o nivelamento (CambridgeTestView).
   - Cada nível (A1–C2) tem 4 trilhas (Reading & Use of English, Listening, Writing, Speaking) com 15 aulas cada;
     a aula 15 é um simulado. A próxima aula abre quando a anterior tem 60% de acerto.
   - Cada aula: explicação + vocabulário → material (texto, áudio ou tarefa) → exercícios que alternam
     marcar, escrever e falar (LAComp.Exercicio) → tarefa livre corrigida pela IA (writing e speaking) → resultado.
   - "Adicionar à semana" coloca a próxima aula no plano principal (app.adicionarBlocoNaSemana).
   Uso: LAComp.IdiomasView.render(container, app)
   O objeto app (criado no index.html) dá: uid, esc, ico, pageHead, toast, naTela, diasSemana,
   adicionarBlocoNaSemana, estudarComCronometro, xpPerfil. */
(function () {
  "use strict";
  const XP = { acerto: 5, tarefa: 20, porMinuto: 1 };
  const APROVA = 0.6;                                  // acerto mínimo para abrir a próxima aula
  const MATERIA = "Inglês";
  const IDIOMAS = [
    { k: "ingles", nome: "Inglês", bandeira: "🇬🇧", ativo: true, prova: "Cambridge English" },
    { k: "espanhol", nome: "Espanhol", bandeira: "🇪🇸", prova: "DELE" },
    { k: "frances", nome: "Francês", bandeira: "🇫🇷", prova: "DELF/DALF" },
    { k: "alemao", nome: "Alemão", bandeira: "🇩🇪", prova: "Goethe-Zertifikat" },
    { k: "italiano", nome: "Italiano", bandeira: "🇮🇹", prova: "CELI" },
    { k: "japones", nome: "Japonês", bandeira: "🇯🇵", prova: "JLPT" }
  ];
  const E = { uid: null, nivelVer: null, trilhaAberta: null, perfil: null, nivel: null, gravacao: null, aulas: {}, tela: "inicio" };

  const Srv = () => window.LAService || window.FirebaseServiceMock;   // nuvem com conta; simulado só no modo visitante
  const IN = () => window.LA_INGLES;
  const Ex = () => window.LAComp.Exercicio;
  const chaveAula = (nivel, skill, n) => `ingles:${nivel}:${skill}:${n}`;
  const comp = k => IN().COMPETENCIAS.find(c => c.k === k);
  // plano grátis: nivelamento + aula 1 de cada trilha; o resto é Logic Academy Pro
  const gratis = n => n === 1;
  const podeAbrir = (app, n) => gratis(n) || !app.ehPro || app.ehPro();

  /* ---------- dados ---------- */
  async function carregarTrilha(nivel, skill) {
    const id = nivel + "-" + skill;
    if (!E.aulas[id]) E.aulas[id] = fetch(IN().arquivo(nivel, skill) + "?v=2.2").then(r => { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .catch(e => { delete E.aulas[id]; throw e; });
    return E.aulas[id];
  }
  const feito = (nivel, skill, n) => (E.perfil && E.perfil.concluidos || {})[chaveAula(nivel, skill, n)];
  const aprovada = (nivel, skill, n) => { const f = feito(nivel, skill, n); return !!f && (f.pct == null || f.pct >= APROVA); };
  const liberada = (nivel, skill, n) => n === 1 || aprovada(nivel, skill, n - 1);
  function proxima(nivel, skill) { const T = IN().AULAS_POR_TRILHA; for (let n = 1; n <= T; n++) if (!aprovada(nivel, skill, n)) return n; return null; }
  const feitasNivel = (nivel, skill) => { let c = 0; for (let n = 1; n <= IN().AULAS_POR_TRILHA; n++) if (aprovada(nivel, skill, n)) c++; return c; };
  // trilha até a prova-meta: do nível atual da pessoa até o nível da meta
  function prontidao() {
    const N = IN().NIVEIS, prefs = (E.perfil && E.perfil.prefs) || {}, meta = prefs.meta || "B2", de = (E.nivel && E.nivel.nivel) || "A1";
    const niveis = N.slice(Math.min(N.indexOf(de), N.indexOf(meta)), N.indexOf(meta) + 1);
    let feitas = 0, total = 0;
    niveis.forEach(nv => IN().COMPETENCIAS.forEach(c => { feitas += feitasNivel(nv, c.k); total += IN().AULAS_POR_TRILHA; }));
    const simulados = IN().COMPETENCIAS.filter(c => { const f = feito(meta, c.k, IN().AULAS_POR_TRILHA); return f && f.pct >= 0.7; }).length;
    return { meta, niveis, feitas, total, simulados, pronto: feitas >= total && simulados === 4 };
  }

  async function render(container, app) {
    container.onclick = null;
    if (E.uid !== app.uid()) Object.assign(E, { uid: app.uid(), nivelVer: null, trilhaAberta: null, perfil: null, nivel: null, tela: "inicio" });   // trocou de conta
    container.innerHTML = `<div class="page">${app.pageHead("Idiomas", "Cursos completos até a prova internacional, no seu ritmo.")}<div class="card row muted"><span class="spinner"></span>Carregando seu curso…</div></div>`;
    let nivel, perfil;
    try { [nivel, perfil] = await Promise.all([Srv().getUserLevel(app.uid(), "ingles"), Srv().getLanguageProfile(app.uid())]); }
    catch (e) { container.innerHTML = `<div class="page">${app.pageHead("Idiomas")}<div class="card"><p>Não foi possível carregar agora. Confira sua internet e tente de novo.</p><button class="btn" type="button" data-id="tentar">Tentar de novo</button></div></div>`;
      container.querySelector('[data-id="tentar"]').onclick = () => render(container, app); return; }
    if (!app.naTela()) return;                                   // a pessoa saiu da aba enquanto carregava
    E.nivel = nivel; E.perfil = perfil;
    if (!E.nivelVer) E.nivelVer = (nivel && nivel.nivel) || "A1";
    if (!perfil.prefs || !perfil.prefs.idioma) { escolher(container, app, 1); return; }
    pintarInicio(container, app);
  }

  /* ---------- 1ª visita: a pessoa escolhe o idioma e a prova-meta ---------- */
  function escolher(container, app, passo, sel = {}) {
    const esc = app.esc, I = IN(), atual = (E.perfil && E.perfil.prefs) || {};
    if (passo === 1) {
      container.innerHTML = `<div class="page" style="max-width:820px">${app.pageHead("Qual idioma você quer aprender?", "Escolha o idioma e, em seguida, a prova que você quer estar pronto para fazer.")}
        <div class="idm-escolha">${IDIOMAS.map(l => `<button type="button" class="opt idm-lingua ${l.k === (atual.idioma || "") ? "on" : ""}" data-lingua="${l.k}" ${l.ativo ? "" : "disabled"}>
          <span class="idm-band">${l.bandeira}</span><b>${esc(l.nome)}</b><span>${l.ativo ? `Curso completo · ${esc(l.prova)}` : `Em breve · ${esc(l.prova)}`}</span></button>`).join("")}</div>
        <p class="hint">Por enquanto só o Inglês está disponível. Os outros idiomas chegam nas próximas atualizações.</p></div>`;
      container.onclick = e => { const b = e.target.closest("[data-lingua]"); if (b && !b.disabled) escolher(container, app, 2, { idioma: b.dataset.lingua }); };
      return;
    }
    container.innerHTML = `<div class="page" style="max-width:820px">${app.pageHead("Qual prova você quer fazer?", "O curso monta a sua trilha até essa prova. Dá para mudar quando quiser.")}
      <div class="idm-escolha">${I.METAS.map(m => `<button type="button" class="opt idm-meta ${m.nivel === (atual.meta || "") ? "on" : ""}" data-meta="${m.nivel}"><span class="idm-band">${m.nivel}</span><b>${esc(m.nome)}</b><span>${esc(m.desc)}</span></button>`).join("")}
        <button type="button" class="opt idm-meta" data-meta="?"><span class="idm-band">?</span><b>Ainda não sei</b><span>Começamos com o B2 First, o mais pedido. Você troca depois.</span></button></div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" type="button" data-volta>Voltar</button></div></div>`;
    container.onclick = async e => {
      if (e.target.closest("[data-volta]")) { escolher(container, app, 1, sel); return; }
      const b = e.target.closest("[data-meta]"); if (!b) return;
      container.querySelectorAll("[data-meta]").forEach(x => x.disabled = true);
      try {
        const prefs = await Srv().savePrefs(app.uid(), { idioma: sel.idioma || "ingles", meta: b.dataset.meta === "?" ? "B2" : b.dataset.meta });
        E.perfil = { ...(E.perfil || {}), prefs };
      } catch (err) { app.toast("Não foi possível salvar agora. Tente de novo."); container.querySelectorAll("[data-meta]").forEach(x => x.disabled = false); return; }
      pintarInicio(container, app);
      if (!E.nivel) perguntarNivelamento(container, app);
    };
  }
  function perguntarNivelamento(container, app) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="idm-t">
      <span class="eyebrow">Inglês · Cambridge</span><h3 id="idm-t">Vamos descobrir o seu nível?</h3>
      <p class="muted small">O teste fica mais difícil conforme você acerta, misturando questões de marcar, escrever e falar (leva de 5 a 15 minutos). Assim o curso começa no ponto certo.</p>
      <div class="opts opts-col"><button type="button" class="opt" data-idm="sim"><b>Fazer o teste de nivelamento</b><span>Recomendado</span></button>
        <button type="button" class="opt" data-idm="a1"><b>Começar do zero (A1)</b><span>Para quem está começando agora</span></button>
        <button type="button" class="opt" data-idm="nao"><b>Escolher o nível eu mesmo</b><span>Todos os níveis ficam abertos</span></button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => {
      const b = e.target.closest("[data-idm]"); if (!b && e.target !== bg) return;
      bg.remove();
      if (b && b.dataset.idm === "sim") iniciarTeste(container, app);
      else if (b && b.dataset.idm === "a1") { E.nivelVer = "A1"; pintarInicio(container, app); }
      else app.toast("Escolha o nível nas abas acima das trilhas. Você pode fazer o nivelamento quando quiser.");
    });
    setTimeout(() => { const b = bg.querySelector('[data-idm="sim"]'); if (b) b.focus(); }, 60);
  }
  function iniciarTeste(container, app) {
    E.tela = "teste";
    window.LAComp.CambridgeTestView.abrir(container, {
      app,
      aoConcluir: reg => { E.nivel = reg; E.nivelVer = reg.nivel; E.tela = "inicio"; render(container, app); },
      aoCancelar: () => { E.tela = "inicio"; render(container, app); }
    });
  }

  /* ---------- painel do curso ---------- */
  function pintarInicio(container, app) {
    E.tela = "inicio";
    const { esc, ico } = app, I = IN(), nv = E.nivelVer, perfil = E.perfil || { xp: 0, concluidos: {} }, prefs = perfil.prefs || {};
    const meu = E.nivel && E.nivel.nivel, P = prontidao(), metaNome = (I.METAS.find(m => m.nivel === P.meta) || {}).nome || I.EXAME[P.meta];
    const lingua = IDIOMAS.find(l => l.k === (prefs.idioma || "ingles"));
    const pct = P.total ? Math.round(P.feitas / P.total * 100) : 0;
    const concl = Object.keys(perfil.concluidos || {}).filter(k => k.split(":").length === 4 && (perfil.concluidos[k].pct == null || perfil.concluidos[k].pct >= APROVA)).length;
    container.innerHTML = `<div class="page idiomas">
      ${app.pageHead("Idiomas", `${lingua.bandeira} ${esc(lingua.nome)} · meta: <b>${esc(metaNome)}</b>`, `<button class="btn ghost" type="button" data-id="mudar">${ico("gear")}Idioma e meta</button><button class="btn" type="button" data-id="nivelamento">${ico("chart")}${meu ? "Refazer nivelamento" : "Fazer nivelamento"}</button>`)}
      <div class="card idm-meta-card">
        <div class="idm-meta-top"><div><span class="eyebrow">Sua trilha até o ${esc(metaNome)}</span>
          <h2 style="margin:4px 0 0">${P.pronto ? "Você está pronto para a prova! 🎉" : `${P.feitas} de ${P.total} aulas concluídas`}</h2>
          <p class="small muted" style="margin:4px 0 0">${P.niveis.length > 1 ? `Níveis ${esc(P.niveis[0])} a ${esc(P.niveis[P.niveis.length - 1])}` : `Nível ${esc(P.niveis[0])}`} · 4 habilidades · simulados do ${esc(P.meta)} com 70%+: ${P.simulados} de 4</p></div>
          <div class="idm-meta-pct">${pct}%</div></div>
        <div class="prog" style="height:10px"><i style="width:${pct}%"></i></div>
      </div>
      ${app.ehPro && !app.ehPro() ? `<div class="card flat idm-gratis"><span><span class="pro-tag">PRO</span> No plano grátis você faz o nivelamento e a <b>aula 1 de cada trilha</b>. Libere as 360 aulas e os simulados com o Logic Academy Pro.</span><button class="btn sm primary" type="button" data-id="pro">Ver planos · R$ 9,90/mês</button></div>` : ""}
      <div class="idm-resumo">
        <div class="stat"><div class="eyebrow">Seu nível</div><div class="v">${meu ? esc(meu) : "—"}</div><div class="s">${meu ? esc(I.EXAME[meu]) : "Faça o nivelamento"}</div></div>
        <div class="stat"><div class="eyebrow">XP de idiomas</div><div class="v">${perfil.xp}</div><div class="s">${window.LAService ? "cada habilidade também vale XP no perfil, 1 vez por dia" : "acertos + tempo estudado"}</div></div>
        <div class="stat"><div class="eyebrow">Aulas concluídas</div><div class="v">${concl}</div><div class="s">de ${I.NIVEIS.length * 4 * I.AULAS_POR_TRILHA} no curso todo</div></div>
      </div>
      <div class="idm-niveis" role="tablist" aria-label="Nível">${I.NIVEIS.map(n => { const tot = I.COMPETENCIAS.reduce((a, c) => a + feitasNivel(n, c.k), 0);
        return `<button type="button" role="tab" class="idm-nv ${n === nv ? "on" : ""}" data-id-nivel="${n}" aria-selected="${n === nv}"><b>${n}</b><small>${n === meu ? "seu nível" : n === P.meta ? "meta" : `${tot}/${4 * I.AULAS_POR_TRILHA}`}</small></button>`; }).join("")}</div>
      <p class="small muted" style="margin:0 0 12px">${esc(I.EXAME[nv])} · 4 trilhas de ${I.AULAS_POR_TRILHA} aulas · a aula ${I.AULAS_POR_TRILHA} de cada trilha é um simulado da prova</p>
      <div class="idm-grade">${I.COMPETENCIAS.map(c => cartaoTrilha(app, nv, c)).join("")}</div>
      <div data-lista></div>
      <div data-envios></div>
      ${perfil.historico && perfil.historico.length ? `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Últimos XP de idiomas</h3></div><div class="list">${perfil.historico.slice(0, 5).map(h => `<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><span class="small">${esc(h.motivo)}</span><b class="small">+${h.xp} XP</b></div>`).join("")}</div></div>` : ""}
      <p class="hint" style="margin-top:12px">Curso no formato das provas Cambridge English (Key, Preliminary, First, Advanced e Proficiency). Conteúdo próprio do Logic Academy, sem vínculo com a Cambridge University Press & Assessment.</p>
    </div>`;
    if (E.trilhaAberta) abrirLista(container, app, E.trilhaAberta, false);
    pintarEnvios(container, app);
    container.onclick = e => {
      if (e.target.closest("[data-envios]")) return;
      const nb = e.target.closest("[data-id-nivel]"); if (nb) { E.nivelVer = nb.dataset.idNivel; E.trilhaAberta = null; pintarInicio(container, app); return; }
      const a = e.target.closest("[data-aula]"); if (a) { const [skill, n] = a.dataset.aula.split(":"); abrirAula(container, app, E.nivelVer, skill, +n); return; }
      const l = e.target.closest("[data-lista-trilha]"); if (l) { const k = l.dataset.listaTrilha; E.trilhaAberta = E.trilhaAberta === k ? null : k;
        container.querySelectorAll("[data-lista-trilha]").forEach(x => x.setAttribute("aria-expanded", String(x.dataset.listaTrilha === E.trilhaAberta)));
        if (E.trilhaAberta) abrirLista(container, app, k, true); else container.querySelector("[data-lista]").innerHTML = ""; return; }
      const s = e.target.closest("[data-id-semana]"); if (s) { modalSemana(app, s.dataset.idSemana); return; }
      if (e.target.closest('[data-id="nivelamento"]')) { iniciarTeste(container, app); return; }
      if (e.target.closest('[data-id="pro"]')) { app.go("pro"); return; }
      if (e.target.closest('[data-id="mudar"]')) escolher(container, app, 1);
    };
  }
  function cartaoTrilha(app, nv, c) {
    const { esc, ico } = app, T = IN().AULAS_POR_TRILHA, f = feitasNivel(nv, c.k), px = proxima(nv, c.k);
    return `<div class="card idm-card"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h3 style="margin:0">${esc(c.nome)}</h3>${f === T ? `<span class="qb-st qb-resolvida ok">✓ Completa</span>` : ""}</div>
      <p class="small muted">${esc(c.desc)}</p>
      <div class="row" style="justify-content:space-between"><span class="small"><b>${f} de ${T}</b> aulas</span><span class="small muted">${px ? `Próxima: aula ${px}` : "Trilha concluída"}</span></div>
      <div class="prog"><i style="width:${f / T * 100}%"></i></div>
      <div class="row" style="gap:8px"><button class="btn primary sm" type="button" data-aula="${c.k}:${px || T}">${ico("play")}${px ? (px === 1 ? "Começar · Aula 1" : `Continuar · Aula ${px}`) : "Refazer o simulado"}${px && !podeAbrir(app, px) ? ` <span class="pro-tag">PRO</span>` : ""}</button>
        <button class="btn sm" type="button" data-lista-trilha="${c.k}" aria-expanded="${E.trilhaAberta === c.k}">${ico("list")}Ver as ${T} aulas</button>
        <button class="btn sm ghost" type="button" data-id-semana="${c.k}" title="Colocar a próxima aula no seu cronograma">${ico("cal")}Semana</button></div></div>`;
  }
  async function abrirLista(container, app, skill, rolar) {
    const box = container.querySelector("[data-lista]"), nv = E.nivelVer, esc = app.esc, c = comp(skill);
    box.innerHTML = `<div class="card" style="margin-top:14px"><div class="row muted"><span class="spinner"></span>Carregando as aulas…</div></div>`;
    let d; try { d = await carregarTrilha(nv, skill); } catch (e) { box.innerHTML = `<div class="card" style="margin-top:14px"><p class="small muted">As aulas desta trilha ainda não estão disponíveis. Tente de novo mais tarde.</p></div>`; return; }
    if (E.nivelVer !== nv || E.trilhaAberta !== skill || !box.isConnected) return;
    box.innerHTML = `<div class="card idm-lista" style="margin-top:14px"><div class="card-h"><h3>${esc(c.nome)} · ${esc(nv)} — todas as aulas</h3><span class="small muted">${feitasNivel(nv, skill)} de ${d.aulas.length} concluídas</span></div>
      <ol class="idm-aulas">${d.aulas.map(a => { const f = feito(nv, skill, a.n), ok = aprovada(nv, skill, a.n), lib = liberada(nv, skill, a.n), sim = a.n === d.aulas.length;
        return `<li class="${ok ? "feita" : lib ? "aberta" : "fechada"}"><button type="button" ${lib ? `data-aula="${skill}:${a.n}"` : "disabled"} class="idm-aula-li">
          <span class="idm-aula-n">${ok ? "✓" : lib ? a.n : "🔒"}</span>
          <span class="idm-aula-t"><b>${sim ? "Simulado · " : ""}Aula ${a.n} · ${esc(a.titulo)}</b><small>${esc(a.objetivo)}</small></span>
          <span class="idm-aula-s small">${f && f.pct != null ? `${Math.round(f.pct * 100)}%` : ""}${!podeAbrir(app, a.n) ? `<span class="pro-tag">PRO</span>` : lib && !(f && f.pct != null) ? "▶" : ""}</span></button></li>`; }).join("")}</ol>
      <p class="hint">A próxima aula abre quando você acerta pelo menos ${Math.round(APROVA * 100)}% da anterior.</p></div>`;
    if (rolar) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Adicionar à semana (próxima aula da trilha) ---------- */
  async function modalSemana(app, skill) {
    const { esc } = app, c = comp(skill), nv = E.nivelVer, n = proxima(nv, skill) || IN().AULAS_POR_TRILHA;
    let titulo = ""; try { titulo = (await carregarTrilha(nv, skill)).aulas[n - 1].titulo; } catch (e) {}
    const rotulo = `${c.curto} ${nv} · Aula ${n}`, dias = app.diasSemana(), bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<form class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="ids-t">
      <span class="eyebrow">Adicionar à semana</span><h3 id="ids-t">${esc(rotulo)}</h3>${titulo ? `<p class="small muted" style="margin:0">${esc(titulo)}</p>` : ""}
      <div class="field"><label for="ids-dia">Dia</label><select id="ids-dia">${dias.map(d => `<option value="${d.k}" ${d.hoje ? "selected" : ""}>${esc(d.n)}${d.hoje ? " (hoje)" : ""}</option>`).join("")}</select></div>
      <div class="grid2"><div class="field"><label for="ids-ini">Começa às</label><input type="time" id="ids-ini" value="19:00" required></div>
      <div class="field"><label for="ids-min">Duração (min)</label><input type="number" id="ids-min" min="10" max="180" step="5" value="${c.min}" required></div></div>
      <p class="small muted">O bloco entra na sua semana como <b>${MATERIA}</b>. Se o horário estiver ocupado, ele vai para o próximo horário livre do dia.</p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" data-ids="x">Cancelar</button><button class="btn primary" type="submit">Adicionar</button></div></form>`;
    document.body.appendChild(bg);
    const f = bg.querySelector("form");
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest('[data-ids="x"]')) bg.remove(); });
    f.onsubmit = async e => {
      e.preventDefault();
      const dia = f.querySelector("#ids-dia").value, inicio = f.querySelector("#ids-ini").value || "19:00", min = Math.max(10, Math.min(180, +f.querySelector("#ids-min").value || c.min));
      const bt = f.querySelector('[type="submit"]'); bt.disabled = true; bt.textContent = "Adicionando…";
      try {
        await Srv().addLanguageTaskToWeek(app.uid(), { idioma: "ingles", modulo: chaveAula(nv, skill, n), rotulo, dia, inicio, min });
        const r = app.adicionarBlocoNaSemana({ dia, inicio, min, materia: MATERIA, tarefa: titulo ? `${rotulo}: ${titulo}` : rotulo, tipo: "exercícios" });
        bg.remove(); app.toast(r.msg);
      } catch (err) { bt.disabled = false; bt.textContent = "Adicionar"; app.toast("Não foi possível adicionar agora. Tente de novo."); }
    };
  }

  /* ---------- Aula ---------- */
  async function abrirAula(container, app, nv, skill, n) {
    if (!podeAbrir(app, n)) { Ex().pararFala(); app.paywall("idiomas"); return; }
    E.tela = "aula";
    container.onclick = null;
    container.innerHTML = `<div class="page" style="max-width:860px"><div class="card row muted"><span class="spinner"></span>Abrindo a aula…</div></div>`;
    let d; try { d = await carregarTrilha(nv, skill); } catch (e) { app.toast("Não foi possível abrir a aula agora."); pintarInicio(container, app); return; }
    const a = d.aulas[n - 1]; if (!a) { pintarInicio(container, app); return; }
    const { esc, ico } = app, c = comp(skill), T = d.aulas.length, sim = n === T, m = a.material || {};
    const res = { ok: 0, total: 0, pulados: 0 };
    let i = 0, resTarefa = null;
    const sair = () => { Ex().pararFala(); pararGravacao(); E.tela = "inicio"; pintarInicio(container, app); scrollTo(0, 0); };
    function topo() {
      return `<div class="row idm-aula-topo"><button class="btn ghost sm" type="button" data-a="voltar">${ico("back")}Aulas</button>
        <span class="pill solid">${esc(nv)}</span><span class="pill">${esc(c.curto)} · ${sim ? "Simulado" : `Aula ${n} de ${T}`}</span>
        <button class="btn sm" type="button" data-a="crono" style="margin-left:auto" title="Conta o tempo como Inglês e vale XP">${ico("watch")}Estudar com cronômetro</button></div>`;
    }
    const vocabHtml = () => (a.vocab || []).length ? `<div class="idm-vocab">${a.vocab.map((v, k) => `<button type="button" class="idm-voc" data-voc="${k}" title="Ouvir"><b>${esc(v.en)}</b><span>${esc(v.pt)}</span></button>`).join("")}</div>` : "";
    const frasesHtml = () => (m.frases_uteis || []).length ? `<p class="small"><b>Frases úteis:</b> ${m.frases_uteis.map(x => `<span class="idm-frase">${esc(x)}</span>`).join(" ")}</p>` : "";
    function materialHtml(fechado) {
      if (skill === "reading") return `<details class="idm-mat" ${fechado ? "" : "open"}><summary><b>📄 ${esc(m.titulo || "Texto")}</b><span class="small muted">mostrar/esconder</span></summary><div class="idm-texto">${esc(m.texto).replace(/\n/g, "<br>")}</div></details>`;
      if (skill === "listening") return `<div class="idm-player"><button class="btn primary" type="button" data-a="ouvir">▶ Ouvir o áudio</button>
        <label class="small row" style="gap:6px">Velocidade <select data-vel><option value="0.8">Devagar</option><option value="0.95" selected>Normal</option><option value="1.1">Rápida</option></select></label>
        <span class="small muted">${esc(m.titulo || "")} · ouça quantas vezes quiser (na prova são duas).</span></div>`;
      if (skill === "writing") return `<details class="idm-mat" ${fechado ? "" : "open"}><summary><b>✍️ Tarefa da aula (${esc(m.genero || "")}, ${m.min}–${m.max} palavras)</b><span class="small muted">mostrar/esconder</span></summary><div class="idm-texto">${esc(m.tarefa).replace(/\n/g, "<br>")}</div></details>`;
      return `<details class="idm-mat" ${fechado ? "" : "open"}><summary><b>🗣️ Tarefa da aula (${m.segundos} s)</b><span class="small muted">mostrar/esconder</span></summary><div class="idm-texto">${esc(m.tarefa).replace(/\n/g, "<br>")}</div>${frasesHtml()}</details>`;
    }
    // 1) apresentação
    function intro() {
      container.innerHTML = `<div class="page idiomas" style="max-width:860px">${topo()}
        <div class="card stack"><span class="eyebrow">${sim ? `Simulado · ${esc(IN().EXAME[nv])}` : `${esc(c.nome)} · Aula ${n}`}</span><h2 style="margin:0">${esc(a.titulo)}</h2>
          <p style="margin:0">${esc(a.objetivo)}</p><p class="small muted" style="margin:0">Foco: ${esc(a.foco)}</p>
          <ul class="idm-expl">${(a.explicacao || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          ${vocabHtml()}
          ${skill === "reading" || skill === "listening" ? "" : materialHtml(false)}
          <p class="small muted">${a.exercicios.length} exercícios alternando marcar ☑, escrever ✎ e falar 🎙${skill === "writing" || skill === "speaking" ? ", e no fim a tarefa livre corrigida pela IA" : ""}. Para abrir a próxima aula, acerte ${Math.round(APROVA * 100)}%.</p>
          <div class="row"><button class="btn primary" type="button" data-a="comecar">${ico("play")}Começar</button></div></div></div>`;
      ligar();
    }
    // 2) exercícios (com o texto ou o áudio sempre à mão)
    function exercicio() {
      const ex = a.exercicios[i], tot = a.exercicios.length;
      container.innerHTML = `<div class="page idiomas" style="max-width:860px">${topo()}
        ${skill === "reading" || skill === "listening" ? materialHtml(i > 0 && skill === "reading" && innerWidth < 700) : ""}
        <div class="card stack idm-ex-card"><div class="row" style="justify-content:space-between"><span class="eyebrow">Exercício ${i + 1} de ${tot}</span><span class="small muted">${res.ok} certos</span></div>
          <div class="prog"><i style="width:${i / tot * 100}%"></i></div><div data-ex-area></div></div></div>`;
      ligar();
      Ex().render(container.querySelector("[data-ex-area]"), ex, {
        app, rotuloContinuar: i === tot - 1 ? (skill === "writing" || skill === "speaking" ? "Ir para a tarefa" : "Ver resultado") : "Próximo",
        aoResultado: (ok, info) => { res.total++; if (info.pulado) res.pulados++; if (ok) res.ok++; },
        aoContinuar: () => { i++; if (i < tot) exercicio(); else if (skill === "writing" || skill === "speaking") tarefa(); else fim(); scrollTo(0, 0); }
      });
    }
    // 3) tarefa livre (writing/speaking) corrigida pela IA
    function tarefa() {
      const pode = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
      container.innerHTML = `<div class="page idiomas" style="max-width:860px">${topo()}
        <div class="card stack"><span class="eyebrow">Tarefa final · ${skill === "writing" ? esc(m.genero) : "fala livre"}</span>
          <div class="idm-texto">${esc(m.tarefa).replace(/\n/g, "<br>")}</div>
          ${skill === "writing" ? `${(m.checklist || []).length ? `<details><summary class="small">Antes de enviar, confira</summary><ul class="small">${m.checklist.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
            <textarea class="idm-editor" rows="12" spellcheck="true" lang="en" placeholder="Write your answer here…" aria-label="Sua resposta em inglês"></textarea>
            <div class="row" style="justify-content:space-between"><span class="small muted" data-contador>0 palavras · meta ${m.min}–${m.max}</span>
            <div class="row"><button class="btn ghost" type="button" data-a="pular">Pular tarefa</button><button class="btn primary" type="button" data-enviar-w>Enviar para o Mentor</button></div></div>`
          : `${frasesHtml()}
            ${pode ? `<div class="idm-rec"><button class="btn primary" type="button" data-rec>🎙️ Gravar resposta</button><span class="mono" data-rec-t>0:00 / ${fmt(m.segundos)}</span></div>
            <audio controls hidden data-rec-audio></audio>
            <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-a="pular">Pular tarefa</button><button class="btn" type="button" data-enviar-s disabled>Enviar para o Mentor</button></div>`
            : `<p class="small muted">Seu navegador não permite gravar áudio. Pratique em voz alta por ${m.segundos} segundos e continue.</p><div class="row"><button class="btn primary" type="button" data-a="pular">Continuar</button></div>`}`}
          <div data-previa></div>
          <details><summary class="small">Ver uma resposta-modelo</summary><p class="small idm-texto">${esc(m.modelo).replace(/\n/g, "<br>")}</p></details>
          <div class="row" data-fim hidden><button class="btn primary" type="button" data-a="fim">Ver resultado da aula</button></div></div></div>`;
      ligar();
      ligarTarefa(container, app, { nv, m, chave: chaveAula(nv, skill, n), pronto: r => { resTarefa = r; const f = container.querySelector("[data-fim]"); if (f) f.hidden = false; } });
    }
    // 4) resultado
    async function fim() {
      Ex().pararFala();
      const pct = res.total ? res.ok / res.total : 0, passou = pct >= APROVA, prox = n < T ? n + 1 : null;
      container.innerHTML = `<div class="page idiomas" style="max-width:860px">${topo()}<div class="card stack" style="align-items:center;text-align:center"><span class="spinner"></span><p class="muted">Salvando seu resultado…</p></div></div>`;
      let ganho = 0;
      try {
        const xp = res.ok * XP.acerto + (resTarefa && resTarefa.enviado ? XP.tarefa + (resTarefa.nota ? Math.round(resTarefa.nota / 2) : 0) : 0);
        ganho = await darXP(app, xp, `${c.curto} ${nv} · Aula ${n}: ${res.ok}/${res.total}`, chaveAula(nv, skill, n), { pct, ok: res.ok, total: res.total, nota: (resTarefa && resTarefa.nota) || null }, passou);
      } catch (e) { app.toast("Não foi possível salvar o resultado. Confira sua internet."); }
      const trans = skill === "listening" ? `<details class="idm-trans card" style="margin-top:14px"><summary>Transcrição do áudio</summary><p>${(m.falas || []).map(f => `<b>${esc(f.p)}:</b> ${esc(f.t)}`).join("<br>")}</p></details>` : "";
      container.innerHTML = `<div class="page idiomas" style="max-width:860px">${topo()}
        <div class="card stack idm-fim" style="align-items:center;text-align:center">
          <div class="idm-fim-pct ${passou ? "ok" : "no"}">${Math.round(pct * 100)}%</div>
          <h2 style="margin:0">${passou ? (sim ? "Simulado concluído!" : "Aula concluída!") : "Quase lá!"}</h2>
          <p class="muted">Você acertou ${res.ok} de ${res.total} exercícios${res.pulados ? ` (${res.pulados} de fala pulados)` : ""}${ganho ? ` · <b>+${ganho} XP</b>` : ""}.</p>
          <p class="small muted" style="max-width:52ch">${passou ? (prox ? `A aula ${prox} foi liberada.` : `Você terminou a trilha de ${esc(c.nome)} do ${esc(nv)}!`) : `Para liberar a próxima aula, acerte pelo menos ${Math.round(APROVA * 100)}%. Revise a explicação e tente de novo.`}</p>
          <div class="row" style="justify-content:center">${passou && prox ? `<button class="btn primary" type="button" data-a="prox">Próxima: aula ${prox}</button>` : ""}
            <button class="btn ${passou && prox ? "" : "primary"}" type="button" data-a="refazer">Refazer esta aula</button>
            <button class="btn ghost" type="button" data-a="voltar">Voltar às aulas</button></div></div>${trans}</div>`;
      ligar();
    }
    function ligar() {
      container.onclick = e => {
        const v = e.target.closest("[data-voc]"); if (v) { Ex().falar(a.vocab[+v.dataset.voc].en, { rate: 0.85 }); return; }
        const b = e.target.closest("[data-a]"); if (!b) return;
        const x = b.dataset.a;
        if (x === "voltar") sair();
        else if (x === "crono") app.estudarComCronometro(MATERIA);
        else if (x === "comecar") { i = 0; exercicio(); scrollTo(0, 0); }
        else if (x === "ouvir") {
          if (window.speechSynthesis && speechSynthesis.speaking) { Ex().pararFala(); b.textContent = "▶ Ouvir o áudio"; return; }
          const sel = container.querySelector("[data-vel]"); b.textContent = "■ Parar";
          Ex().falar(m.falas, { rate: +((sel && sel.value) || 0.95) }).then(() => { if (b.isConnected) b.textContent = "▶ Ouvir de novo"; });
        }
        else if (x === "pular") { resTarefa = { enviado: false }; fim(); }
        else if (x === "fim") fim();
        else if (x === "prox") abrirAula(container, app, nv, skill, n + 1);
        else if (x === "refazer") abrirAula(container, app, nv, skill, n);
      };
    }
    intro(); scrollTo(0, 0);
  }
  const fmt = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;

  // tarefa livre: redação (writing) ou gravação (speaking), corrigidas pela IA do mentor
  function ligarTarefa(container, app, t) {
    const $ = s => container.querySelector(s), { m, nv, chave } = t;
    const ed = $(".idm-editor");
    if (ed) {
      const cont = $("[data-contador]"), conta = () => (ed.value.match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;
      ed.oninput = () => { const n = conta(); cont.textContent = `${n} palavras · meta ${m.min}–${m.max}`; cont.classList.toggle("txt-on", n >= m.min && n <= m.max); };
      $("[data-enviar-w]").onclick = async ev => {
        const n = conta(); if (n < Math.min(15, m.min)) { app.toast("Escreva um pouco mais antes de enviar."); return; }
        const b = ev.currentTarget; b.disabled = true; b.textContent = "O mentor está corrigindo…"; ed.readOnly = true;
        $("[data-previa]").innerHTML = `<div class="idm-previa row" style="gap:10px"><span class="spinner"></span><span class="small muted">A IA está lendo sua redação com os critérios Cambridge. Leva uns 10 a 30 segundos.</span></div>`;
        try {
          const r = await Srv().submitWriting(app.uid(), { modulo: chave, nivel: nv, texto: ed.value, minPalavras: m.min, maxPalavras: m.max, prompt: m.tarefa, genero: m.genero });
          b.textContent = "Enviado ✓"; const pul = $('[data-a="pular"]'); if (pul) pul.hidden = true;
          $("[data-previa]").innerHTML = `<div class="idm-previa"><b>${r.correcao ? "Correção do mentor" : "Enviado ao mentor!"}</b>
            ${r.correcao ? correcaoHtml(app, r) : `<p class="small muted">${!window.LAService ? "Modo visitante: entre com sua conta para receber a correção da IA." : "A IA não conseguiu corrigir agora. Sua redação ficou salva: peça a correção de novo em “Correções do mentor”."}</p><ul class="small">${(r.previa || []).map(d => `<li>${app.esc(d)}</li>`).join("")}</ul>`}</div>`;
          t.pronto({ enviado: true, nota: r.correcao ? r.correcao.nota : null });
        } catch (e) { b.disabled = false; ed.readOnly = false; b.textContent = "Enviar para o Mentor"; $("[data-previa]").innerHTML = ""; app.toast("Não foi possível enviar agora. Confira sua internet."); }
      };
    }
    const rec = $("[data-rec]");
    if (rec) {
      const tEl = $("[data-rec-t]"), au = $("[data-rec-audio]"), env = $("[data-enviar-s]");
      let blob = null, dur = 0;
      rec.onclick = async () => {
        if (E.gravacao) { E.gravacao.parar(); return; }
        Ex().pararFala();
        let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch (e) { app.toast("Permita o microfone para gravar sua resposta."); return; }
        const partes = [], mr = new MediaRecorder(stream), t0 = Date.now();
        mr.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
        mr.onstop = () => { stream.getTracks().forEach(x => x.stop()); clearInterval(E.gravacao && E.gravacao.tick); E.gravacao = null;
          dur = (Date.now() - t0) / 1000; blob = new Blob(partes, { type: mr.mimeType || "audio/webm" });
          au.src = URL.createObjectURL(blob); au.hidden = false; env.disabled = dur < 3; rec.textContent = "🎙️ Gravar de novo"; };
        E.gravacao = { parar: () => { if (mr.state !== "inactive") mr.stop(); }, tick: setInterval(() => { const x = (Date.now() - t0) / 1000; tEl.textContent = `${fmt(x)} / ${fmt(m.segundos)}`; if (x >= m.segundos) E.gravacao.parar(); }, 250) };
        mr.start(500); rec.textContent = "■ Parar gravação";
      };
      env.onclick = async () => {
        if (!blob) return; env.disabled = true; env.textContent = "Enviando…";
        try {
          $("[data-previa]").innerHTML = `<div class="idm-previa row" style="gap:10px"><span class="spinner"></span><span class="small muted">A IA está ouvindo sua resposta. Leva uns 10 a 30 segundos.</span></div>`;
          const audio = window.LAService && blob.size < 6e6 ? { mime: (blob.type || "audio/webm").split(";")[0], b64: await paraBase64(blob) } : null;
          const r = await Srv().submitSpeaking(app.uid(), { modulo: chave, nivel: nv, segundos: dur, bytes: blob.size, prompt: m.tarefa, audio });
          env.textContent = "Enviado ✓"; const pul = $('[data-a="pular"]'); if (pul) pul.hidden = true;
          $("[data-previa]").innerHTML = `<div class="idm-previa"><b>${r.correcao ? "Avaliação do mentor" : "Áudio enviado!"}</b>
            ${r.correcao ? correcaoHtml(app, r) : `<p class="small muted">Você falou por ${Math.round(dur)} segundos. ${window.LAService ? "A IA não conseguiu avaliar o áudio agora; grave e envie de novo daqui a pouco." : "Modo visitante: entre com sua conta para receber a avaliação da IA."}</p>`}</div>`;
          t.pronto({ enviado: true, nota: r.correcao ? r.correcao.nota : null });
        } catch (e) { env.disabled = false; env.textContent = "Enviar para o Mentor"; $("[data-previa]").innerHTML = ""; app.toast("Não foi possível enviar agora. Confira sua internet."); }
      };
    }
  }

  async function darXP(app, xp, motivo, chave, resultado, passou) {
    let ganho = 0;
    if (xp) ganho = (await Srv().addLanguageXP(app.uid(), xp, motivo)).ganho;
    if (chave) await Srv().markModuleDone(app.uid(), chave, resultado || {});
    E.perfil = await Srv().getLanguageProfile(app.uid());
    // XP no perfil: uma vez por dia por habilidade, conferido pelo servidor (só aula aprovada)
    const k = chave && chave.split(":")[2];
    if (k && passou && app.xpPerfil) app.xpPerfil(k);
    return ganho;
  }

  const paraBase64 = blob => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.onerror = no; fr.readAsDataURL(blob); });
  // correção devolvida pela IA (writing ou speaking)
  function correcaoHtml(app, env) {
    const c = env.correcao, esc = app.esc; if (!c) return "";
    return `<div class="idm-corr">
      <div class="idm-nota"><b>${c.nota}</b><span>/20</span></div>
      ${c.resumo ? `<p>${esc(c.resumo)}</p>` : ""}
      ${c.transcricao ? `<details><summary class="small">O que a IA entendeu da sua fala</summary><p class="small idm-texto">${esc(c.transcricao)}</p></details>` : ""}
      <div class="idm-crit">${(c.criterios || []).map(k => `<div><div class="row" style="justify-content:space-between"><b class="small">${esc(k.nome)}</b><span class="small mono">${k.nota}/5</span></div><div class="prog"><i style="width:${k.nota * 20}%"></i></div><p class="small muted">${esc(k.comentario)}</p></div>`).join("")}</div>
      ${(c.erros || []).length ? `<div><b class="small">Correções</b><ul class="small idm-erros">${c.erros.map(e => `<li><s>${esc(e.trecho)}</s> → <b>${esc(e.correcao)}</b>${e.explicacao ? ` <span class="muted">· ${esc(e.explicacao)}</span>` : ""}</li>`).join("")}</ul></div>` : ""}
      ${(c.dicas || []).length ? `<div><b class="small">Dicas</b><ul class="small">${c.dicas.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
      ${c.versaoMelhorada ? `<details><summary class="small">Ver um trecho reescrito no nível ${esc(env.nivel || "")}</summary><p class="small idm-texto">${esc(c.versaoMelhorada)}</p></details>` : ""}
    </div>`;
  }
  // lista "Correções do mentor" no painel (só com conta)
  async function pintarEnvios(container, app) {
    const box = container.querySelector("[data-envios]"); if (!box || !window.LAService || !window.LAService.getSubmissions) return;
    let lista = []; try { lista = await window.LAService.getSubmissions(app.uid(), 8); } catch (e) { box.innerHTML = ""; return; }
    if (!lista.length || !box.isConnected) { box.innerHTML = ""; return; }
    const esc = app.esc, data = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    box.innerHTML = `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Correções do mentor</h3></div><div class="list">${lista.map(e => `<details class="idm-env">
      <summary><span class="pill">${e.tipo === "writing" ? "Writing" : "Speaking"} · ${esc(e.nivel)}</span><span class="small muted">${data(e.em)}</span>
      ${e.correcao ? `<b class="small">${e.correcao.nota}/20</b>` : `<span class="small muted">sem correção</span>`}</summary>
      ${e.correcao ? correcaoHtml(app, e) : `<p class="small muted">A IA não conseguiu corrigir na hora.</p>${e.tipo === "writing" ? `<button class="btn sm" type="button" data-refazer="${esc(e.id)}">Pedir correção de novo</button>` : ""}`}
      ${e.texto ? `<details><summary class="small">Seu texto</summary><p class="small idm-texto">${esc(e.texto).replace(/\n/g, "<br>")}</p></details>` : ""}</details>`).join("")}</div></div>`;
    box.onclick = async ev => {
      const b = ev.target.closest("[data-refazer]"); if (!b) return;
      b.disabled = true; b.textContent = "Corrigindo…";
      try { await window.LAService.retryWriting(app.uid(), b.dataset.refazer); app.toast("Correção pronta!"); pintarEnvios(container, app); }
      catch (e) { b.disabled = false; b.textContent = "Pedir correção de novo"; app.toast("A IA ainda não conseguiu corrigir. Tente mais tarde."); }
    };
  }
  function pararGravacao() { if (E.gravacao) E.gravacao.parar(); }

  // tempo de cronômetro/pomodoro em "Inglês" vira XP de idiomas (1 XP por minuto)
  async function xpPorTempo(uid, minutos) {
    const xp = Math.floor(minutos * XP.porMinuto);
    if (xp > 0) { await Srv().addLanguageXP(uid, xp, `${Math.round(minutos)} min de estudo de Inglês`); E.perfil = null; }
    return xp;
  }
  function sairDaAba() { if (window.LAComp.Exercicio) Ex().pararFala(); pararGravacao(); }
  (window.LAComp = window.LAComp || {}).IdiomasView = { render, xpPorTempo, sairDaAba, MATERIA, XP };
})();
