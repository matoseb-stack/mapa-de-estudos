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

  async function carregar() {
    if (ST.livros) return ST.livros;
    const r = await fetch("biblioteca/indice.json", { cache: "no-cache" }); if (!r.ok) throw new Error(r.status);
    const d = await r.json(); return (ST.livros = Array.isArray(d.livros) ? d.livros : []);
  }
  function capa(l) {
    const [, nome, cor] = mat(l.materia);
    return `<span class="bib-capa" style="--cor:${cor}"><span class="bib-capa-mat">${esc(nome)}</span><span class="bib-capa-t">${esc(l.titulo)}</span>${l.autor ? `<span class="bib-capa-a">${esc(l.autor)}</span>` : ""}</span>`;
  }
  async function tela() {
    CONT.innerHTML = `<div class="page bib-page">${APP.pageHead("Biblioteca", "E-books e materiais de estudo, separados por matéria. Abra e leia aqui mesmo.")}<div class="card">Carregando…</div></div>`;
    let livros;
    try { livros = await carregar(); } catch (e) { CONT.querySelector(".card").outerHTML = `<div class="card"><b>Não foi possível abrir a biblioteca.</b> <span class="small muted">Confira a internet e tente de novo.</span></div>`; return; }
    const b = norm(ST.busca);
    const vis = livros.filter(l => (!ST.mat || l.materia === ST.mat) && (!b || norm(l.titulo + " " + (l.autor || "") + " " + (l.descricao || "") + " " + mat(l.materia)[1]).includes(b)));
    const cont = k => livros.filter(l => l.materia === k).length;
    const prat = MATS.filter(([k]) => (!ST.mat || k === ST.mat) && (vis.some(l => l.materia === k) || (!b && (ST.mat === k || !livros.length || cont(k)))));
    CONT.innerHTML = `<div class="page bib-page">${APP.pageHead("Biblioteca", "E-books e materiais de estudo, separados por matéria. Abra e leia aqui mesmo.")}
      <div class="card stack">
        <div class="qb-busca">${APP.ico ? APP.ico("search") : ""}<input id="bib-busca" type="search" placeholder="Buscar livro, autor ou assunto" value="${esc(ST.busca)}" aria-label="Buscar na biblioteca"></div>
        <div class="qb-chips"><button type="button" class="qb-chip ${ST.mat ? "" : "on"}" data-bm="">Todas (${livros.length})</button>${MATS.map(([k, n]) => `<button type="button" class="qb-chip ${ST.mat === k ? "on" : ""}" data-bm="${k}">${esc(n)}${cont(k) ? ` (${cont(k)})` : ""}</button>`).join("")}</div>
      </div>
      ${!livros.length ? `<div class="card stack bib-vazia"><b>📚 As prateleiras estão sendo montadas</b><span class="small muted">Os primeiros e-books chegam em breve, separados por matéria: Matemática, Português, Física, Química e as demais.</span></div>` : ""}
      ${prat.map(([k, n, cor]) => { const ls = vis.filter(l => l.materia === k); return `<section class="bib-prat"><h2 style="--cor:${cor}">${esc(n)} <small>${ls.length ? `${ls.length} ${ls.length === 1 ? "livro" : "livros"}` : "em breve"}</small></h2>
        <div class="bib-livros">${ls.length ? ls.map(l => `<button type="button" class="bib-livro" data-livro="${esc(l.id)}">${capa(l)}<span class="bib-nome">${esc(l.titulo)}</span>${l.paginas ? `<span class="small muted">${l.paginas} páginas</span>` : ""}</button>`).join("") : `<span class="small muted bib-vago">Nenhum livro nesta prateleira ainda.</span>`}</div></section>`; }).join("")}
      ${b && !vis.length ? `<div class="card">Nada encontrado para “${esc(ST.busca)}”.</div>` : ""}
    </div>`;
    const bi = CONT.querySelector("#bib-busca"); let t = null;
    bi.oninput = () => { clearTimeout(t); t = setTimeout(() => { ST.busca = bi.value; const pos = bi.selectionStart; tela().then(() => { const n = CONT.querySelector("#bib-busca"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }); }, 250); };
    CONT.querySelectorAll("[data-bm]").forEach(x => x.onclick = () => { ST.mat = x.dataset.bm; tela(); });
    CONT.querySelectorAll("[data-livro]").forEach(x => x.onclick = () => ler(livros.find(l => l.id === x.dataset.livro)));
  }
  function ler(l) {
    if (!l) return;
    const [, nome, cor] = mat(l.materia);
    CONT.innerHTML = `<div class="page bib-page bib-leitor">
      <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn sm ghost" type="button" id="bib-voltar">← Biblioteca</button>
        <div class="row" style="gap:6px"><a class="btn sm" href="${esc((APP.base || "") + l.arquivo)}" target="_blank" rel="noopener">Abrir em tela cheia</a><a class="btn sm" href="${esc((APP.base || "") + l.arquivo)}" download>Baixar</a></div>
      </div>
      <div class="card stack"><span class="eyebrow" style="color:${cor}">${esc(nome)}</span><h2>${esc(l.titulo)}</h2>${l.autor ? `<span class="small muted">${esc(l.autor)}</span>` : ""}${l.descricao ? `<p class="small">${esc(l.descricao)}</p>` : ""}</div>
      <iframe class="bib-pdf" src="${esc((APP.base || "") + l.arquivo)}#view=FitH" title="${esc(l.titulo)}"></iframe>
    </div>`;
    CONT.querySelector("#bib-voltar").onclick = () => tela();
  }
  function render(cont, app) { APP = app; CONT = cont; tela(); }
  window.LAComp = window.LAComp || {};
  window.LAComp.Biblioteca = { render };
})();
