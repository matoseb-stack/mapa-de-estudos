/* Simulados — provas completas no formato oficial, com cronômetro e regra de não sair da aba.
   - Cada simulado fica em simulados/<id>.json (dias, textos de apoio, objetivas com gabarito e explicação, discursivas com resposta esperada).
   - Durante a prova: cronômetro regressivo; sair da aba (trocar de aba, minimizar, bloquear a tela, recarregar) ZERA a prova.
   - Ao entregar: objetivas corrigidas na hora; discursivas corrigidas pela IA (ou pela própria pessoa, comparando com a resposta esperada).
   Integração: LAComp.Simulados.render(container, app) e LAComp.Simulados.emProva(). */
(function () {
  "use strict";
  const L = "ABCDE";
  let APP = null, CONT = null, tique = null;
  const ST = { lista: null, cache: {}, prova: null, resultado: null, hist: null, aviso: "" };
  const esc = s => APP.esc(s);
  const nomeMat = m => (APP.mat && APP.mat[m]) || m;
  const relogio = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };
  const minTxt = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };

  async function carregarLista() { if (ST.lista) return ST.lista; const r = await fetch("simulados/indice.json"); if (!r.ok) throw new Error(r.status); return (ST.lista = await r.json()); }
  async function carregarSim(id) { if (ST.cache[id]) return ST.cache[id]; const it = (await carregarLista()).find(x => x.id === id); const r = await fetch(it.arquivo); if (!r.ok) throw new Error(r.status); return (ST.cache[id] = await r.json()); }
  async function historico() { if (ST.hist) return ST.hist; let d = null; try { d = await APP.ler("simulados"); } catch (e) {} ST.hist = (d && Array.isArray(d.h)) ? d.h : []; return ST.hist; }
  function salvarHist() { APP.gravar("simulados", { h: ST.hist.slice(-30) }); }

  /* ---------- lista ---------- */
  async function telaLista() {
    CONT.innerHTML = `<div class="page sim-page">${APP.pageHead("Simulados", "Provas completas no formato oficial, com cronômetro. Faça como no dia da prova: sem sair da aba.")}<div class="card row muted"><span class="spinner"></span>Carregando simulados…</div></div>`;
    let lista, h;
    try { [lista, h] = await Promise.all([carregarLista(), historico()]); }
    catch (e) { CONT.querySelector(".card").outerHTML = `<div class="card stack"><b>Não foi possível carregar os simulados.</b><span class="small muted">Verifique sua conexão e tente de novo.</span></div>`; return; }
    if (!naTela()) return;
    const sims = await Promise.all(lista.map(x => carregarSim(x.id).catch(() => null)));
    CONT.innerHTML = `<div class="page sim-page">${APP.pageHead("Simulados", "Provas completas no formato oficial, com cronômetro. Faça como no dia da prova: sem sair da aba.")}
      ${ST.aviso ? `<div class="card sim-zerado" role="alert">⛔ <b>${esc(ST.aviso)}</b></div>` : ""}
      ${sims.map((s, i) => s ? cartaoSim(s, h) : `<div class="card">Não foi possível abrir ${esc(lista[i].nome)}.</div>`).join("")}
    </div>`;
    ST.aviso = "";
    CONT.querySelectorAll("[data-sim-ir]").forEach(b => b.onclick = () => { const [id, d] = b.dataset.simIr.split("|"); confirmarInicio(id, +d); });
    CONT.querySelectorAll("[data-sim-ver]").forEach(b => b.onclick = () => { const t = ST.hist[+b.dataset.simVer]; if (t) verResultado(t); });
  }
  function cartaoSim(s, h) {
    const meus = h.map((t, i) => [t, i]).filter(([t]) => t.sim === s.id).reverse();
    return `<div class="card stack sim-card">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div style="min-width:0"><span class="eyebrow">${esc(s.prova)} · Módulo ${esc(s.modulo)}</span><h2 style="margin:4px 0">${esc(s.nome)}</h2>
        <p class="small muted" style="margin:0">${esc(s.descricao)}</p></div><span class="sim-selo">📝</span></div>
      <div class="sim-dias">${s.dias.map(d => `<div class="sim-dia">
        <div><b>${d.dia}º dia</b> · ${d.materias.map(nomeMat).join(", ")}</div>
        <div class="small muted">${d.objetivas.length} objetivas (1 ponto cada) + ${d.discursivas.length} discursivas (5 pontos cada) · ${minTxt(d.duracaoMin * 60000)}</div>
        <button class="btn primary" type="button" data-sim-ir="${s.id}|${d.dia}">${APP.ico("play")}Começar o ${d.dia}º dia</button></div>`).join("")}</div>
      <div class="small muted sim-regras">⏱️ O tempo é o da prova real. <b>Não saia da aba</b>: trocar de aba, minimizar o navegador, bloquear a tela ou recarregar a página zera o simulado.</div>
      ${meus.length ? `<div class="stack sm"><div class="eyebrow">Suas tentativas</div>${meus.slice(0, 8).map(([t, i]) => `<button type="button" class="li sim-tent" data-sim-ver="${i}">
        <div style="min-width:0;text-align:left"><b>${t.dia}º dia · ${fmtPts(t.total)} de ${t.max} pontos</b><div class="small muted">${new Date(t.em).toLocaleDateString("pt-BR")} · objetivas ${t.obj}/${t.nObj} · discursivas ${fmtPts(t.disc)}/${t.nDisc * 5}${t.discPend ? " (correção pendente)" : ""} · ${minTxt(t.tempo)}</div></div><span class="small muted">Ver correção ›</span></button>`).join("")}</div>` : ""}
    </div>`;
  }
  // figuras da questão (gráficos, esquemas, mapas, obras de arte): com fonte e toque para ampliar
  const figs = q => (q.img || []).map(f => `<figure class="sim-fig"><button type="button" class="sim-fig-b" data-zoom="${esc(f.src)}" aria-label="Ampliar a figura"><img src="${esc(f.src)}" alt="${esc(f.alt || "Figura da questão")}" loading="lazy"></button>${f.fonte ? `<figcaption class="small muted">${esc(f.fonte)}</figcaption>` : ""}</figure>`).join("");
  function ampliar(src, alt) {
    const bg = document.createElement("div"); bg.className = "modal-bg sim-zoom";
    bg.innerHTML = `<div class="sim-zoom-c" role="dialog" aria-modal="true" aria-label="Figura ampliada"><button class="btn sm" type="button" data-z="x">Fechar ✕</button><img src="${esc(src)}" alt="${esc(alt || "")}"></div>`;
    document.body.appendChild(bg); bg.addEventListener("click", e => { if (e.target === bg || e.target.closest('[data-z="x"]')) bg.remove(); });
  }
  document.addEventListener("click", e => { const b = e.target.closest(".sim-fig-b"); if (b && CONT && CONT.contains(b)) { const im = b.querySelector("img"); ampliar(b.dataset.zoom, im && im.alt); } });
  const fmtPts = n => (Math.round((+n || 0) * 10) / 10).toLocaleString("pt-BR");

  function confirmarInicio(id, dia) {
    const s = ST.cache[id], d = s && s.dias.find(x => x.dia === dia); if (!d) return;
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="sim-c-t" style="max-width:520px">
      <h3 id="sim-c-t">${esc(s.nome)} · ${dia}º dia</h3>
      <ul class="small stack sm" style="margin:0;padding-left:18px">
        <li><b>${d.objetivas.length} questões objetivas</b> e <b>${d.discursivas.length} discursivas</b>: ${d.materias.map(nomeMat).join(", ")}.</li>
        <li>Tempo: <b>${minTxt(d.duracaoMin * 60000)}</b>. Quando acabar, a prova é entregue sozinha.</li>
        <li><b>Não saia desta aba.</b> Se você trocar de aba, minimizar, bloquear a tela, atender uma ligação ou recarregar, <b>o simulado é zerado</b>.</li>
        <li>Dica: deixe o celular no modo “não perturbe” e tenha papel para rascunho.</li></ul>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" data-c="n">Agora não</button><button class="btn primary" type="button" data-c="s">${APP.ico("play")}Começar agora</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest('[data-c="n"]')) bg.remove(); else if (e.target.closest('[data-c="s"]')) { bg.remove(); iniciar(s, d); } });
  }

  /* ---------- prova ---------- */
  function iniciar(s, d) {
    const agora = Date.now();
    ST.prova = { s, d, inicio: agora, fim: agora + d.duracaoMin * 60000, atual: 0, resp: {}, disc: {}, marcadas: {} };
    try { document.documentElement.requestFullscreen && matchMedia("(max-width:860px)").matches && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    telaProva(); clearInterval(tique); tique = setInterval(atualizarRelogio, 1000);
  }
  const itensDe = d => d.objetivas.map(q => ({ tipo: "o", q })).concat(d.discursivas.map(q => ({ tipo: "d", q })));
  function telaProva() {
    const P = ST.prova; if (!P) return; if (ehAdm()) admGuardar(); const itens = itensDe(P.d), it = itens[P.atual], q = it.q;
    const resp = it.tipo === "o" ? P.resp[q.n] : null, feitas = Object.keys(P.resp).length + Object.keys(P.disc).filter(k => Object.values(P.disc[k] || {}).some(v => String(v).trim())).length;
    CONT.innerHTML = `<div class="page sim-prova">
      <div class="sim-barra card">
        <div style="min-width:0"><b>${esc(P.s.nome)} · ${P.d.dia}º dia</b><div class="small muted">${feitas} de ${itens.length} respondidas${ehAdm() ? " · 🔑 administrador: pode sair e voltar (o tempo pausa)" : ""}</div></div>
        <div class="sim-tempo mono" id="sim-tempo" aria-live="off">${relogio(P.fim - Date.now())}</div>
        <button class="btn primary" type="button" id="sim-entregar">Entregar</button>
      </div>
      <nav class="sim-nav" aria-label="Questões">${itens.map((x, i) => { const ok = x.tipo === "o" ? P.resp[x.q.n] != null : Object.values(P.disc[x.q.n] || {}).some(v => String(v).trim());
        return `<button type="button" class="sim-nb ${i === P.atual ? "on" : ""} ${ok ? "ok" : ""} ${P.marcadas[i] ? "marc" : ""}" data-ir="${i}" aria-label="${x.tipo === "o" ? "Questão " + x.q.n : "Discursiva " + x.q.n}">${x.tipo === "o" ? x.q.n : "D" + x.q.n}</button>`; }).join("")}</nav>
      <article class="card sim-q">
        <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill solid">${it.tipo === "o" ? "Questão " + q.n : "Questão discursiva " + q.n}</span><span class="pill">${esc(nomeMat(q.m))}</span>${it.tipo === "d" ? `<span class="pill">5 pontos</span>` : ""}</div>
          <button class="btn sm ghost" type="button" id="sim-marcar" aria-pressed="${!!P.marcadas[P.atual]}">${P.marcadas[P.atual] ? "★ Marcada para revisar" : "☆ Marcar para revisar"}</button></div>
        ${(q.apoio || []).map(k => `<details class="sim-apoio" open><summary>${esc(((P.d.textos[k] || "").match(/\*\*(.+?)\*\*/) || [, "Texto de apoio"])[1])}</summary><div class="sim-txt">${APP.md((P.d.textos[k] || "").replace(/^\*\*.+?\*\*\s*/, ""))}</div></details>`).join("")}
        ${figs(q)}
        <div class="sim-enun">${APP.md(q.texto)}</div>
        ${it.tipo === "o" ? `<div class="sim-alts" role="radiogroup" aria-label="Alternativas">${q.a.map((t, k) => `<button type="button" class="sim-alt ${resp === k ? "on" : ""}" role="radio" aria-checked="${resp === k}" data-alt="${k}"><span class="qb-l">${L[k]}</span><span>${esc(t)}</span></button>`).join("")}</div>`
          : `<div class="stack">${q.itens.map(x => `<label class="field"><span><b>${x.p})</b> ${esc(x.enun)} <span class="small muted">(${fmtPts(x.pontos)} pontos)</span></span><textarea data-disc="${x.p}" rows="5" placeholder="Escreva sua resposta…">${esc((P.disc[q.n] || {})[x.p] || "")}</textarea></label>`).join("")}</div>`}
        <div class="row sim-acoes"><button class="btn ghost" type="button" id="sim-ant" ${P.atual <= 0 ? "disabled" : ""}>${APP.ico("back")}Anterior</button>
          <button class="btn" type="button" id="sim-prox" ${P.atual >= itens.length - 1 ? "disabled" : ""}>Próxima${APP.ico("next")}</button></div>
      </article></div>`;
    const ir = i => { P.atual = Math.max(0, Math.min(itens.length - 1, i)); telaProva(); const a = CONT.querySelector(".sim-q"); if (a && a.getBoundingClientRect().top < 0) a.scrollIntoView({ block: "start" }); };
    CONT.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => ir(+b.dataset.ir));
    CONT.querySelectorAll("[data-alt]").forEach(b => b.onclick = () => { const k = +b.dataset.alt; if (P.resp[q.n] === k) delete P.resp[q.n]; else P.resp[q.n] = k; const y = scrollY; telaProva(); scrollTo(0, y); });
    CONT.querySelectorAll("[data-disc]").forEach(t => t.oninput = () => { (P.disc[q.n] = P.disc[q.n] || {})[t.dataset.disc] = t.value; if (ehAdm()) admGuardar(); });
    CONT.querySelectorAll("[data-disc]").forEach(t => t.onchange = () => { const y = scrollY; telaProva(); scrollTo(0, y); });
    CONT.querySelector("#sim-ant").onclick = () => ir(P.atual - 1);
    CONT.querySelector("#sim-prox").onclick = () => ir(P.atual + 1);
    CONT.querySelector("#sim-marcar").onclick = () => { P.marcadas[P.atual] = !P.marcadas[P.atual]; const y = scrollY; telaProva(); scrollTo(0, y); };
    CONT.querySelector("#sim-entregar").onclick = () => {
      const falta = itens.length - feitasAgora();
      if (falta > 0 && !confirm(`Ainda há ${falta} ${falta === 1 ? "questão sem resposta" : "questões sem resposta"}. Entregar mesmo assim?`)) return;
      if (falta <= 0 && !confirm("Entregar o simulado agora?")) return;
      entregar(false);
    };
  }
  const feitasAgora = () => { const P = ST.prova; return Object.keys(P.resp).length + Object.keys(P.disc).filter(k => Object.values(P.disc[k] || {}).some(v => String(v).trim())).length; };
  function atualizarRelogio() {
    const P = ST.prova; if (!P) { clearInterval(tique); return; } if (P.pausaEm) return;
    const falta = P.fim - Date.now(), el = document.getElementById("sim-tempo");
    if (el) { el.textContent = relogio(falta); el.classList.toggle("pouco", falta < 15 * 60000); }
    if (falta <= 0) entregar(true);
  }
  /* administrador: pode sair e voltar quando quiser — o tempo pausa enquanto está fora e a prova fica guardada no aparelho */
  const ehAdm = () => !!(APP && APP.ehAdmin && APP.ehAdmin());
  const ADM_KEY = "la_sim_adm";
  function admPausar() { const P = ST.prova; if (!P || P.pausaEm) return; P.pausaEm = Date.now(); clearInterval(tique); admGuardar(); }
  function admRetomar() { const P = ST.prova; if (!P || !P.pausaEm) return; P.fim += Date.now() - P.pausaEm; P.inicio += Date.now() - P.pausaEm; P.pausaEm = 0; clearInterval(tique); tique = setInterval(atualizarRelogio, 1000); admGuardar(); }
  function admGuardar() { const P = ST.prova; try { if (P) localStorage.setItem(ADM_KEY, JSON.stringify({ sim: P.s.id, dia: P.d.dia, inicio: P.inicio, fim: P.fim, pausaEm: P.pausaEm || Date.now(), atual: P.atual, resp: P.resp, disc: P.disc, marcadas: P.marcadas })); else localStorage.removeItem(ADM_KEY); } catch (e) {} }
  async function admRestaurar() { let g = null; try { g = JSON.parse(localStorage.getItem(ADM_KEY) || "null"); } catch (e) {} if (!g) return false;
    try { const s = await carregarSim(g.sim), d = s.dias.find(x => x.dia === g.dia); if (!d) return false; ST.prova = Object.assign({ s, d }, g); delete ST.prova.sim; delete ST.prova.dia; return true; } catch (e) { return false; } }
  // sair da aba zera a prova (menos para o administrador, que só pausa)
  function zerar(motivo) {
    if (!ST.prova) return;
    if (ehAdm()) { admPausar(); return; } clearInterval(tique); ST.prova = null;
    ST.aviso = motivo || "Você saiu da aba durante o simulado e ele foi zerado. Comece de novo quando estiver pronto.";
    try { sessionStorage.setItem("la_sim_zerado", ST.aviso); } catch (e) {}
    if (naTela()) telaLista();
  }
  document.addEventListener("visibilitychange", () => { if (!ST.prova) return; if (document.visibilityState === "hidden") zerar(); else if (ehAdm() && naTela()) { admRetomar(); telaProva(); } });
  addEventListener("pagehide", () => { if (ST.prova) zerar("A página foi fechada ou recarregada durante o simulado, e ele foi zerado."); });
  addEventListener("beforeunload", e => { if (ST.prova && !ehAdm()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- correção ---------- */
  async function entregar(acabouTempo) {
    const P = ST.prova; if (!P) return; clearInterval(tique); ST.prova = null; try { localStorage.removeItem(ADM_KEY); } catch (e) {}
    const d = P.d, tempo = Math.min(Date.now(), P.fim) - P.inicio;
    const obj = d.objetivas.filter(q => P.resp[q.n] === q.r).length;
    const t = { sim: P.s.id, nome: P.s.nome, dia: d.dia, em: Date.now(), tempo, resp: P.resp, discResp: P.disc, notas: {}, obj, nObj: d.objetivas.length, nDisc: d.discursivas.length, disc: 0, discPend: true, max: d.objetivas.length + d.discursivas.length * 5, total: obj, acabouTempo: !!acabouTempo };
    await historico(); ST.hist.push(t); salvarHist();
    CONT.innerHTML = `<div class="page sim-page"><div class="card stack" style="align-items:center;text-align:center;padding:32px">${acabouTempo ? "<b>⏰ O tempo acabou e a prova foi entregue.</b>" : "<b>Prova entregue!</b>"}<div class="row muted"><span class="spinner"></span>A IA está corrigindo as questões discursivas…</div></div></div>`;
    await corrigirDisc(t, d);
    verResultado(t);
  }
  function promptCorrecao(d, t) {
    return `Você é professor corretor do PISM (UFJF), Módulo I. Corrija as respostas discursivas abaixo com o rigor da banca: compare com a resposta esperada, aceite respostas equivalentes com outras palavras, dê nota parcial quando a resposta estiver incompleta e nota zero para resposta em branco ou errada. Cada item tem a pontuação máxima indicada (use múltiplos de 0,5).
${d.discursivas.map(q => `QUESTÃO D${q.n} (${q.m}): ${q.texto}
${q.itens.map(x => `Item ${x.p}) [vale ${x.pontos}] ${x.enun}
Resposta esperada: ${x.esperado}
Resposta do estudante: """${String(((t.discResp[q.n] || {})[x.p]) || "").slice(0, 1500) || "(em branco)"}"""`).join("\n")}`).join("\n\n")}

Responda SOMENTE com JSON: {"notas":[{"q":1,"itens":[{"p":"a","nota":2.5,"comentario":"o que faltou ou o que está certo, em 1 frase"}]}]}`;
  }
  async function corrigirDisc(t, d) {
    const algum = d.discursivas.some(q => q.itens.some(x => String(((t.discResp[q.n] || {})[x.p]) || "").trim()));
    if (!algum) { d.discursivas.forEach(q => { t.notas[q.n] = {}; q.itens.forEach(x => t.notas[q.n][x.p] = { nota: 0, comentario: "Em branco." }); }); fecharNotas(t, d); return; }
    if (!APP.iaJson) return;
    try {
      const r = await APP.iaJson(promptCorrecao(d, t));
      (r && Array.isArray(r.notas) ? r.notas : []).forEach(n => { const q = d.discursivas.find(z => z.n === +n.q); if (!q) return; t.notas[q.n] = t.notas[q.n] || {};
        (n.itens || []).forEach(i => { const x = q.itens.find(z => z.p === String(i.p).toLowerCase()); if (!x) return; const v = Math.max(0, Math.min(x.pontos, Math.round((+i.nota || 0) * 2) / 2)); t.notas[q.n][x.p] = { nota: v, comentario: String(i.comentario || "").slice(0, 300), ia: 1 }; }); });
      const completo = d.discursivas.every(q => q.itens.every(x => t.notas[q.n] && t.notas[q.n][x.p]));
      if (completo) fecharNotas(t, d);
    } catch (e) { console.warn("correção do simulado", e); }
    salvarHist();
  }
  function fecharNotas(t, d) {
    t.disc = d.discursivas.reduce((a, q) => a + q.itens.reduce((b, x) => b + (((t.notas[q.n] || {})[x.p] || {}).nota || 0), 0), 0);
    t.discPend = !d.discursivas.every(q => q.itens.every(x => t.notas[q.n] && t.notas[q.n][x.p])); t.total = t.obj + t.disc; salvarHist();
  }
  async function verResultado(t) {
    const s = await carregarSim(t.sim), d = s.dias.find(x => x.dia === t.dia); ST.resultado = t;
    const porMat = {}; d.materias.forEach(m => porMat[m] = { o: 0, no: 0, d: 0, nd: 0 });
    d.objetivas.forEach(q => { const p = porMat[q.m]; p.no++; if (t.resp[q.n] === q.r) p.o++; });
    d.discursivas.forEach(q => { const p = porMat[q.m]; p.nd += 5; p.d += q.itens.reduce((b, x) => b + (((t.notas[q.n] || {})[x.p] || {}).nota || 0), 0); });
    CONT.innerHTML = `<div class="page sim-page">
      ${APP.pageHead(`${esc(s.nome)} · ${t.dia}º dia`, `Feito em ${new Date(t.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · tempo usado: ${minTxt(t.tempo)}${t.acabouTempo ? " (o tempo acabou)" : ""}`, `<button class="btn" type="button" id="sim-voltar">${APP.ico("back")}Simulados</button>`)}
      <div class="stats">
        <div class="stat"><div class="eyebrow">Nota</div><div class="v">${fmtPts(t.total)}<small class="muted"> / ${t.max}</small></div><div class="prog" style="margin-top:8px"><i style="width:${Math.round(t.total / t.max * 100)}%"></i></div></div>
        <div class="stat"><div class="eyebrow">Objetivas</div><div class="v">${t.obj}<small class="muted"> / ${t.nObj}</small></div><div class="s">${Math.round(t.obj / t.nObj * 100)}% de acerto</div></div>
        <div class="stat"><div class="eyebrow">Discursivas</div><div class="v">${fmtPts(t.disc)}<small class="muted"> / ${t.nDisc * 5}</small></div><div class="s">${t.discPend ? "correção pendente" : "corrigidas"}</div></div>
      </div>
      <div class="card stack sm"><div class="eyebrow">Por matéria</div>${d.materias.map(m => { const p = porMat[m], pts = p.o + p.d, max = p.no + p.nd; return `<div class="sim-mat"><span>${esc(nomeMat(m))}</span><div class="prog"><i style="width:${Math.round(pts / max * 100)}%"></i></div><span class="small mono">${fmtPts(pts)}/${max}</span><span class="small muted">${p.o}/${p.no} obj. · ${fmtPts(p.d)}/${p.nd} disc.</span></div>`; }).join("")}</div>
      ${t.discPend ? `<div class="card stack sm sim-pend"><b>As discursivas ainda não foram corrigidas.</b><span class="small muted">A IA não conseguiu corrigir agora. Tente de novo ou corrija você mesmo, comparando com a resposta esperada.</span><div class="row" style="gap:8px"><button class="btn primary" type="button" id="sim-recorrigir">${APP.ico("spark")}Corrigir com a IA</button></div></div>` : ""}
      <h2 style="margin:20px 0 8px">Correção das objetivas</h2>
      <div class="stack sm">${d.objetivas.map(q => { const m = t.resp[q.n], ok = m === q.r; return `<details class="card sim-corr ${ok ? "ok" : m == null ? "branco" : "no"}"><summary><span class="sim-st">${ok ? "✓" : m == null ? "—" : "✗"}</span><b>Questão ${q.n}</b> <span class="small muted">${esc(nomeMat(q.m))} · ${esc(q.t)} · ${esc(q.nivel)}</span><span class="small sim-gab">${m == null ? "em branco" : "você: " + L[m]} · gabarito: <b>${L[q.r]}</b></span></summary>
        ${(q.apoio || []).map(k => `<details class="sim-apoio"><summary>Ver ${esc(((d.textos[k] || "").match(/\*\*(.+?)\*\*/) || [, "texto"])[1])}</summary><div class="sim-txt">${APP.md((d.textos[k] || "").replace(/^\*\*.+?\*\*\s*/, ""))}</div></details>`).join("")}
        ${figs(q)}
        <div class="sim-enun">${APP.md(q.texto)}</div>
        <div class="sim-alts">${q.a.map((x, k) => `<div class="sim-alt ${k === q.r ? "certa" : k === m ? "errada" : ""}"><span class="qb-l">${L[k]}</span><span>${esc(x)}</span></div>`).join("")}</div>
        <div class="sim-exp"><b>Comentário:</b> ${esc(q.exp)}</div><div class="small muted">Baseada em: ${esc(q.base)}</div></details>`; }).join("")}</div>
      <h2 style="margin:20px 0 8px">Correção das discursivas</h2>
      <div class="stack sm">${d.discursivas.map(q => `<details class="card sim-corr" open><summary><b>Discursiva ${q.n}</b> <span class="small muted">${esc(nomeMat(q.m))} · ${esc(q.t)}</span><span class="small sim-gab">${fmtPts(q.itens.reduce((b, x) => b + (((t.notas[q.n] || {})[x.p] || {}).nota || 0), 0))} / 5</span></summary>
        ${(q.apoio || []).map(k => `<details class="sim-apoio"><summary>Ver ${esc(((d.textos[k] || "").match(/\*\*(.+?)\*\*/) || [, "texto"])[1])}</summary><div class="sim-txt">${APP.md((d.textos[k] || "").replace(/^\*\*.+?\*\*\s*/, ""))}</div></details>`).join("")}
        ${figs(q)}
        <div class="sim-enun">${APP.md(q.texto)}</div>
        ${q.itens.map(x => { const n = (t.notas[q.n] || {})[x.p]; return `<div class="sim-item stack sm"><div><b>${x.p})</b> ${esc(x.enun)}</div>
          <div class="sim-sua"><span class="eyebrow">Sua resposta</span><div>${esc(((t.discResp[q.n] || {})[x.p]) || "(em branco)")}</div></div>
          <div class="sim-esp"><span class="eyebrow">Resposta esperada</span><div>${esc(x.esperado)}</div></div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill ${n ? (n.nota >= x.pontos ? "ok" : n.nota > 0 ? "" : "no") : ""}">${n ? fmtPts(n.nota) : "?"} / ${fmtPts(x.pontos)}</span>${n && n.comentario ? `<span class="small muted">${n.ia ? "IA: " : ""}${esc(n.comentario)}</span>` : ""}
            <span class="small muted" style="margin-left:auto">Corrigir eu mesmo:</span>${[0, x.pontos / 2, x.pontos].map(v => `<button type="button" class="btn sm ${n && n.nota === v ? "primary" : "ghost"}" data-nota="${q.n}|${x.p}|${v}">${fmtPts(v)}</button>`).join("")}</div></div>`; }).join("")}
        <div class="small muted">Baseada em: ${esc(q.base)}</div></details>`).join("")}</div>
    </div>`;
    CONT.querySelector("#sim-voltar").onclick = () => { ST.resultado = null; telaLista(); };
    const rc = CONT.querySelector("#sim-recorrigir"); if (rc) rc.onclick = async () => { rc.disabled = true; rc.textContent = "Corrigindo…"; await corrigirDisc(t, d); verResultado(t); };
    CONT.querySelectorAll("[data-nota]").forEach(b => b.onclick = () => { const [qn, p, v] = b.dataset.nota.split("|"); (t.notas[qn] = t.notas[qn] || {})[p] = { nota: +v, comentario: "Nota dada por você.", eu: 1 }; fecharNotas(t, d); const y = scrollY; verResultado(t).then(() => scrollTo(0, y)); });
    scrollTo(0, 0);
  }

  const naTela = () => APP && APP.naTela && APP.naTela();
  async function render(container, app) {
    APP = app; CONT = container;
    try { const z = sessionStorage.getItem("la_sim_zerado"); if (z) { ST.aviso = z; sessionStorage.removeItem("la_sim_zerado"); } } catch (e) {}
    if (!ST.prova && ehAdm()) await admRestaurar();
    if (!ST.prova) { try { localStorage.removeItem(ADM_KEY); } catch (e) {} }
    if (ST.prova) { if (ehAdm()) admRetomar(); telaProva(); return; }
    if (ST.resultado) { verResultado(ST.resultado); return; }
    telaLista();
  }
  // sair do simulado para outra tela do site também zera (o site pergunta antes)
  function sairPermitido() {
    if (!ST.prova) return true;
    if (ehAdm()) { admPausar(); return true; }
    if (!confirm("Se você sair agora, o simulado será zerado. Sair mesmo?")) return false;
    zerar("Você saiu do simulado antes de entregar, e ele foi zerado."); return true;
  }
  (window.LAComp = window.LAComp || {}).Simulados = { render, emProva: () => !!ST.prova, sairPermitido, _estado: () => ST };
})();
