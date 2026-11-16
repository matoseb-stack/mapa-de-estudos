/* Biblioteca — e-books e materiais de estudo separados por matéria (prateleiras).
   Os livros ficam em biblioteca/<matéria>/<arquivo>.pdf e são listados em biblioteca/indice.json:
   { "livros": [ { "id", "titulo", "autor", "materia", "arquivo", "paginas", "descricao" } ] }
   Integração: LAComp.Biblioteca.render(container, app). */
(function () {
  "use strict";
  let APP = null, CONT = null;
  const ST = { livros: null, mat: "", busca: "", aberto: null };
  const esc = s => APP.esc(s);
  const MATS = [
    ["mat", "Matemática", "#eb5757"], ["por", "Português", "#2f80ed"], ["lit", "Literatura", "#9b51e0"], ["fis", "Física", "#f2994a"],
    ["qui", "Química", "#27ae60"], ["bio", "Biologia", "#219653"], ["his", "História", "#a0522d"], ["geo", "Geografia", "#00a3a3"],
    ["fil", "Filosofia", "#6d6875"], ["soc", "Sociologia", "#b5838d"], ["ing", "Inglês", "#3d5a80"], ["esp", "Espanhol", "#e09f3e"],
    ["red", "Redação", "#c9184a"], ["out", "Outros", "#6c757d"]];
  const mat = k => MATS.find(m => m[0] === k) || MATS[MATS.length - 1];
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const topicos = l => (l.sumario || []).map(c => c.t + " " + (c.sub || []).map(x => x.t).join(" ")).join(" ");
  // na busca por assunto, o livro abre direto na página do assunto encontrado
  function paginaDaBusca(l) {
    const b = norm(ST.busca).trim(); if (!b) return 0;
    for (const c of l.sumario || []) { if (norm(c.t).includes(b)) return c.p; for (const x of c.sub || []) if (norm(x.t).includes(b)) return x.p; }
    return 0;
  }
  async function carregar() {
    if (ST.livros) return ST.livros;
    const r = await fetch("biblioteca/indice.json", { cache: "no-cache" }); if (!r.ok) throw new Error(r.status);
    const d = await r.json(); return (ST.livros = Array.isArray(d.livros) ? d.livros : []);
  }
  function capa(l) {
    const [, nome, cor] = mat(l.materia);
    return `<span class="bib-capa" style="--cor:${cor}"><span class="bib-capa-mat">${esc(nome)}</span><span class="bib-capa-t">${esc(l.titulo)}</span>${l.autor ? `<span class="bib-capa-a">${esc(l.autor.replace(/^Secretaria de Estado da Educação do Paraná/, "SEED-PR"))}</span>` : ""}</span>`;
  }
  async function tela() {
    CONT.innerHTML = `<div class="page bib-page">${APP.pageHead("Biblioteca", "E-books e materiais de estudo, separados por matéria. Abra e leia aqui mesmo.")}<div class="card">Carregando…</div></div>`;
    let livros;
    try { livros = await carregar(); } catch (e) { CONT.querySelector(".card").outerHTML = `<div class="card"><b>Não foi possível abrir a biblioteca.</b> <span class="small muted">Confira a internet e tente de novo.</span></div>`; return; }
    const b = norm(ST.busca);
    const vis = livros.filter(l => (!ST.mat || l.materia === ST.mat) && (!b || norm(l.titulo + " " + (l.autor || "") + " " + (l.descricao || "") + " " + mat(l.materia)[1] + " " + topicos(l)).includes(b)));
    const cont = k => livros.filter(l => l.materia === k).length;
    const prat = MATS.filter(([k]) => (!ST.mat || k === ST.mat) && (vis.some(l => l.materia === k) || (!b && (ST.mat === k || !livros.length || cont(k)))));
    CONT.innerHTML = `<div class="page bib-page">${APP.pageHead("Biblioteca", "E-books e materiais de estudo, separados por matéria. Abra e leia aqui mesmo.")}
      <div class="card stack">
        <div class="qb-busca">${APP.ico ? APP.ico("search") : ""}<input id="bib-busca" type="search" placeholder="Buscar livro, autor ou assunto" value="${esc(ST.busca)}" aria-label="Buscar na biblioteca"></div>
        <div class="qb-chips"><button type="button" class="qb-chip ${ST.mat ? "" : "on"}" data-bm="">Todas (${livros.length})</button>${MATS.map(([k, n]) => `<button type="button" class="qb-chip ${ST.mat === k ? "on" : ""}" data-bm="${k}">${esc(n)}${cont(k) ? ` (${cont(k)})` : ""}</button>`).join("")}</div>
      </div>
      ${!livros.length ? `<div class="card stack bib-vazia"><b>📚 As prateleiras estão sendo montadas</b><span class="small muted">Os primeiros e-books chegam em breve, separados por matéria: Matemática, Português, Física, Química e as demais.</span></div>` : ""}
      ${prat.map(([k, n, cor]) => { const ls = vis.filter(l => l.materia === k); return `<section class="bib-prat"><h2 style="--cor:${cor}">${esc(n)} <small>${ls.length ? `${ls.length} ${ls.length === 1 ? "livro" : "livros"}` : "em breve"}</small></h2>
        <div class="bib-livros">${ls.length ? ls.map(l => `<div class="bib-item"><button type="button" class="bib-livro" data-livro="${esc(l.id)}">${capa(l)}<span class="bib-nome">${esc(l.titulo)}</span>${b && paginaDaBusca(l) ? `<span class="small bib-achou">↳ vai para a p. ${paginaDaBusca(l)}</span>` : ""}${l.paginas ? `<span class="small muted">${l.paginas} páginas</span>` : ""}</button>
          ${(l.sumario || []).length ? `<div class="bib-assuntos"><span class="small muted">${l.descricao ? esc(l.descricao) + " " : ""}Toque num assunto para abrir direto na página:</span><div class="bib-chips">${l.sumario.map(c => `<button type="button" class="qb-chip" data-livro-pg="${esc(l.id)}|${c.p}">${esc(c.t)}</button>`).join("")}</div></div>` : ""}</div>`).join("") : `<span class="small muted bib-vago">Nenhum livro nesta prateleira ainda.</span>`}</div></section>`; }).join("")}
      ${b && !vis.length ? `<div class="card">Nada encontrado para “${esc(ST.busca)}”.</div>` : ""}
    </div>`;
    const bi = CONT.querySelector("#bib-busca"); let t = null;
    bi.oninput = () => { clearTimeout(t); t = setTimeout(() => { ST.busca = bi.value; const pos = bi.selectionStart; tela().then(() => { const n = CONT.querySelector("#bib-busca"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }); }, 250); };
    CONT.querySelectorAll("[data-bm]").forEach(x => x.onclick = () => { ST.mat = x.dataset.bm; tela(); });
    CONT.querySelectorAll("[data-livro-pg]").forEach(x => x.onclick = () => { const [id, pg] = x.dataset.livroPg.split("|"); ler(livros.find(y => y.id === id), +pg); });
    CONT.querySelectorAll("[data-livro]").forEach(x => x.onclick = () => { const l = livros.find(y => y.id === x.dataset.livro); ler(l, paginaDaBusca(l)); });
  }
  /* ---------- leitor com sumário inteligente (pdf.js: abre aos poucos, vai direto à página) ---------- */
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  let pdfjsP = null;
  function pdfjs() {
    if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || PDFJS + "pdf.worker.min.js"; return Promise.resolve(window.pdfjsLib); }
    if (!pdfjsP) pdfjsP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      s.onerror = () => { pdfjsP = null; no(new Error("pdf.js")); }; document.head.appendChild(s); });
    return pdfjsP;
  }
  const LEITOR = { doc: null, livro: null, zoom: 1, obs: null, feitas: new Set(), larg: 0, prop: 1.414, atual: 1, salvarT: null };
  const posKey = id => "la_bib_pag_" + id;
  function lerPos(id) { try { return +localStorage.getItem(posKey(id)) || 0; } catch (e) { return 0; } }
  function sumarioHTML(l) {
    if (!l.sumario || !l.sumario.length) return `<p class="small muted">Este livro ainda não tem sumário.</p>`;
    let sec = null, h = "";
    l.sumario.forEach((c, i) => {
      if (c.sec && c.sec !== sec) { sec = c.sec; h += `<div class="bib-sum-sec">${esc(c.sec)}</div>`; }
      h += `<div class="bib-sum-cap" data-cap="${i}"><button type="button" class="bib-sum-t" data-pg="${c.p}"><span>${esc(c.t)}</span><small>p. ${c.p}</small></button>
        ${c.sub && c.sub.length ? `<div class="bib-sum-sub">${c.sub.map(s => `<button type="button" data-pg="${s.p}"><span>${esc(s.t)}</span><small>p. ${s.p}</small></button>`).join("")}</div>` : ""}</div>`;
    });
    return h;
  }
  async function ler(l, pagina) {
    if (!l) return;
    const [, nome, cor] = mat(l.materia), url = (APP.base || "") + l.arquivo;
    fecharLeitor(); LEITOR.livro = l; LEITOR.zoom = 1; LEITOR.feitas = new Set();
    CONT.innerHTML = `<div class="page bib-page bib-leitor">
      <div class="bib-barra">
        <button class="btn sm ghost" type="button" id="bib-voltar">← Biblioteca</button>
        <button class="btn sm" type="button" id="bib-sum-bt" aria-expanded="false">☰ Sumário</button>
        <span class="bib-tit"><span class="eyebrow" style="color:${cor}">${esc(nome)}</span><b>${esc(l.titulo)}</b></span>
        <span class="row bib-ctl"><button class="btn sm ghost" type="button" id="bib-menos" aria-label="Diminuir">−</button><button class="btn sm ghost" type="button" id="bib-mais" aria-label="Aumentar">+</button>
          <label class="small bib-ir">Pág. <input id="bib-pag" type="number" min="1" value="1" inputmode="numeric"> <span id="bib-tot">/ ${l.paginas || "…"}</span></label>
          <a class="btn sm ghost" href="${esc(url)}" download aria-label="Baixar o livro">⬇</a></span>
      </div>
      <div class="bib-corpo">
        <aside class="bib-sum" id="bib-sum" aria-label="Sumário"><h3>Sumário inteligente</h3><p class="small muted">Toque num assunto para ir direto à página.</p>${sumarioHTML(l)}
          ${l.licenca ? `<p class="small muted bib-lic">${esc(l.licenca)}</p>` : ""}</aside>
        <div class="bib-folhas" id="bib-folhas"><div class="card">Abrindo o livro…</div></div>
      </div></div>`;
    CONT.querySelector("#bib-voltar").onclick = () => { fecharLeitor(); tela(); };
    const sumEl = CONT.querySelector("#bib-sum"), sb = CONT.querySelector("#bib-sum-bt");
    sb.onclick = () => { const ab = !sumEl.classList.contains("aberto"); sumEl.classList.toggle("aberto", ab); sb.setAttribute("aria-expanded", ab); };
    sumEl.addEventListener("click", e => { const b = e.target.closest("[data-pg]"); if (!b) return; irPara(+b.dataset.pg); if (matchMedia("(max-width:900px)").matches) { sumEl.classList.remove("aberto"); sb.setAttribute("aria-expanded", "false"); } });
    CONT.querySelector("#bib-pag").onchange = e => irPara(+e.target.value);
    CONT.querySelector("#bib-mais").onclick = () => zoom(1.2);
    CONT.querySelector("#bib-menos").onclick = () => zoom(1 / 1.2);
    let lib;
    try { lib = await pdfjs(); LEITOR.doc = await lib.getDocument({ url, rangeChunkSize: 262144, disableAutoFetch: true, disableStream: false }).promise; }
    catch (e) { const f = CONT.querySelector("#bib-folhas"); if (f) f.innerHTML = `<div class="card stack"><b>Não foi possível abrir o livro aqui.</b><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir o PDF</a></div>`; return; }
    if (LEITOR.livro !== l) return;
    const p1 = await LEITOR.doc.getPage(1), v = p1.getViewport({ scale: 1 });
    LEITOR.prop = v.height / v.width; CONT.querySelector("#bib-tot").textContent = "/ " + LEITOR.doc.numPages;
    montarFolhas();
    irPara(pagina || lerPos(l.id) || l.inicio || 1, true);
  }
  function montarFolhas() {
    const box = CONT.querySelector("#bib-folhas"); if (!box) return;
    LEITOR.larg = Math.min(box.clientWidth - 8, 900) * LEITOR.zoom;
    const h = Math.round(LEITOR.larg * LEITOR.prop);
    box.innerHTML = Array.from({ length: LEITOR.doc.numPages }, (_, i) => `<div class="bib-folha" data-n="${i + 1}" style="width:${Math.round(LEITOR.larg)}px;height:${h}px"><span class="bib-num">${i + 1}</span></div>`).join("");
    LEITOR.feitas = new Set();
    if (LEITOR.obs) LEITOR.obs.disconnect();
    LEITOR.obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) desenhar(+e.target.dataset.n); }), { root: null, rootMargin: "600px 0px" });
    box.querySelectorAll(".bib-folha").forEach(f => LEITOR.obs.observe(f));
    window.removeEventListener("scroll", aoRolar); window.addEventListener("scroll", aoRolar, { passive: true });
  }
  async function desenhar(n) {
    if (!LEITOR.doc || LEITOR.feitas.has(n)) return; LEITOR.feitas.add(n);
    const el = CONT.querySelector(`.bib-folha[data-n="${n}"]`); if (!el) return;
    try {
      const pg = await LEITOR.doc.getPage(n), v0 = pg.getViewport({ scale: 1 }), esc2 = LEITOR.larg / v0.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const v = pg.getViewport({ scale: esc2 * dpr }), c = document.createElement("canvas");
      c.width = Math.floor(v.width); c.height = Math.floor(v.height); c.style.width = "100%"; c.style.height = "100%";
      await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      if (el.isConnected) { el.querySelectorAll("canvas").forEach(x => x.remove()); el.appendChild(c); }
    } catch (e) { LEITOR.feitas.delete(n); }
  }
  function irPara(n, semAnimar) {
    if (!LEITOR.doc) return; n = Math.max(1, Math.min(LEITOR.doc.numPages, n | 0));
    const el = CONT.querySelector(`.bib-folha[data-n="${n}"]`); if (!el) return;
    desenhar(n); el.scrollIntoView({ behavior: semAnimar ? "auto" : "smooth", block: "start" }); marcar(n);
  }
  function aoRolar() {
    if (!LEITOR.doc || !CONT || !CONT.querySelector("#bib-folhas")) { window.removeEventListener("scroll", aoRolar); return; }
    const fs = CONT.querySelectorAll(".bib-folha"); let n = 1;
    for (const f of fs) { if (f.getBoundingClientRect().top <= 140) n = +f.dataset.n; else break; }
    if (n !== LEITOR.atual) marcar(n);
  }
  function marcar(n) {
    LEITOR.atual = n; const inp = CONT.querySelector("#bib-pag"); if (inp && document.activeElement !== inp) inp.value = n;
    const l = LEITOR.livro; if (!l) return;
    clearTimeout(LEITOR.salvarT); LEITOR.salvarT = setTimeout(() => { try { localStorage.setItem(posKey(l.id), n); } catch (e) { } }, 400);
    let atual = -1; (l.sumario || []).forEach((c, i) => { if (c.p <= n) atual = i; });
    CONT.querySelectorAll(".bib-sum-cap").forEach(x => x.classList.toggle("on", +x.dataset.cap === atual));
  }
  function zoom(f) {
    const n = LEITOR.atual; LEITOR.zoom = Math.max(0.6, Math.min(2.5, LEITOR.zoom * f)); montarFolhas(); irPara(n, true);
  }
  function fecharLeitor() {
    if (LEITOR.obs) LEITOR.obs.disconnect(); LEITOR.obs = null;
    window.removeEventListener("scroll", aoRolar);
    if (LEITOR.doc) { try { LEITOR.doc.destroy(); } catch (e) { } } LEITOR.doc = null; LEITOR.livro = null;
  }
  function render(cont, app) { APP = app; CONT = cont; fecharLeitor(); tela(); }
  window.LAComp = window.LAComp || {};
  window.LAComp.Biblioteca = { render, sair: fecharLeitor };
})();
