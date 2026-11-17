/* Trilha das missões (PISM 1 e ENEM) — caminho de etapas, no estilo de jogo de idiomas:
   - Dois guias: "Guia do ano" (fevereiro a novembro) e "Reta final" (6 semanas). Dados em missoes/<missão>/trilha.json.
   - Cada etapa: o que estudar (com atalho para a página do livro na Biblioteca) + treino com questões reais da prova.
   - Acertou 60% ou mais → etapa concluída: estrelas, XP, ofensiva (dias seguidos) e animação de comemoração.
   - O progresso fica na conta (documento "trilha").
   Integração: LAComp.Trilha.render(container, app, cfg) — app: { esc, md, ler, gravar, toast, irLivro(id, pag) };
   cfg: { id, dir, arq (arquivo de questões), filtro(q), rotulo } — sem cfg, abre a do PISM 1. */
(function () {
  "use strict";
  let APP = null, BOX = null;
  const PISM1 = { id: "pism1", dir: "missoes/pism1", arq: "pism", filtro: q => q.mo === "I", rotulo: "PISM" };
  let CFG = PISM1;
  const ST = { dados: {}, prog: null, guia: {}, questoes: {}, quiz: null };
  const esc = s => APP.esc(s);
  const L = "ABCDE";
  const AREA = { mat: "matematica", fis: "natureza", qui: "natureza", bio: "natureza", his: "humanas", geo: "humanas", fil: "humanas", soc: "humanas", por: "linguagens", lit: "linguagens", art: "linguagens", edf: "linguagens", tic: "linguagens", ing: "linguagens", esp: "linguagens" };
  const NOME = { mat: "Matemática", por: "Português", lit: "Literatura", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", fil: "Filosofia", soc: "Sociologia", art: "Artes", edf: "Educação Física", tic: "Tecnologias da informação", ing: "Inglês", esp: "Espanhol" };
  const ICO = { mat: "➗", por: "📖", lit: "✒️", fis: "🚀", qui: "⚗️", bio: "🧬", his: "🏛️", geo: "🌍", fil: "🦉", soc: "🤝", art: "🎨", edf: "⚽", tic: "💻", ing: "🇬🇧", esp: "🇪🇸", desafio: "⚔️", simulado: "📝", trofeu: "🏆" };
  const lista_m = m => Array.isArray(m) ? m : [m];
  const icoDe = e => ICO[e.tipo === "licao" ? lista_m(e.m)[0] : e.tipo] || "⭐";
  const ONDA = [0, 55, 85, 55, 0, -55, -85, -55];
  const hoje = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  /* ---------- dados e progresso ---------- */
  async function carregar() {
    const id = CFG.id;
    if (!ST.dados[id]) { const r = await fetch(CFG.dir + "/trilha.json"); if (!r.ok) throw new Error(r.status); ST.dados[id] = await r.json(); }
    if (!ST.prog) { let d = null; try { d = await APP.ler("trilha"); } catch (e) { } ST.prog = (d && typeof d === "object") ? d : {}; }
    const p = ST.prog[id] = ST.prog[id] || {}; p.lib = p.lib || {}; p.dias = p.dias || []; p.xp = p.xp || 0;
    const ids = ST.dados[id].guias.map(g => g.id); ids.forEach(k => { p[k] = p[k] || {}; });   // cada guia (ex.: ano/final ou base/consolida/final) guarda o seu progresso
    if (!ST.guia[id]) { let g = null; try { g = localStorage.getItem(chaveGuia()); } catch (e) { } ST.guia[id] = ids.includes(g) ? g : ids[0]; }
  }
  const chaveGuia = () => "la_trilha_guia" + (CFG.id === "pism1" ? "" : "_" + CFG.id);
  const DADOS = () => ST.dados[CFG.id];
  const P = () => ST.prog[CFG.id];
  function salvar() { try { APP.gravar("trilha", ST.prog); } catch (e) { } }
  function guiaAtual() { return DADOS().guias.find(g => g.id === ST.guia[CFG.id]) || DADOS().guias[0]; }
  function etapasDe(g) { const out = []; g.unidades.forEach((u, ui) => u.etapas.forEach((e, ei) => out.push({ e, u, ui, ei }))); return out; }
  const feito = (gid, id) => P()[gid][id];
  function ofensiva() {
    const ds = new Set(P().dias); let n = 0; const d = new Date();
    if (!ds.has(hoje())) d.setDate(d.getDate() - 1);   // a ofensiva só quebra se ontem também ficou sem estudar
    for (;;) { const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); if (!ds.has(k)) break; n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // etapa liberada: a primeira; a seguinte de uma concluída; ou a primeira de uma unidade que a pessoa escolheu começar
  function estado(g, lista, i) {
    const { e, ui, ei } = lista[i];
    if (feito(g.id, e.id)) return "feito";
    if (i === 0) return "atual";
    const ant = lista[i - 1];
    if (feito(g.id, ant.e.id)) return "atual";
    if (ei === 0 && P().lib[g.id + ":" + ui]) return "atual";
    if (ei > 0 && P().lib[g.id + ":" + ui] && lista.slice(i - ei, i).every(x => feito(g.id, x.e.id))) return "atual";
    return "bloq";
  }

  /* ---------- caminho ---------- */
  async function render(box, app, cfg) {
    APP = app; BOX = box; CFG = cfg || PISM1;
    BOX.innerHTML = `<div class="card">Carregando a trilha…</div>`;
    try { await carregar(); } catch (e) { BOX.innerHTML = `<div class="card"><b>Não foi possível abrir a trilha.</b> <span class="small muted">Confira a internet e tente de novo.</span></div>`; return; }
    caminho();
  }
  function caminho(focoId) {
    const g = guiaAtual(), lista = etapasDe(g), p = P();
    const nFeitas = lista.filter(x => feito(g.id, x.e.id)).length, estrelas = DADOS().guias.reduce((s, gg) => s + Object.values(p[gg.id] || {}).reduce((t, x) => t + (x.e || 0), 0), 0);
    const pct = Math.round(100 * nFeitas / lista.length);
    let i = 0, atualId = null;
    const uns = g.unidades.map((u, ui) => {
      const ini = i; const nos = u.etapas.map((e, ei) => {
        const k = i++, est = estado(g, lista, k); if (est === "atual" && !atualId) atualId = e.id;
        const f = feito(g.id, e.id), ic = icoDe(e);
        return `<div class="tr-no-l" style="--dx:${ONDA[k % ONDA.length]}px">
          ${est === "atual" && atualId === e.id ? `<span class="tr-balao">${nFeitas ? "CONTINUAR" : "COMEÇAR"}</span>` : ""}
          <button type="button" class="tr-no ${est} t-${e.tipo}" style="--cor:${u.cor}" data-no="${k}" aria-label="${esc(e.titulo)}${est === "bloq" ? " (bloqueada)" : est === "feito" ? " (concluída)" : ""}">
            <span class="tr-ic">${est === "bloq" ? "🔒" : ic}</span></button>
          ${f ? `<span class="tr-est">${"★".repeat(f.e || 1)}${"☆".repeat(3 - (f.e || 1))}</span>` : ""}
          <span class="tr-rot">${esc(e.titulo)}</span></div>`;
      }).join("");
      const feitasU = u.etapas.filter(e => feito(g.id, e.id)).length, alcançada = estado(g, lista, ini) !== "bloq";
      return `<section class="tr-unid" style="--cor:${u.cor}">
        <div class="tr-cab"><div><small>Unidade ${ui + 1}</small><b>${esc(u.titulo)}</b><span>${feitasU}/${u.etapas.length} etapas</span></div>
          ${!alcançada ? `<button type="button" class="btn sm tr-pular" data-lib="${ui}">Começar daqui</button>` : feitasU === u.etapas.length ? `<span class="tr-ok">🏆</span>` : ""}</div>
        <div class="tr-nos">${nos}</div></section>`;
    }).join("");
    BOX.innerHTML = `<div class="tr">
      <div class="tr-topo">
        <div class="tr-guias" role="tablist">${DADOS().guias.map(x => `<button type="button" role="tab" class="qb-chip ${x.id === g.id ? "on" : ""}" aria-selected="${x.id === g.id}" data-guia="${x.id}">${x.icone} ${esc(x.nome)}</button>`).join("")}</div>
        <div class="tr-stats"><span title="Dias seguidos estudando na trilha">🔥 <b>${ofensiva()}</b></span><span title="Pontos de experiência">⚡ <b>${p.xp}</b> XP</span><span title="Estrelas">⭐ <b>${estrelas}</b></span><span title="Progresso deste guia">🎯 <b>${pct}%</b></span></div>
      </div>
      <p class="small muted tr-sub">${esc(g.sub)}</p>
      <div class="tr-barra"><span style="width:${pct}%"></span></div>
      ${uns}
    </div>`;
    BOX.querySelectorAll("[data-guia]").forEach(b => b.onclick = () => { ST.guia[CFG.id] = b.dataset.guia; try { localStorage.setItem(chaveGuia(), b.dataset.guia); } catch (e) { } caminho(); });
    BOX.querySelectorAll("[data-no]").forEach(b => b.onclick = () => abrirEtapa(g, lista, +b.dataset.no));
    BOX.querySelectorAll("[data-lib]").forEach(b => b.onclick = () => {
      if (!confirm("Começar a trilha por esta unidade? As anteriores continuam abertas para você fazer quando quiser.")) return;
      P().lib[g.id + ":" + b.dataset.lib] = true; salvar(); caminho();
    });
    const alvo = BOX.querySelector(focoId ? `.tr-no[data-no="${lista.findIndex(x => x.e.id === focoId)}"]` : ".tr-no.atual");
    if (alvo) setTimeout(() => { try { alvo.scrollIntoView({ block: "center", behavior: focoId ? "smooth" : "auto" }); } catch (e) { } if (focoId) alvo.classList.add("tr-pulo"); }, 60);
  }

  /* ---------- folha da etapa ---------- */
  function folha(html) {
    fecharFolha();
    const f = document.createElement("div"); f.className = "tr-folha-fundo"; f.id = "tr-folha";
    f.innerHTML = `<div class="tr-folha" role="dialog" aria-modal="true">${html}</div>`;
    f.addEventListener("click", e => { if (e.target === f) fecharFolha(); });
    document.body.appendChild(f); return f.firstElementChild;
  }
  function fecharFolha() { const f = document.getElementById("tr-folha"); if (f) f.remove(); }
  function abrirEtapa(g, lista, k) {
    const { e, u } = lista[k], est = estado(g, lista, k), f = feito(g.id, e.id);
    if (est === "bloq") { APP.toast("Conclua a etapa anterior para abrir esta. Ou toque em “Começar daqui” no topo da unidade."); return; }
    const mats = [...new Set(lista_m(e.m || []))].map(m => NOME[m] || m).join(e.tipo === "licao" ? " ou " : ", ");
    const el = folha(`<div class="tr-f-cab" style="--cor:${u.cor}"><span class="tr-f-ic">${icoDe(e)}</span><div><small>${esc(u.titulo)}</small><h3>${esc(e.titulo)}</h3><span class="small">${esc(mats || "")}</span></div></div>
      <p>${esc(e.dica || "")}</p>
      ${f ? `<p class="small">Você já concluiu: ${"★".repeat(f.e || 1)} · ${f.a}/${f.n} acertos. Pode refazer para ganhar mais estrelas.</p>` : ""}
      <div class="tr-f-bts">
        ${e.livro ? `<button type="button" class="btn" data-livro>📖 Estudar no livro (p. ${e.livro[1]})</button>` : ""}
        ${e.tipo === "trofeu" ? `<button type="button" class="btn primary" data-trofeu>🏆 Receber o troféu</button>` : `<button type="button" class="btn primary" data-ir>${e.tipo === "simulado" ? "📝 Começar simulado" : e.tipo === "desafio" ? "⚔️ Começar desafio" : "🎯 Começar treino"} · ${e.n} questões</button>`}
        <button type="button" class="btn ghost" data-x>Agora não</button></div>`);
    el.querySelector("[data-x]").onclick = fecharFolha;
    const lv = el.querySelector("[data-livro]"); if (lv) lv.onclick = () => { fecharFolha(); APP.irLivro(e.livro[0], e.livro[1]); };
    const ir = el.querySelector("[data-ir]"); if (ir) ir.onclick = () => { fecharFolha(); iniciarTreino(g, lista, k); };
    const tr = el.querySelector("[data-trofeu]"); if (tr) tr.onclick = () => { fecharFolha(); concluir(g, lista, k, 1, 1, true); };
  }

  /* ---------- treino (perguntas) ---------- */
  async function questoes(area) {
    const k = CFG.id + ":" + area;
    if (ST.questoes[k]) return ST.questoes[k];
    const r = await fetch(`questoes/${CFG.arq}-${area}.json`); if (!r.ok) throw new Error(r.status);
    return (ST.questoes[k] = (await r.json()).filter(q => CFG.filtro(q) && Number.isInteger(q.r)));
  }
  const embaralhar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  async function montar(e) {
    const ms = lista_m(e.m);
    const pools = {};
    for (const m of new Set(ms)) pools[m] = embaralhar((await questoes(AREA[m])).filter(q => q.m === m));
    if (e.tipo === "licao") {
      const todas = ms.flatMap(m => pools[m]);
      const certos = embaralhar(todas.filter(q => e.t.includes(q.t))), outros = embaralhar(todas.filter(q => !e.t.includes(q.t)));
      return certos.concat(outros).slice(0, e.n);
    }
    // matéria repetida na lista = peso maior (ex.: Matemática vale metade do 2º dia do ENEM)
    const out = [], usadas = new Set(), por = Math.ceil(e.n / ms.length), pos = {};
    ms.forEach(m => { let k = 0; for (const q of pools[m].slice(pos[m] || 0)) { pos[m] = (pos[m] || 0) + 1; if (usadas.has(q.id)) continue; usadas.add(q.id); out.push(q); if (++k >= por) break; } });
    return embaralhar(out).slice(0, e.n);
  }
  async function iniciarTreino(g, lista, k) {
    const { e } = lista[k];
    let qs;
    try { qs = await montar(e); } catch (x) { APP.toast("Não foi possível carregar as questões. Confira a internet."); return; }
    if (!qs.length) { APP.toast("Ainda não há questões para esta etapa."); return; }
    ST.quiz = { g, lista, k, qs, i: 0, acertos: 0, combo: 0, escolha: null, respondida: false };
    telaQuiz();
  }
  function telaQuiz() {
    const z = ST.quiz, q = z.qs[z.i], e = z.lista[z.k].e;
    const temTexto = (q.a || []).some(a => a && (a[0] || a[1]));
    const fundo = document.getElementById("tr-quiz") || Object.assign(document.createElement("div"), { id: "tr-quiz", className: "tr-quiz" });
    if (!fundo.isConnected) document.body.appendChild(fundo);
    document.documentElement.classList.add("tr-sem-rolagem");
    fundo.innerHTML = `<div class="tr-q-topo"><button type="button" class="tr-q-x" aria-label="Sair do treino">✕</button>
        <div class="tr-q-prog"><span style="width:${Math.round(100 * z.i / z.qs.length)}%"></span></div>
        <span class="tr-q-combo ${z.combo >= 2 ? "on" : ""}">🔥 ${z.combo}</span></div>
      <div class="tr-q-corpo"><small class="muted">${esc(e.titulo)} · questão ${z.i + 1} de ${z.qs.length} · ${esc(CFG.rotulo)} ${q.ano}</small>
        <div class="tr-q-enun">${APP.md(q.c)}${q.i ? APP.md(q.i) : ""}</div></div>
      ${temTexto ? `<div class="tr-q-alts tr-q-alts-t" role="group" aria-label="Alternativas">${(q.a || []).map((a, i) => `<button type="button" class="tr-alt tr-alt-t" data-alt="${i}"><b>${L[i]}</b><span>${a[0] ? APP.md(a[0]) : ""}${a[1] ? `<img src="${esc(a[1])}" alt="Alternativa ${L[i]}" loading="lazy">` : ""}</span></button>`).join("")}</div>`
        : `<div class="tr-q-alts" role="group" aria-label="Alternativas">${L.split("").map((l, i) => `<button type="button" class="tr-alt" data-alt="${i}">${l}</button>`).join("")}</div>`}
      <div class="tr-q-pe" id="tr-pe"><button type="button" class="btn primary tr-verif" disabled>Verificar</button></div>`;
    fundo.querySelector(".tr-q-x").onclick = () => { if (z.i === 0 || confirm("Sair do treino? O progresso desta etapa não será salvo.")) sairQuiz(); };
    fundo.querySelectorAll("[data-alt]").forEach(b => b.onclick = () => {
      if (z.respondida) return; z.escolha = +b.dataset.alt;
      fundo.querySelectorAll("[data-alt]").forEach(x => x.classList.toggle("sel", x === b));
      fundo.querySelector(".tr-verif").disabled = false; som("toque");
    });
    fundo.querySelector(".tr-verif").onclick = verificar;
    fundo.scrollTop = 0;
  }
  function verificar() {
    const z = ST.quiz, q = z.qs[z.i], fundo = document.getElementById("tr-quiz"); if (!z || z.respondida || z.escolha == null) return;
    z.respondida = true; const ok = z.escolha === q.r;
    if (ok) { z.acertos++; z.combo++; } else z.combo = 0;
    fundo.querySelectorAll("[data-alt]").forEach(x => { const i = +x.dataset.alt; x.disabled = true; if (i === q.r) x.classList.add("certa"); else if (i === z.escolha) x.classList.add("errada"); });
    const frases = ["Mandou bem!", "Isso aí!", "Perfeito!", "Arrasou!", "Excelente!"];
    const pe = fundo.querySelector("#tr-pe"); pe.className = "tr-q-pe " + (ok ? "ok" : "erro");
    pe.innerHTML = `<div class="tr-fb"><b>${ok ? (z.combo >= 3 ? `🔥 ${z.combo} seguidas!` : frases[Math.floor(Math.random() * frases.length)]) : "Quase!"}</b><span>${ok ? "+10 XP" : `Resposta certa: ${L[q.r]}`}</span></div>
      <button type="button" class="btn primary tr-cont">Continuar</button>`;
    som(ok ? "certo" : "errado");
    fundo.querySelector(".tr-q-combo").outerHTML = `<span class="tr-q-combo ${z.combo >= 2 ? "on" : ""}">🔥 ${z.combo}</span>`;
    const c = pe.querySelector(".tr-cont"); c.focus(); c.onclick = () => { z.i++; z.escolha = null; z.respondida = false; if (z.i < z.qs.length) telaQuiz(); else resultado(); };
  }
  function sairQuiz() { const f = document.getElementById("tr-quiz"); if (f) f.remove(); document.documentElement.classList.remove("tr-sem-rolagem"); ST.quiz = null; }
  function resultado() {
    const z = ST.quiz, n = z.qs.length, pct = z.acertos / n;
    sairQuiz();
    if (pct >= 0.6) concluir(z.g, z.lista, z.k, z.acertos, n, false);
    else {
      som("errado");
      const el = folha(`<div class="tr-falhou"><div class="tr-masc triste">🤔</div><h3>Quase lá!</h3><p>Você acertou <b>${z.acertos} de ${n}</b>. Precisa de ${Math.ceil(0.6 * n)} para concluir esta etapa.</p><p class="small muted">Dica: revise o conteúdo e tente de novo. Cada tentativa é treino.</p></div>
        <div class="tr-f-bts"><button type="button" class="btn primary" data-de-novo>Tentar de novo</button>${z.lista[z.k].e.livro ? `<button type="button" class="btn" data-livro>📖 Revisar no livro</button>` : ""}<button type="button" class="btn ghost" data-x>Voltar à trilha</button></div>`);
      el.querySelector("[data-x]").onclick = fecharFolha;
      el.querySelector("[data-de-novo]").onclick = () => { fecharFolha(); iniciarTreino(z.g, z.lista, z.k); };
      const lv = el.querySelector("[data-livro]"); if (lv) lv.onclick = () => { fecharFolha(); const e = z.lista[z.k].e; APP.irLivro(e.livro[0], e.livro[1]); };
    }
  }

  /* ---------- conclusão com comemoração ---------- */
  function concluir(g, lista, k, acertos, n, trofeu) {
    const { e, u } = lista[k], p = P(), antes = p[g.id][e.id], pct = acertos / n;
    const est = trofeu ? 3 : pct >= 0.9 ? 3 : pct >= 0.75 ? 2 : 1;
    const xp = trofeu ? 100 : acertos * 10 + 20 + (est - 1) * 10;
    const novoDia = !p.dias.includes(hoje());
    p[g.id][e.id] = { e: Math.max(est, (antes && antes.e) || 0), a: acertos, n, d: hoje() };
    p.xp += xp; if (novoDia) p.dias = p.dias.concat(hoje()).slice(-400);
    salvar();
    const fimUnidade = u.etapas.every(x => p[g.id][x.id]) && !(antes);
    comemorar({ titulo: trofeu ? "Trilha concluída!" : fimUnidade ? "Unidade concluída!" : "Etapa concluída!", sub: e.titulo, est, xp, acertos: trofeu ? null : acertos, n, ofensiva: ofensiva(), novoDia, grande: trofeu || fimUnidade, cor: u.cor },
      () => { const prox = lista[k + 1]; caminho(prox ? prox.e.id : e.id); });
  }
  function comemorar(o, depois) {
    const f = document.createElement("div"); f.className = "tr-festa" + (o.grande ? " grande" : ""); f.style.setProperty("--cor", o.cor);
    f.innerHTML = `<canvas class="tr-confete"></canvas>
      <div class="tr-festa-c">
        <div class="tr-masc">${o.grande ? "🏆" : "🎉"}</div>
        <h2>${esc(o.titulo)}</h2><p>${esc(o.sub)}</p>
        <div class="tr-estrelas">${[1, 2, 3].map(i => `<span class="tr-estrela ${i <= o.est ? "on" : ""}" style="--d:${0.35 + i * 0.25}s">★</span>`).join("")}</div>
        <div class="tr-ganhos">
          <div class="tr-ganho xp"><small>XP</small><b data-xp>+0</b></div>
          ${o.acertos != null ? `<div class="tr-ganho ac"><small>ACERTOS</small><b>${o.acertos}/${o.n}</b></div>` : ""}
          <div class="tr-ganho of"><small>OFENSIVA</small><b>🔥 ${o.ofensiva}</b></div>
        </div>
        ${o.novoDia ? `<p class="tr-novo-dia">${o.ofensiva > 1 ? `${o.ofensiva} dias seguidos estudando! Continue amanhã.` : "Você começou uma ofensiva! Volte amanhã para mantê-la."}</p>` : ""}
        <button type="button" class="btn primary tr-cont">Continuar</button>
      </div>`;
    document.body.appendChild(f);
    som(o.grande ? "fanfarra" : "vitoria");
    setTimeout(() => [1, 2, 3].forEach(i => { if (i <= o.est) setTimeout(() => som("estrela", i), (0.35 + i * 0.25) * 1000); }), 0);
    const xpEl = f.querySelector("[data-xp]"); let v = 0; const passo = Math.max(1, Math.round(o.xp / 30));
    const t = setInterval(() => { v = Math.min(o.xp, v + passo); xpEl.textContent = "+" + v; if (v >= o.xp) clearInterval(t); }, 40);
    confete(f.querySelector("canvas"), o.grande ? 260 : 140);
    const fechar = () => { clearInterval(t); f.classList.add("saindo"); setTimeout(() => { f.remove(); depois && depois(); }, 250); };
    const bt = f.querySelector(".tr-cont"); bt.onclick = fechar; setTimeout(() => bt.focus(), 300);
  }
  function confete(cv, qtd) {
    const ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cores = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ce82ff", "#ffc800"];
    const ps = Array.from({ length: qtd }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr, r: (4 + Math.random() * 6) * dpr, c: cores[Math.random() * cores.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
    let fim = performance.now() + 3200;
    (function quadro(t) {
      if (!cv.isConnected) return; ctx.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .45 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
      if (t < fim) requestAnimationFrame(quadro); else ctx.clearRect(0, 0, W, H);
    })(performance.now());
  }
  /* ---------- sons (sintetizados, sem arquivos) ---------- */
  let AC = null;
  function som(tipo, n) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume();
      const t0 = AC.currentTime, nota = (f, ini, dur, tipoO, vol) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = tipoO || "triangle"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t0 + ini); g.gain.exponentialRampToValueAtTime(vol || .18, t0 + ini + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + ini + dur); o.connect(g); g.connect(AC.destination); o.start(t0 + ini); o.stop(t0 + ini + dur + .05); };
      if (tipo === "toque") nota(660, 0, .06, "sine", .06);
      else if (tipo === "certo") { nota(784, 0, .12); nota(1175, .09, .22); }
      else if (tipo === "errado") { nota(220, 0, .18, "sawtooth", .08); nota(185, .14, .26, "sawtooth", .07); }
      else if (tipo === "estrela") nota(880 * Math.pow(1.26, (n || 1) - 1), 0, .3, "sine", .16);
      else if (tipo === "vitoria") [523, 659, 784, 1047].forEach((f, i) => nota(f, i * .09, .35));
      else if (tipo === "fanfarra") { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => nota(f, i * .11, .4, "square", .07)); [262, 330, 392].forEach(f => nota(f, .77, 1.2, "triangle", .1)); }
    } catch (e) { }
  }

  window.LAComp = window.LAComp || {};
  window.LAComp.Trilha = { render, _quiz: () => ST.quiz, sair() { sairQuiz(); fecharFolha(); document.querySelectorAll(".tr-festa").forEach(x => x.remove()); } };
})();
