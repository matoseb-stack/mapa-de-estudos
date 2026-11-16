/* Missões — trilhas guiadas para uma prova específica.
   Por enquanto: Missão PISM 1 (UFJF, Módulo I), com
   - foto da universidade e música tema (composta aqui mesmo, no navegador, sem arquivo e sem direitos de terceiros);
   - Raio-x da prova: o que mais e o que menos cai, em porcentagem, geral e por matéria (calculado das provas de 2009 a 2026);
   - Provas antigas para consultar (PDF);
   - Banco especializado: as questões de Módulo I do PISM, por assunto, dos que mais caem para os que menos caem.
   Integração: LAComp.Missoes.render(container, app) e LAComp.Missoes.parar(). */
(function () {
  "use strict";
  let APP = null, CONT = null;
  const ST = { aberta: null, aba: "raiox", raiox: null, provas: null, mat: "" };
  const esc = s => APP.esc(s);
  const SOM_KEY = "la_missao_som";
  const somLigado = () => { try { return localStorage.getItem(SOM_KEY) !== "0"; } catch (e) { return true; } };
  const MISSOES = [{
    id: "pism1", nome: "Missão PISM 1", sub: "UFJF · Módulo I (1ª série do ensino médio)",
    foto: "missoes/pism1/ufjf.webp", credito: "Foto: campus da UFJF, Juiz de Fora (Wikimedia Commons, domínio público)",
    texto: "Tudo o que você precisa para o Módulo I do PISM: o raio-x do que mais cai, as provas antigas e um banco só com questões do PISM 1."
  }];
  const COR = { por: "#2f80ed", lit: "#9b51e0", mat: "#eb5757", fis: "#f2994a", qui: "#27ae60", bio: "#219653", his: "#a0522d", geo: "#00a3a3" };

  /* ---------- música tema (sintetizada) ---------- */
  const M = { ctx: null, mestre: null, timer: null, prox: 0, passo: 0, tocando: false };
  const nota = n => 440 * Math.pow(2, (n - 69) / 12);
  // Lá menor épico: Am – F – C – G (cada acorde = 8 colcheias)
  const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const MELODIA = [76, null, 74, 72, 71, null, 72, 74, 72, null, 69, null, 67, 69, 71, null,
                   72, null, 71, 69, 67, null, 69, 72, 74, null, 71, null, 67, null, null, null];
  function tom(tipo, freq, ini, dur, vol, filtro) {
    const o = M.ctx.createOscillator(), g = M.ctx.createGain();
    o.type = tipo; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ini);
    g.gain.exponentialRampToValueAtTime(vol, ini + Math.min(0.08, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
    let ult = o;
    if (filtro) { const f = M.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filtro; o.connect(f); ult = f; }
    ult.connect(g); g.connect(M.mestre); o.start(ini); o.stop(ini + dur + 0.05);
  }
  function bumbo(t) {
    const o = M.ctx.createOscillator(), g = M.ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(M.mestre); o.start(t); o.stop(t + 0.32);
  }
  function chimbal(t) {
    const n = M.ctx.createBufferSource(), b = M.ctx.createBuffer(1, 2205, 44100), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b; const f = M.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    const g = M.ctx.createGain(); g.gain.value = 0.12; n.connect(f); f.connect(g); g.connect(M.mestre); n.start(t);
  }
  const COLCHEIA = 60 / 100 / 2; // 100 bpm
  function agendar() {
    while (M.prox < M.ctx.currentTime + 0.25) {
      const p = M.passo % 32, ac = ACORDES[Math.floor(p / 8)], t = M.prox, volta = Math.floor(M.passo / 32);
      if (p % 8 === 0) ac.forEach(n => tom("sawtooth", nota(n), t, COLCHEIA * 8, 0.035, 900));         // pad
      if (p % 4 === 0) tom("sine", nota(ac[0] - 12), t, COLCHEIA * 3.5, 0.22);                          // baixo
      tom("triangle", nota(ac[p % 3] + 12), t, COLCHEIA * 0.9, 0.05);                                   // arpejo
      if (p % 4 === 0) bumbo(t);
      if (p % 2 === 1) chimbal(t);
      if (volta % 2 === 1 && MELODIA[p] != null) tom("square", nota(MELODIA[p]), t, COLCHEIA * 1.6, 0.045, 2400); // tema
      M.prox += COLCHEIA; M.passo++;
    }
  }
  function tocar() {
    if (M.tocando || !somLigado()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      M.ctx = M.ctx || new AC(); if (M.ctx.state === "suspended") M.ctx.resume();
      M.mestre = M.ctx.createGain(); M.mestre.gain.setValueAtTime(0.0001, M.ctx.currentTime);
      M.mestre.gain.exponentialRampToValueAtTime(0.5, M.ctx.currentTime + 2.5); M.mestre.connect(M.ctx.destination);
      M.prox = M.ctx.currentTime + 0.1; M.passo = 0; M.tocando = true;
      M.timer = setInterval(agendar, 60); agendar();
    } catch (e) { M.tocando = false; }
    botaoSom();
  }
  function parar() {
    if (M.timer) clearInterval(M.timer); M.timer = null;
    if (M.mestre && M.ctx) { const g = M.mestre; try { g.gain.cancelScheduledValues(M.ctx.currentTime); g.gain.setValueAtTime(g.gain.value, M.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, M.ctx.currentTime + 0.6); } catch (e) { } setTimeout(() => { try { g.disconnect(); } catch (e) { } }, 800); }
    M.mestre = null; M.tocando = false; botaoSom();
  }
  function botaoSom() {
    const b = CONT && CONT.querySelector("#mis-som"); if (!b) return;
    b.textContent = M.tocando ? "🔊 Música: ligada" : "🔇 Música: desligada"; b.setAttribute("aria-pressed", M.tocando ? "true" : "false");
  }

  /* ---------- dados ---------- */
  async function json(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function dados() {
    if (!ST.raiox) [ST.raiox, ST.provas] = await Promise.all([json("missoes/pism1/raiox.json"), json("missoes/pism1/provas.json")]);
  }

  /* ---------- telas ---------- */
  function lista() {
    parar(); ST.aberta = null;
    CONT.innerHTML = `<div class="page mis-page">${APP.pageHead("Missões", "Trilhas completas para uma prova: o que mais cai, provas antigas e questões só dela.")}
      <div class="mis-lista">${MISSOES.map(m => `
        <button class="mis-cartao" type="button" data-mis="${m.id}" style="background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.78)),url('${m.foto}')">
          <span class="mis-selo">🎯 Missão</span><b>${esc(m.nome)}</b><span>${esc(m.sub)}</span><span class="btn sm primary" aria-hidden="true">Entrar na missão</span>
        </button>`).join("")}
        <div class="card mis-embreve"><b>Novas missões em breve</b><span class="small muted">Outras provas vão ganhar a sua missão aqui.</span></div>
      </div></div>`;
    CONT.querySelectorAll("[data-mis]").forEach(b => b.onclick = () => abrir(b.dataset.mis));
  }
  async function abrir(id) {
    const m = MISSOES.find(x => x.id === id); if (!m) return lista();
    ST.aberta = id; tocar();
    CONT.innerHTML = `<div class="page mis-page">
      <div class="mis-hero" style="background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.8)),url('${m.foto}')">
        <button class="btn sm ghost mis-voltar" type="button" id="mis-voltar">← Missões</button>
        <button class="btn sm ghost mis-somb" type="button" id="mis-som" aria-pressed="false"></button>
        <div class="mis-hero-txt"><span class="mis-selo">🎯 Missão</span><h1>${esc(m.nome)}</h1><p>${esc(m.texto)}</p></div>
        <small class="mis-credito">${esc(m.credito)}</small>
      </div>
      <div class="mis-abas" role="tablist">${[["raiox", "🩻 Raio-x da prova"], ["provas", "📄 Provas antigas"], ["banco", "🧠 Banco especializado"]].map(([k, n]) => `<button type="button" role="tab" class="qb-chip ${ST.aba === k ? "on" : ""}" aria-selected="${ST.aba === k}" data-aba="${k}">${n}</button>`).join("")}</div>
      <div id="mis-corpo"><div class="card">Carregando…</div></div></div>`;
    botaoSom();
    CONT.querySelector("#mis-voltar").onclick = lista;
    CONT.querySelector("#mis-som").onclick = () => { const lig = !M.tocando; try { localStorage.setItem(SOM_KEY, lig ? "1" : "0"); } catch (e) { } if (lig) tocar(); else parar(); };
    CONT.querySelectorAll("[data-aba]").forEach(b => b.onclick = () => { ST.aba = b.dataset.aba; CONT.querySelectorAll("[data-aba]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); corpo(); });
    try { await dados(); } catch (e) { CONT.querySelector("#mis-corpo").innerHTML = `<div class="card"><b>Não foi possível carregar a missão.</b> <span class="small muted">Confira a internet e tente de novo.</span></div>`; return; }
    corpo();
  }
  function barra(p, cor) { return `<span class="rx-barra"><span style="width:${Math.max(2, Math.min(100, p))}%;background:${cor}"></span></span>`; }
  function corpo() {
    const c = CONT.querySelector("#mis-corpo"); if (!c) return;
    if (ST.aba === "raiox") c.innerHTML = raiox(); else if (ST.aba === "provas") c.innerHTML = provas(); else c.innerHTML = banco();
    c.querySelectorAll("[data-treinar]").forEach(b => b.onclick = () => { const [m, t, ano] = JSON.parse(b.dataset.treinar); parar(); APP.irBanco({ prova: "pism", mo: "I", m: m || "", t: t || "", ano: ano || "" }); });
    c.querySelectorAll("[data-rx-m]").forEach(b => b.onclick = () => { ST.mat = b.dataset.rxM; corpo(); });
  }
  function raiox() {
    const R = ST.raiox, nm = m => (R.materias.find(x => x.m === m) || {}).nome || m;
    const sel = ST.mat ? R.materias.filter(x => x.m === ST.mat) : R.materias;
    return `<div class="stack">
      <div class="card stack"><h2>O que é o raio-x</h2><p class="small muted">Contamos as ${R.total} questões objetivas do Módulo I do PISM de ${R.anos[0]} a ${R.anos[R.anos.length - 1]} (${R.anos.length} provas) e separamos por matéria e assunto. A porcentagem mostra quanto cada assunto pesa. Use para decidir o que estudar primeiro.</p></div>
      <div class="rx-dupla">
        <div class="card stack"><h3>🔥 O que mais cai (geral)</h3>${R.mais.map((x, i) => `<div class="rx-linha"><span class="rx-n">${i + 1}</span><span class="rx-t"><b>${esc(x.t)}</b><small>${esc(nm(x.m))} · ${x.n} questões</small></span><span class="rx-p">${x.p}%</span></div>${barra(x.p * 6, COR[x.m])}`).join("")}</div>
        <div class="card stack"><h3>🧊 O que menos cai (geral)</h3>${R.menos.map(x => `<div class="rx-linha"><span class="rx-t"><b>${esc(x.t)}</b><small>${esc(nm(x.m))} · ${x.n} ${x.n === 1 ? "questão" : "questões"}</small></span><span class="rx-p">${x.p}%</span></div>`).join("")}</div>
      </div>
      <div class="card stack"><h3>Peso de cada matéria na prova</h3>${R.materias.map(x => `<div class="rx-linha"><span class="rx-t"><b>${esc(x.nome)}</b><small>${x.n} questões</small></span><span class="rx-p">${x.p}%</span></div>${barra(x.p * 4, COR[x.m])}`).join("")}
        <p class="small muted">No Módulo I, cada matéria tem o mesmo número de questões objetivas; a diferença está nos assuntos de dentro de cada matéria.</p></div>
      <div class="card stack"><h3>Dentro de cada matéria</h3>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="qb-chip ${ST.mat ? "" : "on"}" data-rx-m="">Todas</button>${R.materias.map(x => `<button type="button" class="qb-chip ${ST.mat === x.m ? "on" : ""}" data-rx-m="${x.m}">${esc(x.nome)}</button>`).join("")}</div>
        ${sel.map(x => `<div class="rx-mat"><h4 style="color:${COR[x.m]}">${esc(x.nome)}</h4>
          ${x.topicos.map((t, i) => `<div class="rx-linha"><span class="rx-t"><b>${esc(t.t)}</b><small>${t.n} ${t.n === 1 ? "questão" : "questões"}${i === 0 ? " · o que mais cai" : i === x.topicos.length - 1 && x.topicos.length > 2 ? " · o que menos cai" : ""}</small></span><span class="rx-p">${t.p}%</span><button class="btn sm ghost" type="button" data-treinar='${esc(JSON.stringify([x.m, t.t]))}'>Treinar</button></div>${barra(t.p, COR[x.m])}`).join("")}
        </div>`).join("")}
      </div></div>`;
  }
  function provas() {
    return `<div class="stack"><div class="card stack"><h2>Provas antigas do Módulo I</h2><p class="small muted">Abra a prova original para ver como ela é, ou treine as questões daquele ano já com o gabarito no banco do site.</p></div>
      <div class="pv-lista">${ST.provas.slice().reverse().map(p => `<div class="card stack pv-ano"><div class="row" style="justify-content:space-between;align-items:center"><h3>PISM ${p.ano}</h3>${p.n ? `<span class="small muted">${p.n} questões no banco</span>` : ""}</div>
        ${p.obs ? `<span class="small muted">${esc(p.obs)}</span>` : ""}
        <div class="row" style="gap:6px;flex-wrap:wrap">${(p.arq || []).map(([n, u]) => `<a class="btn sm" href="${(APP.base || "") + u}" target="_blank" rel="noopener">📄 ${esc(n)}</a>`).join("")}${p.link ? `<a class="btn sm" href="${p.link}" target="_blank" rel="noopener">🔗 Ver no site da UFJF</a>` : ""}
        ${p.n ? `<button class="btn sm primary" type="button" data-treinar='${JSON.stringify(["", "", String(p.ano)])}'>Treinar ${p.ano}</button>` : ""}</div></div>`).join("")}</div></div>`;
  }
  function banco() {
    const R = ST.raiox, todos = [];
    R.materias.forEach(x => x.topicos.forEach(t => todos.push({ m: x.m, nome: x.nome, t: t.t, n: t.n })));
    todos.sort((a, b) => b.n - a.n);
    return `<div class="stack"><div class="card stack"><h2>Banco especializado PISM 1</h2><p class="small muted">${R.total} questões objetivas do Módulo I, com gabarito oficial. Os assuntos estão em ordem do que mais cai para o que menos cai: comece pelo topo.</p>
        <div><button class="btn primary" type="button" data-treinar='${JSON.stringify(["", ""])}'>Treinar todas as questões do PISM 1</button></div></div>
      <div class="card stack">${todos.map((x, i) => `<div class="rx-linha"><span class="rx-n">${i + 1}</span><span class="rx-t"><b>${esc(x.t)}</b><small style="color:${COR[x.m]}">${esc(x.nome)}</small></span><span class="rx-p">${x.n}</span><button class="btn sm" type="button" data-treinar='${esc(JSON.stringify([x.m, x.t]))}'>Treinar</button></div>`).join("")}</div></div>`;
  }

  function render(cont, app) {
    APP = app; CONT = cont;
    if (ST.aberta) abrir(ST.aberta); else lista();
  }
  window.LAComp = window.LAComp || {};
  window.LAComp.Missoes = { render, parar, sair() { parar(); } };
})();
