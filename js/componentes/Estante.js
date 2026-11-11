/* Estante — aba "Minha estante": a pessoa organiza os próprios arquivos de estudo (PDF e imagens) em categorias
   que ela mesma cria (Matemática, Geografia…) e escreve por cima deles, como num caderno de tablet:
   a caneta escreve e o dedo rola a página. Também cria cadernos em branco (liso, pautado ou quadriculado).
   Tudo fica SÓ NO APARELHO (IndexedDB "la-estante-<uid>": arquivos, capas, desenhos e a lista), sem ocupar o site.
   Para levar um arquivo a outro aparelho: ⋯ › "Baixar com anotações" gera um arquivo .laest, que é aberto lá pelo "Enviar arquivo".
   (Versões anteriores guardavam cópia na nuvem em data/users/{uid}/estante: na primeira abertura, ela é trazida para o
   aparelho e apagada da nuvem.)
   Uso: LAComp.Estante.render(container, app)  ·  app: { uid, db, esc, ico, pageHead, toast, naTela } */
(function () {
  "use strict";
  const MAX_ARQ = 200 * 1024 * 1024;              // por arquivo; o total é o espaço que o navegador libera no aparelho
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const CORES_CAT = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#64748b"];
  const MODELOS = { liso: "Liso", pautado: "Pautado", quadriculado: "Quadriculado" };
  const E = { uid: null, meta: null, cat: "todas", busca: "", envios: {}, livre: null };
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const tamTxt = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : b < 1024 * 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${(b / 1073741824).toFixed(1).replace(".", ",")} GB`;

  /* ---------- armazenamento no aparelho (IndexedDB) ---------- */
  let dbp = null, dbUid = null;
  function idb() {
    if (dbp && dbUid === E.uid) return dbp;
    dbUid = E.uid;
    dbp = new Promise((ok, no) => {
      const r = indexedDB.open("la-estante-" + E.uid, 1);
      r.onupgradeneeded = () => ["arquivos", "anot", "capas", "meta"].forEach(n => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); });
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    return dbp;
  }
  async function lg(store, k) { const d = await idb(); return new Promise((ok, no) => { const r = d.transaction(store).objectStore(store).get(k); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
  async function gr(store, k, v) { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction(store, "readwrite"); t.objectStore(store).put(v, k); t.oncomplete = () => ok(); t.onerror = () => no(t.error); }); }
  async function ap(store, k) { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction(store, "readwrite"); t.objectStore(store).delete(k); t.oncomplete = () => ok(); t.onerror = () => no(t.error); }); }
  // pede ao navegador para não apagar a estante quando faltar espaço, e mede quanto ainda cabe
  async function espaco() {
    try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {}
    try { if (navigator.storage && navigator.storage.estimate) { const r = await navigator.storage.estimate(); E.livre = Math.max(0, (r.quota || 0) - (r.usage || 0)); } } catch (e) { E.livre = null; }
  }

  let APP = null;
  async function salvarMeta() { E.meta.atual = Date.now(); await gr("meta", "meta", E.meta).catch(() => {}); }
  async function carregarMeta() {
    const m = await lg("meta", "meta").catch(() => null);
    E.meta = m || { categorias: [], arquivos: [], atual: 0 };
    E.meta.categorias = E.meta.categorias || []; E.meta.arquivos = E.meta.arquivos || [];
    await trazerDaNuvem();
  }
  /* versão anterior: traz para o aparelho o que estava na nuvem e apaga de lá (uma vez por conta) */
  async function trazerDaNuvem() {
    const db = APP && APP.db && APP.db(); if (!db || E.uid === "visitante") return;
    const chave = "la_estante_local_" + E.uid; try { if (localStorage.getItem(chave)) return; } catch (e) {}
    const deB64 = t => { const b = atob(t), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    try {
      const raiz = db.collection("data/users/" + E.uid).doc("estante"), s = await raiz.get();
      if (s.exists) {
        const c = s.data() || {}, apagar = [];
        (c.categorias || []).forEach(k => { if (!E.meta.categorias.some(x => x.id === k.id)) E.meta.categorias.push(k); });
        const anotLocal = {};
        for (const a of c.arquivos || []) {
          for (let i = 0; i < (a.partes || 0); i++) apagar.push(raiz.collection("partes").doc(a.id + "_" + i));
          (a.ap || []).forEach(pg => apagar.push(raiz.collection("anot").doc(a.id + "_" + pg))); apagar.push(raiz.collection("capas").doc(a.id));
          if (E.meta.arquivos.some(x => x.id === a.id)) continue;
          if (a.tipo !== "caderno") {
            if (!a.partes) continue;                       // nunca chegou a subir inteiro
            const partes = []; for (let i = 0; i < a.partes; i++) { const d = await raiz.collection("partes").doc(a.id + "_" + i).get(); if (!d.exists) throw new Error("pedaço faltando"); partes.push(deB64(d.data().d)); }
            await gr("arquivos", a.id, new Blob(partes, { type: a.mime || "application/octet-stream" }));
          }
          const pags = {}; for (const pg of a.ap || []) { const d = await raiz.collection("anot").doc(a.id + "_" + pg).get(); if (d.exists) pags[pg] = JSON.parse(d.data().s || "[]"); }
          if (Object.keys(pags).length) { anotLocal[a.id] = pags; await gr("anot", a.id, { pags, em: Date.now() }); }
          const cp = await raiz.collection("capas").doc(a.id).get().catch(() => null); const capa = cp && cp.exists ? cp.data().d : null;
          if (capa) await gr("capas", a.id, capa).catch(() => {});
          const { partes, nuvem, ...resto } = a; E.meta.arquivos.push({ ...resto, capa });
        }
        await salvarMeta();
        for (const r of apagar) await r.delete().catch(() => {});
        await raiz.delete().catch(() => {});
        if ((c.arquivos || []).length) APP.toast("Sua estante agora fica só neste aparelho: os arquivos da nuvem foram trazidos para cá.");
      }
      try { localStorage.setItem(chave, "1"); } catch (e) {}
    } catch (e) { console.warn("estante: trazer da nuvem", e); }
  }
  async function blobDe(a) {
    if (a.tipo === "caderno") return null;
    const b = await lg("arquivos", a.id).catch(() => null); if (b) return b;
    throw new Error("arquivo não está neste aparelho");
  }
  /* pacote .laest: o arquivo + as anotações, para abrir em outro aparelho */
  const MAGICO = "LAEST1\n";
  async function exportarPacote(a) {
    const anot = await lg("anot", a.id).catch(() => null), b = await blobDe(a).catch(() => null);
    if (a.tipo !== "caderno" && !b) { APP.toast("Este arquivo não está neste aparelho."); return; }
    const { capa, ...info } = a, cab = JSON.stringify({ info, anot: anot ? anot.pags : {}, capa: capa || null });
    const tamCab = new TextEncoder().encode(cab).length;
    baixar(new Blob([MAGICO, String(tamCab).padStart(12, "0"), cab, b || new Blob([])], { type: "application/octet-stream" }), a.nome + ".laest");
    APP.toast("Pronto! No outro aparelho, abra a estante e use “Enviar arquivo” com este .laest.");
  }
  async function ehPacote(f) { if (/\.laest$/i.test(f.name)) return true; try { return (await f.slice(0, MAGICO.length).text()) === MAGICO; } catch (e) { return false; } }
  async function importarPacote(f) {
    try {
      const n = +(await f.slice(MAGICO.length, MAGICO.length + 12).text()), ini = MAGICO.length + 12;
      const bytesCab = await f.slice(ini, ini + n).arrayBuffer(), cab = JSON.parse(new TextDecoder().decode(bytesCab)), info = cab.info || {};
      if (!info.tipo) throw new Error("pacote inválido");
      const id = E.meta.arquivos.some(x => x.id === info.id) ? novoId() : (info.id || novoId());
      if (info.tipo !== "caderno") await gr("arquivos", id, new Blob([f.slice(ini + n)], { type: info.mime || "application/octet-stream" }));
      if (cab.anot && Object.keys(cab.anot).length) await gr("anot", id, { pags: cab.anot, em: Date.now() });
      if (cab.capa) await gr("capas", id, cab.capa).catch(() => {});
      const cat = catDe(info.cat) ? info.cat : (catDe(E.cat) ? E.cat : "");
      E.meta.arquivos.push({ ...info, id, cat, criado: info.criado || Date.now(), capa: cab.capa || null, ap: Object.keys(cab.anot || {}).filter(k => (cab.anot[k] || []).length).map(Number) });
      await salvarMeta(); APP.toast(`“${info.nome}” chegou com as anotações.`); return true;
    } catch (e) { console.warn("pacote", e); APP.toast(`Não foi possível abrir “${f.name}”.`); return false; }
  }

  /* ---------- PDF (pdf.js, carregado só quando precisa) ---------- */
  let pdfjsP = null;
  function pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsP) pdfjsP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      s.onerror = () => { pdfjsP = null; no(new Error("pdf.js")); }; document.head.appendChild(s); });
    return pdfjsP;
  }
  async function capaDe(tipo, blob, modelo) {
    const cv = document.createElement("canvas"), W = 220;
    try {
      if (tipo === "pdf") {
        const lib = await pdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, pg = await doc.getPage(1);
        const v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: W / v0.width });
        cv.width = W; cv.height = Math.round(v.height); await pg.render({ canvasContext: cv.getContext("2d"), viewport: v }).promise;
        const r = { capa: cv.toDataURL("image/jpeg", 0.7), paginas: doc.numPages }; doc.destroy(); return r;
      }
      if (tipo === "img") {
        const im = await imagem(blob); cv.width = W; cv.height = Math.round(W * im.height / im.width);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); return { capa: cv.toDataURL("image/jpeg", 0.7), paginas: 1 };
      }
      cv.width = W; cv.height = Math.round(W * 1.414); fundoCaderno(cv.getContext("2d"), cv.width, cv.height, modelo);
      return { capa: cv.toDataURL("image/jpeg", 0.8), paginas: 1 };
    } catch (e) { console.warn("capa", e); return { capa: null, paginas: tipo === "pdf" ? 0 : 1 }; }
  }
  const imagem = blob => new Promise((ok, no) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = no; im.src = u; });
  function fundoCaderno(ctx, w, h, modelo) {
    ctx.fillStyle = "#fffef9"; ctx.fillRect(0, 0, w, h);
    const p = w / 26;                                     // espaço das linhas proporcional à largura
    ctx.lineWidth = Math.max(1, w / 900);
    if (modelo === "pautado") { ctx.strokeStyle = "#c7d7f2"; for (let y = p * 3; y < h - p / 2; y += p) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "#f3a5a5"; ctx.beginPath(); ctx.moveTo(p * 2.2, 0); ctx.lineTo(p * 2.2, h); ctx.stroke(); }
    if (modelo === "quadriculado") { ctx.strokeStyle = "#dbe4f3"; const q = p * 0.8; for (let x = q; x < w; x += q) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = q; y < h; y += q) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
  }

  /* ---------- tela da estante ---------- */
  let CONT = null;
  async function render(container, app) {
    APP = app; CONT = container; container.onclick = null;
    const uid = app.uid(); if (E.uid !== uid) Object.assign(E, { uid, meta: null, cat: "todas", busca: "" });
    if (!E.meta) {
      container.innerHTML = `<div class="page">${app.pageHead("Minha estante", "Seus arquivos de estudo organizados por matéria.")}<div class="card row muted"><span class="spinner"></span>Abrindo sua estante…</div></div>`;
      try { await carregarMeta(); } catch (e) { E.meta = { categorias: [], arquivos: [], atual: 0 }; }
      await espaco();
      if (!app.naTela()) return;
      completarCapas();
    }
    pintar();
  }
  // capas guardadas à parte (a lista fica leve)
  async function completarCapas() {
    for (const a of E.meta.arquivos) {
      if (a.capa) continue;
      const c = await lg("capas", a.id).catch(() => null);
      if (c) { a.capa = c; pintarCartao(a.id); }
    }
  }
  const catDe = id => E.meta.categorias.find(c => c.id === id);
  function visiveis() {
    const q = (E.busca || "").toLowerCase().trim();
    return E.meta.arquivos.filter(a => (E.cat === "todas" || (E.cat === "sem" ? !catDe(a.cat) : a.cat === E.cat)) && (!q || a.nome.toLowerCase().includes(q)))
      .sort((x, y) => (y.aberto || y.criado) - (x.aberto || x.criado));
  }
  function pintar() {
    const { esc, ico } = APP, M = E.meta, total = M.arquivos.reduce((s, a) => s + (a.tam || 0), 0), semCat = M.arquivos.filter(a => !catDe(a.cat)).length;
    if (E.cat !== "todas" && E.cat !== "sem" && !catDe(E.cat)) E.cat = "todas";
    const lista = visiveis(), cat = catDe(E.cat);
    CONT.innerHTML = `<div class="page estante">
      ${APP.pageHead("Minha estante", "Organize seus PDFs, fotos e cadernos por matéria e escreva por cima deles.",
        `<button class="btn" type="button" data-e="caderno">${ico("edit")}Novo caderno</button><button class="btn primary" type="button" data-e="enviar">${ico("upload")}Enviar arquivo</button>`)}
      <input type="file" id="est-arq" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,.laest" multiple hidden>
      <div class="est-cats" role="tablist" aria-label="Categorias">
        <button type="button" role="tab" class="est-cat ${E.cat === "todas" ? "on" : ""}" data-cat="todas" aria-selected="${E.cat === "todas"}">📚 Todos <small>${M.arquivos.length}</small></button>
        ${M.categorias.map(c => `<button type="button" role="tab" class="est-cat ${E.cat === c.id ? "on" : ""}" data-cat="${c.id}" aria-selected="${E.cat === c.id}"><i style="background:${c.cor}"></i>${esc(c.nome)} <small>${M.arquivos.filter(a => a.cat === c.id).length}</small></button>`).join("")}
        ${semCat && M.categorias.length ? `<button type="button" role="tab" class="est-cat ${E.cat === "sem" ? "on" : ""}" data-cat="sem">Sem categoria <small>${semCat}</small></button>` : ""}
        <button type="button" class="est-cat nova" data-e="nova-cat">＋ Nova categoria</button>
      </div>
      <div class="row est-barra">
        <input type="search" id="est-busca" placeholder="Buscar arquivo pelo nome" value="${esc(E.busca)}" aria-label="Buscar arquivo">
        ${cat ? `<button class="btn sm ghost" type="button" data-e="edit-cat">${ico("gear")}Editar “${esc(cat.nome)}”</button>` : ""}
        <span class="small muted" style="margin-left:auto">${M.arquivos.length} ${M.arquivos.length === 1 ? "arquivo" : "arquivos"} · ${tamTxt(total)}${E.livre != null ? ` · ${tamTxt(E.livre)} livres` : ""} · 📱 só neste aparelho</span>
      </div>
      ${lista.length ? `<div class="est-grade">${lista.map(cartao).join("")}</div>`
        : `<div class="card est-vazia" data-e="enviar"><div class="est-vazia-ic">📂</div><h3>${M.arquivos.length ? "Nada nesta categoria ainda" : "Sua estante está vazia"}</h3>
            <p class="muted small">Envie PDFs de apostilas e listas, fotos do caderno ou crie um caderno em branco. Depois é só abrir e escrever por cima com caneta ou marca-texto.</p>
            <p class="small"><b>Toque aqui</b> ou arraste os arquivos para esta tela.</p></div>`}
      <p class="hint">Aceita PDF e imagens (JPG, PNG, WebP) de até ${tamTxt(MAX_ARQ)}. Os arquivos e os desenhos ficam guardados só neste aparelho, sem ocupar espaço no site. Para abrir em outro aparelho, toque em ⋯ › “Baixar com anotações” e envie o arquivo .laest na estante do outro aparelho.</p>
    </div>`;
    ligar();
  }
  function cartao(a) {
    const { esc } = APP, c = catDe(a.cat), env = E.envios[a.id];
    const tipo = a.tipo === "pdf" ? "PDF" : a.tipo === "img" ? "Imagem" : `Caderno ${MODELOS[a.modelo] ? MODELOS[a.modelo].toLowerCase() : ""}`;
    return `<div class="est-arq" data-arq="${a.id}">
      <button type="button" class="est-capa" data-abrir="${a.id}" aria-label="Abrir ${esc(a.nome)}">${a.capa ? `<img src="${a.capa}" alt="">` : `<span class="est-capa-ic">${a.tipo === "pdf" ? "📄" : a.tipo === "img" ? "🖼️" : "📓"}</span>`}
        ${a.ap && a.ap.length ? `<span class="est-marcado" title="Tem anotações">✏️</span>` : ""}</button>
      <div class="est-info"><b title="${esc(a.nome)}">${esc(a.nome)}</b>
        <span class="small muted">${tipo}${a.paginas ? ` · ${a.paginas} ${a.paginas === 1 ? "página" : "páginas"}` : ""}${a.tam ? ` · ${tamTxt(a.tam)}` : ""}</span>
        <span class="small">${c ? `<i class="est-dot" style="background:${c.cor}"></i>${esc(c.nome)}` : `<span class="muted">Sem categoria</span>`}${env != null ? ` · <span class="muted">☁️ ${Math.round(env * 100)}%</span>` : ""}</span></div>
      <button type="button" class="btn icon ghost est-menu" data-menu="${a.id}" aria-label="Opções de ${esc(a.nome)}">⋯</button></div>`;
  }
  function pintarCartao(id) {
    const el = CONT && CONT.querySelector(`[data-arq="${id}"]`), a = E.meta && E.meta.arquivos.find(x => x.id === id);
    if (el && a) { const t = document.createElement("div"); t.innerHTML = cartao(a); el.replaceWith(t.firstElementChild); }
  }
  function ligar() {
    const inp = CONT.querySelector("#est-arq");
    inp.onchange = () => { const fs = [...inp.files]; inp.value = ""; enviar(fs); };
    const busca = CONT.querySelector("#est-busca");
    busca.oninput = () => { E.busca = busca.value; const g = CONT.querySelector(".est-grade,.est-vazia"); const lista = visiveis();
      if (g && g.classList.contains("est-grade")) g.innerHTML = lista.map(cartao).join("") || `<p class="small muted">Nenhum arquivo com esse nome.</p>`; };
    CONT.onclick = e => {
      const c = e.target.closest("[data-cat]"); if (c) { E.cat = c.dataset.cat; pintar(); return; }
      const ab = e.target.closest("[data-abrir]"); if (ab) { abrir(ab.dataset.abrir); return; }
      const mn = e.target.closest("[data-menu]"); if (mn) { menuArquivo(mn.dataset.menu, mn); return; }
      const b = e.target.closest("[data-e]"); if (!b) return;
      const x = b.dataset.e;
      if (x === "enviar") inp.click();
      else if (x === "caderno") modalCaderno();
      else if (x === "nova-cat") modalCategoria();
      else if (x === "edit-cat") modalCategoria(catDe(E.cat));
    };
    // arrastar arquivos para a tela
    const pg = CONT.querySelector(".estante");
    pg.ondragover = e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); pg.classList.add("soltar"); } };
    pg.ondragleave = e => { if (e.target === pg) pg.classList.remove("soltar"); };
    pg.ondrop = e => { e.preventDefault(); pg.classList.remove("soltar"); enviar([...(e.dataTransfer.files || [])]); };
  }

  /* ---------- enviar arquivos ---------- */
  async function enviar(files) {
    if (!files.length) return;
    await espaco(); let livre = E.livre;
    for (const f of files) {
      if (await ehPacote(f)) { if (await importarPacote(f) && APP.naTela()) pintar(); continue; }
      const tipo = f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : /^image\/(png|jpe?g|webp|gif)$/.test(f.type) ? "img" : null;
      if (!tipo) { APP.toast(`“${f.name}” não é PDF nem imagem.`); continue; }
      if (f.size > MAX_ARQ) { APP.toast(`“${f.name}” passa de ${tamTxt(MAX_ARQ)}. Divida o PDF ou comprima a imagem.`); continue; }
      if (livre != null && f.size * 1.1 > livre) { APP.toast(`Não há espaço livre neste aparelho para “${f.name}”. Apague arquivos antigos da estante ou libere espaço.`); break; }
      if (livre != null) livre -= f.size;
      APP.toast(`Guardando “${f.name}”…`);
      const id = novoId(), info = await capaDe(tipo, f);
      if (tipo === "pdf" && !info.paginas) { APP.toast(`Não foi possível ler “${f.name}”. O PDF pode estar protegido ou danificado.`); continue; }
      const a = { id, nome: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Arquivo", tipo, mime: f.type || "application/pdf", tam: f.size, paginas: info.paginas,
        cat: catDe(E.cat) ? E.cat : "", criado: Date.now(), ap: [] };
      try { await gr("arquivos", id, f); } catch (e) { APP.toast(`Não coube “${f.name}” neste aparelho (${(e && e.name) || "erro"}).`); continue; }
      if (info.capa) await gr("capas", id, info.capa).catch(() => {});
      E.meta.arquivos.push({ ...a, capa: info.capa }); await salvarMeta();
      if (APP.naTela()) pintar();
    }
  }
  /* ---------- caderno em branco ---------- */
  function modalCaderno() {
    const { esc } = APP, bg = modal(`<h3 style="margin:0">Novo caderno</h3>
      <div class="field"><label for="ec-nome">Nome</label><input type="text" id="ec-nome" maxlength="80" value="Caderno de ${esc(catDe(E.cat) ? catDe(E.cat).nome : "estudos")}"></div>
      <div class="field"><label>Folha</label><div class="seg" id="ec-mod">${Object.entries(MODELOS).map(([k, n], i) => `<button type="button" data-mod="${k}" class="${i === 1 ? "on" : ""}">${n}</button>`).join("")}</div></div>
      ${selectCat("ec-cat", catDe(E.cat) ? E.cat : "")}
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Criar</button></div>`);
    let mod = "pautado";
    bg.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => { mod = b.dataset.mod; bg.querySelectorAll("[data-mod]").forEach(x => x.classList.toggle("on", x === b)); });
    bg.querySelector("[data-ok]").onclick = async () => {
      const nome = bg.querySelector("#ec-nome").value.trim() || "Caderno", cat = bg.querySelector("#ec-cat").value, info = await capaDe("caderno", null, mod), id = novoId();
      const a = { id, nome, tipo: "caderno", modelo: mod, tam: 0, paginas: 1, cat, criado: Date.now(), ap: [] };
      if (info.capa) await gr("capas", id, info.capa).catch(() => {});
      E.meta.arquivos.push({ ...a, capa: info.capa }); await salvarMeta(); bg.remove(); pintar(); abrir(id);
    };
  }
  function selectCat(id, atual) {
    const { esc } = APP;
    return `<div class="field"><label for="${id}">Categoria</label><select id="${id}"><option value="">Sem categoria</option>${E.meta.categorias.map(c => `<option value="${c.id}" ${c.id === atual ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>`;
  }
  /* ---------- categorias ---------- */
  function modalCategoria(c) {
    const { esc } = APP, nova = !c; c = c || { id: novoId(), nome: "", cor: CORES_CAT[E.meta.categorias.length % CORES_CAT.length] };
    const bg = modal(`<h3 style="margin:0">${nova ? "Nova categoria" : "Editar categoria"}</h3>
      <div class="field"><label for="ecat-nome">Nome</label><input type="text" id="ecat-nome" maxlength="40" placeholder="Ex.: Matemática, Geografia, Redação" value="${esc(c.nome)}"></div>
      <div class="field"><label>Cor</label><div class="est-cores">${CORES_CAT.map(k => `<button type="button" class="est-cor ${k === c.cor ? "on" : ""}" data-cor="${k}" style="background:${k}" aria-label="Cor ${k}"></button>`).join("")}</div></div>
      <div class="row" style="justify-content:space-between">${nova ? "<span></span>" : `<button class="btn ghost danger" type="button" data-del>Apagar categoria</button>`}
        <span class="row"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>${nova ? "Criar" : "Salvar"}</button></span></div>`);
    let cor = c.cor;
    bg.querySelectorAll("[data-cor]").forEach(b => b.onclick = () => { cor = b.dataset.cor; bg.querySelectorAll("[data-cor]").forEach(x => x.classList.toggle("on", x === b)); });
    const inp = bg.querySelector("#ecat-nome"); setTimeout(() => inp.focus(), 50);
    bg.querySelector("[data-ok]").onclick = async () => {
      const nome = inp.value.trim(); if (!nome) { inp.focus(); return; }
      if (E.meta.categorias.some(x => x.id !== c.id && x.nome.toLowerCase() === nome.toLowerCase())) { APP.toast("Já existe uma categoria com esse nome."); return; }
      if (nova) E.meta.categorias.push({ id: c.id, nome, cor }); else Object.assign(catDe(c.id), { nome, cor });
      E.cat = c.id; await salvarMeta(); bg.remove(); pintar();
    };
    const del = bg.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      const n = E.meta.arquivos.filter(a => a.cat === c.id).length;
      if (!await perguntar(`Apagar a categoria “${c.nome}”?`, n ? `Os ${n} arquivos dela não são apagados: vão para “Sem categoria”.` : "", "Apagar categoria", true)) return;
      E.meta.categorias = E.meta.categorias.filter(x => x.id !== c.id); E.meta.arquivos.forEach(a => { if (a.cat === c.id) a.cat = ""; });
      E.cat = "todas"; await salvarMeta(); bg.remove(); pintar();
    };
  }
  /* ---------- menu do arquivo ---------- */
  function menuArquivo(id, ancora) {
    document.querySelectorAll(".est-pop").forEach(x => x.remove());
    const a = E.meta.arquivos.find(x => x.id === id); if (!a) return;
    const pop = document.createElement("div"); pop.className = "est-pop card";
    pop.innerHTML = `<button type="button" data-m="abrir">Abrir</button><button type="button" data-m="renomear">Renomear</button><button type="button" data-m="mover">Mudar de categoria</button>
      <button type="button" data-m="pacote">Baixar com anotações <small class="muted">(para outro aparelho)</small></button>
      ${a.tipo !== "caderno" ? `<button type="button" data-m="baixar">Baixar o original</button>` : ""}<button type="button" data-m="apagar" class="danger">Apagar</button>`;
    document.body.appendChild(pop);
    const r = ancora.getBoundingClientRect(); pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + "px"; pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    const fechar = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("pointerdown", fechar, true); } };
    setTimeout(() => document.addEventListener("pointerdown", fechar, true), 0);
    pop.onclick = async e => {
      const m = e.target.closest("[data-m]"); if (!m) return; pop.remove(); document.removeEventListener("pointerdown", fechar, true);
      const x = m.dataset.m;
      if (x === "abrir") abrir(id);
      else if (x === "renomear") { const n = await pedirTexto("Renomear arquivo", "Novo nome", a.nome); if (n) { a.nome = n.slice(0, 80); await salvarMeta(); pintar(); } }
      else if (x === "mover") { const bg = modal(`<h3 style="margin:0">Mudar “${APP.esc(a.nome)}” de categoria</h3>${selectCat("em-cat", a.cat)}
          <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Mover</button></div>`);
        bg.querySelector("[data-ok]").onclick = async () => { a.cat = bg.querySelector("#em-cat").value; await salvarMeta(); bg.remove(); pintar(); }; }
      else if (x === "baixar") { try { const b = await blobDe(a); baixar(b, a.nome + (a.tipo === "pdf" ? ".pdf" : "." + ((a.mime || "").split("/")[1] || "png"))); } catch (err) { APP.toast("Não foi possível baixar agora."); } }
      else if (x === "pacote") exportarPacote(a);
      else if (x === "apagar") apagar(a);
    };
  }
  async function apagar(a) {
    if (!await perguntar(`Apagar “${a.nome}”?`, "O arquivo e todas as anotações dele somem deste aparelho. Não dá para desfazer.", "Apagar", true)) return;
    E.meta.arquivos = E.meta.arquivos.filter(x => x.id !== a.id); await salvarMeta(); pintar();
    await Promise.all([ap("arquivos", a.id), ap("anot", a.id), ap("capas", a.id)].map(p => p.catch(() => {})));
    APP.toast("Arquivo apagado.");
  }
  function baixar(blob, nome) { const u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = nome; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  function modal(html, empilhar) {
    if (!empilhar) document.querySelectorAll(".modal-bg").forEach(m => m.remove());
    const bg = document.createElement("div"); bg.className = "modal-bg est-modal";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" style="width:min(460px,100%)">${html}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); });
    return bg;
  }

  /* ================= leitor com caneta (visual inspirado nos cadernos digitais de tablet) ================= */
  // traço: { f: "caneta"|"lapis"|"marca", c: cor, w: espessura (fração da largura da página × 10000),
  //          p: [x, y, x, y…] em 0..10000, q?: [pressão 0..100 por ponto] (só com caneta de tablet) }
  const PALETA = ["#111827", "#4b5563", "#2563eb", "#0ea5e9", "#16a34a", "#65a30d", "#dc2626", "#f97316", "#ca8a04", "#9333ea", "#db2777", "#7c2d12"];
  const PALETA_MARCA = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fdba74", "#c4b5fd"];
  const TAMANHOS = { caneta: [10, 16, 24, 36, 54], lapis: [10, 14, 20, 28, 40], marca: [70, 100, 140, 190, 260], borracha: [60, 110, 170, 260, 400] };
  const NOMES_F = { caneta: "Caneta", lapis: "Lápis", marca: "Marca-texto", borracha: "Borracha", mao: "Mover" };
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra || ""}</svg>`;
  const ICF = {
    caneta: svg(`<path d="M4.5 19.5l1-4.2L16.2 4.6a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5z"/><path d="M14.5 6.3l3.2 3.2"/>`),
    lapis: svg(`<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M6 15l3 3"/><path d="M14 7l3 3"/>`),
    marca: svg(`<path d="M9.5 14.5l-4 4.5h5.5l1.3-1.5"/><path d="M9.5 14.5l2.8 2.8 8.2-8.2-2.8-2.8z"/>`),
    borracha: svg(`<path d="M8 20h11"/><path d="M4.6 14.6l8.8-8.8a2 2 0 012.8 0l2 2a2 2 0 010 2.8L11 18.8 8 19z"/><path d="M9.5 9.7l4.8 4.8"/>`),
    mao: svg(`<path d="M8 12.5V6a1.5 1.5 0 013 0v5m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v6.5m0-3a1.5 1.5 0 013 0V14c0 4-3 7-7 7-2.7 0-4.4-1.2-6-3.6l-2.3-3.4a1.6 1.6 0 012.6-1.8L8 14"/>`),
    desfazer: svg(`<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>`),
    refazer: svg(`<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>`),
    mais: svg(`<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>`),
    voltar: svg(`<path d="M15 18l-6-6 6-6"/>`),
    paleta: svg(`<path d="M12 3a9 9 0 100 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 005-5c0-4.1-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.3" r="1.2" fill="currentColor"/><circle cx="15" cy="7.8" r="1.2" fill="currentColor"/>`),
    lixo: svg(`<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>`),
    zoomMais: svg(`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3M8.5 11h5M11 8.5v5"/>`),
    zoomMenos: svg(`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3M8.5 11h5"/>`)
  };
  const V = { a: null, pdf: null, img: null, pags: [], anot: {}, ferr: "caneta",
    cfg: { caneta: { c: PALETA[0], w: 24 }, lapis: { c: PALETA[1], w: 14 }, marca: { c: PALETA_MARCA[0], w: 140 }, borracha: { w: 170 } },
    recentes: [PALETA[0], PALETA[2], PALETA[6], PALETA[4]], dedoEscreve: false, zoom: 1, desf: [], ref: [], sujas: new Set(), timer: null, obs: null, raf: 0 };
  try { const s = JSON.parse(localStorage.getItem("la_estante_caneta") || "null"); if (s) { Object.assign(V.cfg, s.cfg || {}); if (s.recentes) V.recentes = s.recentes; if (s.ferr) V.ferr = s.ferr; V.dedoEscreve = !!s.dedoEscreve; } } catch (e) {}
  const guardarPrefs = () => { try { localStorage.setItem("la_estante_caneta", JSON.stringify({ cfg: V.cfg, recentes: V.recentes, ferr: V.ferr, dedoEscreve: V.dedoEscreve })); } catch (e) {} };

  // janela de confirmação própria (as caixas do navegador falham em alguns tablets e apps instalados)
  function perguntar(titulo, texto, botao, perigo) {
    return new Promise(ok => {
      const bg = modal(`<h3 style="margin:0">${APP.esc(titulo)}</h3>${texto ? `<p class="small muted" style="margin:0">${APP.esc(texto)}</p>` : ""}
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn ${perigo ? "danger-sol" : "primary"}" type="button" data-ok>${APP.esc(botao)}</button></div>`, true);
      const fim = v => { if (bg.isConnected) bg.remove(); ok(v); };
      bg.querySelector("[data-ok]").onclick = () => fim(true);
      bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-x]")) fim(false); });
      setTimeout(() => bg.querySelector("[data-ok]").focus(), 50);
    });
  }
  function pedirTexto(titulo, rotulo, valor) {
    return new Promise(ok => {
      const bg = modal(`<h3 style="margin:0">${APP.esc(titulo)}</h3><div class="field"><label for="est-txt">${APP.esc(rotulo)}</label><input type="text" id="est-txt" maxlength="80" value="${APP.esc(valor || "")}"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Salvar</button></div>`, true);
      const inp = bg.querySelector("#est-txt"), fim = v => { if (bg.isConnected) bg.remove(); ok(v); };
      bg.querySelector("[data-ok]").onclick = () => fim(inp.value.trim() || null);
      inp.onkeydown = e => { if (e.key === "Enter") fim(inp.value.trim() || null); };
      bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-x]")) fim(null); });
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
    });
  }

  async function abrir(id) {
    const a = E.meta.arquivos.find(x => x.id === id); if (!a) return;
    a.aberto = Date.now(); salvarMeta();
    const ov = document.createElement("div"); ov.className = "est-leitor"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", a.nome);
    ov.innerHTML = `<div class="est-top">
        <button class="est-ic" type="button" data-v="voltar" aria-label="Voltar para a estante" title="Voltar">${ICF.voltar}</button>
        <div class="est-tt"><b class="est-titulo">${APP.esc(a.nome)}</b><span class="est-st" data-v-st></span></div>
        <button class="est-ic" type="button" data-v="desfazer" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled>${ICF.desfazer}</button>
        <button class="est-ic" type="button" data-v="refazer" aria-label="Refazer" title="Refazer (Ctrl+Y)" disabled>${ICF.refazer}</button>
        <button class="est-ic est-so-larga" type="button" data-v="menos" aria-label="Diminuir zoom" title="Diminuir">${ICF.zoomMenos}</button>
        <button class="est-zoom" type="button" data-v="zoom100" data-zoom title="Voltar ao tamanho da tela">100%</button>
        <button class="est-ic est-so-larga" type="button" data-v="mais" aria-label="Aumentar zoom" title="Aumentar">${ICF.zoomMais}</button>
        <button class="est-ic" type="button" data-v="menu" aria-label="Mais opções" title="Mais opções" aria-haspopup="menu">${ICF.mais}</button>
      </div>
      <div class="est-pags" tabindex="0"><div class="card row muted" style="margin:24px auto;max-width:420px"><span class="spinner"></span>Abrindo…</div></div>`;
    document.body.appendChild(ov); document.documentElement.classList.add("est-aberto");
    Object.assign(V, { a, pdf: null, img: null, pags: [], anot: {}, desf: [], ref: [], sujas: new Set(), zoom: 1, ov, salvoEm: 0 });
    ov.querySelector('[data-v="voltar"]').onclick = fecharLeitor;
    V.tecla = e => {
      if (document.querySelector(".est-modal")) return;
      if (e.key === "Escape") { if (ov.querySelector(".est-painel,.est-menu-v")) fecharPaineis(); else fecharLeitor(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); refazer(); }
    };
    addEventListener("keydown", V.tecla);
    try {
      const blob = await blobDe(a);
      if (a.tipo === "pdf") { const lib = await pdfjs(); V.pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        for (let i = 1; i <= V.pdf.numPages; i++) { const v = (await V.pdf.getPage(i)).getViewport({ scale: 1 }); V.pags.push({ n: i, w: v.width, h: v.height }); }
        if (a.paginas !== V.pdf.numPages) { a.paginas = V.pdf.numPages; salvarMeta(); } }
      else if (a.tipo === "img") { V.img = await imagem(blob); V.pags.push({ n: 1, w: V.img.width, h: V.img.height }); }
      else for (let i = 1; i <= (a.paginas || 1); i++) V.pags.push({ n: i, w: 1000, h: 1414 });
      await carregarAnot();
    } catch (e) {
      console.warn("abrir", e);
      ov.querySelector(".est-pags").innerHTML = `<div class="card stack" style="margin:24px auto;max-width:460px"><b>Não foi possível abrir este arquivo.</b><p class="small muted">Ele não está guardado neste aparelho. No aparelho onde ele está, use ⋯ › “Baixar com anotações” e envie o arquivo .laest aqui.</p></div>`;
      return;
    }
    if (!ov.isConnected) return;
    montarBarra(); montarPaginas();
  }
  async function carregarAnot() {
    const loc = await lg("anot", V.a.id).catch(() => null); V.anot = (loc && loc.pags) || {};
  }
  function fecharLeitor() {
    if (!V.ov) return; salvarAnot(true);
    removeEventListener("keydown", V.tecla); if (V.obs) V.obs.disconnect();
    if (V.pdf) { try { V.pdf.destroy(); } catch (e) {} }
    document.querySelectorAll(".est-modal").forEach(m => m.remove());
    V.ov.remove(); V.ov = null; document.documentElement.classList.remove("est-aberto");
    if (APP.naTela()) pintar();
  }
  const ehCaderno = () => V.a && V.a.tipo === "caderno";
  const corDe = f => (V.cfg[f] && V.cfg[f].c) || PALETA[0];
  function fecharPaineis() { if (V.ov) V.ov.querySelectorAll(".est-painel,.est-menu-v").forEach(x => x.remove()); }

  /* ---------- barra de ferramentas (em pílula, centralizada) ---------- */
  function montarBarra() {
    const top = V.ov.querySelector(".est-top"), w = document.createElement("div"); w.className = "est-ferr-w";
    w.innerHTML = `<div class="est-ferr" role="toolbar" aria-label="Ferramentas de desenho"></div>`;
    top.after(w); V.barra = w.querySelector(".est-ferr");
    pintarBarra();
    V.barra.onclick = e => {
      const f = e.target.closest("[data-f]");
      if (f) { const k = f.dataset.f;
        if (k === V.ferr && k !== "mao") { abrirPainel(); return; }      // tocar de novo na ferramenta abre as opções dela
        V.ferr = k; guardarPrefs(); fecharPaineis(); pintarBarra(); atualizarToque(); return; }
      const c = e.target.closest("[data-c]");
      if (c) { if (!["caneta", "lapis", "marca"].includes(V.ferr)) { V.ferr = "caneta"; atualizarToque(); }
        usarCor(c.dataset.c); return; }
      if (e.target.closest("[data-v='paleta']")) abrirPainel();
    };
    top.onclick = e => {
      const v = e.target.closest("[data-v]"); if (!v) return; const x = v.dataset.v;
      if (x === "desfazer") desfazer(); else if (x === "refazer") refazer();
      else if (x === "mais" || x === "menos") mudarZoom(V.zoom + (x === "mais" ? 0.25 : -0.25));
      else if (x === "zoom100") mudarZoom(1);
      else if (x === "menu") abrirMenu(v);
    };
  }
  function pintarBarra() {
    if (!V.barra) return;
    const tinta = ["caneta", "lapis", "marca"].includes(V.ferr), lista = V.ferr === "marca" ? PALETA_MARCA.slice(0, 4) : V.recentes.slice(0, 4), atual = corDe(V.ferr);
    V.barra.innerHTML = ["caneta", "lapis", "marca", "borracha", "mao"].map(k => `<button type="button" class="est-t ${V.ferr === k ? "on" : ""}" data-f="${k}" aria-pressed="${V.ferr === k}" title="${NOMES_F[k]}${V.ferr === k && k !== "mao" ? " (toque de novo para as opções)" : ""}" aria-label="${NOMES_F[k]}">
        ${ICF[k]}${["caneta", "lapis", "marca"].includes(k) ? `<i class="est-ponta" style="background:${corDe(k)}"></i>` : ""}</button>`).join("")
      + `<span class="est-sep"></span>`
      + (tinta ? lista.map((c, i) => `<button type="button" class="est-cq ${i > 1 ? "est-cq-x" : ""} ${c === atual ? "on" : ""}" data-c="${c}" style="--c:${c}" aria-label="Usar a cor ${c}"></button>`).join("") : `<span class="est-dica small muted">${V.ferr === "borracha" ? "Toque no traço para apagar" : "Arraste para rolar a página"}</span>`)
      + `<button type="button" class="est-t est-pal" data-v="paleta" aria-label="Cores e espessura" title="Cores e espessura">${ICF.paleta}</button>`;
  }
  function usarCor(c) {
    const f = ["caneta", "lapis", "marca"].includes(V.ferr) ? V.ferr : "caneta";
    V.cfg[f].c = c;
    if (f !== "marca") V.recentes = [c].concat(V.recentes.filter(x => x !== c)).slice(0, 4);
    guardarPrefs(); pintarBarra(); const p = V.ov.querySelector(".est-painel"); if (p) abrirPainel();
  }
  // painel de opções da ferramenta: espessura com prévia e paleta de cores
  function abrirPainel() {
    fecharPaineis();
    const f = V.ferr === "mao" ? "caneta" : V.ferr, cfg = V.cfg[f], tam = TAMANHOS[f], tinta = f !== "borracha";
    const p = document.createElement("div"); p.className = "est-painel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Opções de " + NOMES_F[f]);
    p.innerHTML = `<div class="est-pn-h"><b>${NOMES_F[f]}</b><button type="button" class="est-ic sm" data-pn="x" aria-label="Fechar">✕</button></div>
      ${tinta ? `<canvas class="est-prev" width="600" height="90" aria-hidden="true"></canvas>` : ""}
      <div class="est-pn-l small muted">Espessura</div>
      <div class="est-tams">${tam.map((t, i) => `<button type="button" class="est-tam ${cfg.w === t ? "on" : ""}" data-w="${t}" aria-label="Espessura ${i + 1}"><i style="width:${6 + i * 5}px;height:${6 + i * 5}px;${tinta ? `background:${cfg.c}` : ""}"></i></button>`).join("")}</div>
      <input type="range" min="${tam[0]}" max="${tam[4]}" value="${cfg.w}" data-pn="w" aria-label="Espessura">
      ${tinta ? `<div class="est-pn-l small muted">Cor</div><div class="est-pal-g">${(f === "marca" ? PALETA_MARCA : PALETA).map(c => `<button type="button" class="est-cq ${c === cfg.c ? "on" : ""}" data-pc="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join("")}
        <label class="est-cq est-cq-livre" title="Outra cor" style="--c:${cfg.c}"><input type="color" value="${cfg.c}" data-pn="cor" aria-label="Escolher outra cor"></label></div>`
      : `<p class="small muted" style="margin:6px 0 0">A borracha apaga o traço inteiro que ela tocar. Errou? Use desfazer.</p>
         <button type="button" class="btn sm" data-pn="limpar" style="margin-top:8px">${ICF.lixo} Apagar todos os desenhos desta página</button>`}`;
    V.ov.appendChild(p);
    const rb = V.barra.getBoundingClientRect(); p.style.top = Math.round(rb.bottom + 8) + "px";
    const prev = () => { const cv = p.querySelector(".est-prev"); if (!cv) return; const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, 600, 90);
      const pts = []; for (let i = 0; i <= 24; i++) pts.push(Math.round(800 + i * 350), Math.round(5000 + Math.sin(i / 3.2) * 2600));
      const q = f === "marca" ? null : pts.filter((_, i) => i % 2 === 0).map((_, i) => 35 + Math.round(55 * Math.sin(Math.PI * i / 24)));
      tracar(ctx, { f, c: cfg.c, w: cfg.w * 1.6, p: pts, q }, 600, 90); };
    prev();
    p.onclick = e => {
      const w = e.target.closest("[data-w]"); if (w) { cfg.w = +w.dataset.w; guardarPrefs(); abrirPainel(); return; }
      const c = e.target.closest("[data-pc]"); if (c) { usarCor(c.dataset.pc); return; }
      const b = e.target.closest("[data-pn]"); if (!b) return;
      if (b.dataset.pn === "x") fecharPaineis();
      else if (b.dataset.pn === "limpar") { fecharPaineis(); limparPagina(paginaNaTela()); }
    };
    p.querySelector('[data-pn="w"]').oninput = e => { cfg.w = +e.target.value; guardarPrefs(); p.querySelectorAll("[data-w]").forEach(x => x.classList.toggle("on", +x.dataset.w === cfg.w)); prev(); };
    const cor = p.querySelector('[data-pn="cor"]'); if (cor) cor.onchange = e => usarCor(e.target.value);
  }
  // menu ⋮ do leitor
  function abrirMenu(ancora) {
    const ja = V.ov.querySelector(".est-menu-v"); fecharPaineis(); if (ja) return;
    const n = paginaNaTela(), cad = ehCaderno(), m = document.createElement("div"); m.className = "est-menu-v"; m.setAttribute("role", "menu");
    m.innerHTML = `<button type="button" role="menuitemcheckbox" aria-checked="${V.dedoEscreve}" data-mn="caneta"><span>${V.dedoEscreve ? "✓" : ""}</span>Escrever com o dedo <small>para celular sem caneta</small></button>
      ${cad ? `<button type="button" role="menuitem" data-mn="inserir"><span>＋</span>Nova folha depois da ${n}</button>
        <button type="button" role="menuitem" data-mn="apagar-folha" class="danger" ${V.pags.length < 2 ? "disabled" : ""}><span>${ICF.lixo}</span>Apagar a folha ${n}${V.pags.length < 2 ? " <small>o caderno precisa de ao menos uma</small>" : ""}</button>` : ""}
      <button type="button" role="menuitem" data-mn="limpar"><span>🧽</span>Apagar os desenhos da página ${n}</button>
      <button type="button" role="menuitem" data-mn="exportar"><span>⬇</span>Baixar a página ${n} como imagem</button>
      <button type="button" role="menuitem" data-mn="renomear"><span>✎</span>Renomear</button>`;
    V.ov.appendChild(m);
    const r = ancora.getBoundingClientRect(); m.style.top = (r.bottom + 6) + "px"; m.style.right = Math.max(8, innerWidth - r.right) + "px";
    const fora = ev => { if (!m.contains(ev.target) && !ancora.contains(ev.target)) { m.remove(); document.removeEventListener("pointerdown", fora, true); } };
    setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
    m.onclick = async e => {
      const b = e.target.closest("[data-mn]"); if (!b || b.disabled) return; m.remove(); document.removeEventListener("pointerdown", fora, true);
      const x = b.dataset.mn;
      if (x === "caneta") { V.dedoEscreve = !V.dedoEscreve; guardarPrefs(); APP.toast(V.dedoEscreve ? "O dedo também escreve. Para rolar, use dois dedos ou a mão (✋)." : "O dedo rola a página e a caneta escreve."); }
      else if (x === "inserir") inserirFolha(n);
      else if (x === "apagar-folha") apagarFolha(n);
      else if (x === "limpar") limparPagina(n);
      else if (x === "exportar") exportar(n);
      else if (x === "renomear") { const nome = await pedirTexto("Renomear", "Nome", V.a.nome); if (nome) { V.a.nome = nome.slice(0, 80); V.ov.querySelector(".est-titulo").textContent = V.a.nome; salvarMeta(); } }
    };
  }

  /* ---------- folhas do caderno ---------- */
  function renumerar(map) { const novo = {}; Object.keys(V.anot).forEach(k => { const d = map(+k); if (d) novo[d] = V.anot[k]; }); V.anot = novo; }
  async function inserirFolha(depois) {
    const total = V.pags.length;
    renumerar(k => k > depois ? k + 1 : k);
    V.pags.push({ n: total + 1, w: 1000, h: 1414 }); V.pags.forEach((p, i) => { p.n = i + 1; p.pronta = 0; });
    for (let k = depois + 1; k <= total + 1; k++) V.sujas.add(k);
    V.desf = []; V.ref = []; V.a.paginas = V.pags.length; await salvarMeta();
    montarPaginas(); salvarAnot();
    setTimeout(() => { const el = V.ov && V.ov.querySelector(`[data-pag="${depois + 1}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    APP.toast(`Folha ${depois + 1} criada.`);
  }
  async function apagarFolha(n) {
    if (V.pags.length < 2) { APP.toast("O caderno precisa de pelo menos uma folha. Para recomeçar, apague os desenhos da página."); return; }
    if (!await perguntar(`Apagar a folha ${n}?`, "A folha e tudo o que foi escrito nela somem. As folhas seguintes sobem uma posição.", "Apagar folha", true)) return;
    const total = V.pags.length;
    renumerar(k => k < n ? k : k > n ? k - 1 : 0);
    V.pags.pop(); V.pags.forEach((p, i) => { p.n = i + 1; p.pronta = 0; });
    for (let k = n; k <= total; k++) V.sujas.add(k);          // a última antiga fica vazia e é apagada da nuvem
    V.desf = []; V.ref = []; V.a.paginas = V.pags.length; await salvarMeta();
    const box = V.ov.querySelector(".est-pags"), topo = box.scrollTop;
    montarPaginas(); box.scrollTop = topo; await salvarAnot();
    APP.toast(`Folha ${n} apagada.`);
  }
  async function limparPagina(p) {
    if (!p || !(V.anot[p] || []).length) { APP.toast("Esta página não tem desenhos."); return; }
    if (!await perguntar(`Apagar os desenhos da página ${p}?`, "Você ainda pode desfazer logo depois.", "Apagar desenhos", true)) return;
    empilhar({ pag: p, rem: V.anot[p].map((s, i) => ({ s, i })) }); V.anot[p] = []; redesenhar(p); marcar(p);
  }

  /* ---------- páginas ---------- */
  function largura() { const box = V.ov.querySelector(".est-pags"); return Math.min(box.clientWidth - (box.clientWidth < 600 ? 16 : 48), 980) * V.zoom; }
  function montarPaginas() {
    const box = V.ov.querySelector(".est-pags"), W = largura(), cad = ehCaderno();
    box.innerHTML = V.pags.map(p => `<div class="est-pag" data-pag="${p.n}" style="width:${W}px;height:${Math.round(W * p.h / p.w)}px"><canvas class="est-base"></canvas><canvas class="est-tinta"></canvas>
        <span class="est-num">${p.n} / ${V.pags.length}</span>${cad && V.pags.length > 1 ? `<button type="button" class="est-pag-x" data-apagar-folha="${p.n}" aria-label="Apagar a folha ${p.n}" title="Apagar esta folha">${ICF.lixo}</button>` : ""}</div>`).join("")
      + (cad ? `<button type="button" class="est-nova-folha" style="width:${W}px" data-nova-folha>＋ Nova folha</button>` : "");
    if (V.obs) V.obs.disconnect();
    V.obs = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) desenharPagina(+en.target.dataset.pag); }), { root: box, rootMargin: "600px 0px" });
    box.querySelectorAll(".est-pag").forEach(el => V.obs.observe(el));
    box.onclick = e => {
      const nf = e.target.closest("[data-nova-folha]"); if (nf) { inserirFolha(V.pags.length); return; }
      const af = e.target.closest("[data-apagar-folha]"); if (af) apagarFolha(+af.dataset.apagarFolha);
    };
    ligarCaneta(box); atualizarToque();
    V.ov.querySelector("[data-zoom]").textContent = Math.round(V.zoom * 100) + "%";
    status();
  }
  function mudarZoom(z) {
    z = Math.max(0.5, Math.min(3, +(+z).toFixed(2))); if (z === V.zoom) return;
    const box = V.ov.querySelector(".est-pags"), antes = box.scrollTop / Math.max(1, box.scrollHeight), lado = box.scrollLeft / Math.max(1, box.scrollWidth);
    V.zoom = z; V.pags.forEach(p => p.pronta = 0); montarPaginas(); box.scrollTop = antes * box.scrollHeight; box.scrollLeft = lado * box.scrollWidth;
  }
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  async function desenharPagina(n) {
    const p = V.pags[n - 1], el = V.ov && V.ov.querySelector(`[data-pag="${n}"]`); if (!p || !el) return;
    const W = el.clientWidth, H = el.clientHeight, k = W + "x" + H; if (p.pronta === k) return; p.pronta = k;
    const base = el.querySelector(".est-base"), tinta = el.querySelector(".est-tinta"), r = dpr();
    [base, tinta].forEach(c => { c.width = Math.round(W * r); c.height = Math.round(H * r); });
    const ctx = base.getContext("2d");
    try {
      if (V.pdf) { const pg = await V.pdf.getPage(n), v = pg.getViewport({ scale: base.width / p.w }); await pg.render({ canvasContext: ctx, viewport: v }).promise; }
      else if (V.img) ctx.drawImage(V.img, 0, 0, base.width, base.height);
      else fundoCaderno(ctx, base.width, base.height, V.a.modelo);
    } catch (e) { p.pronta = 0; }
    redesenhar(n);
  }
  // desenha um traço; com pressão (caneta de tablet), a espessura varia ao longo do traço
  function tracar(ctx, s, W, H) {
    const pt = s.p; if (!pt || pt.length < 2) return;
    const base = Math.max(0.8, s.w / 10000 * W), X = i => pt[i] / 10000 * W, Y = i => pt[i + 1] / 10000 * H, n = pt.length / 2;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
    if (s.f === "marca") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; ctx.lineCap = "butt"; }
    else if (s.f === "lapis") ctx.globalAlpha = 0.82;
    const q = s.q && s.q.length === n && s.f !== "marca" ? s.q : null;
    if (n === 1) { ctx.beginPath(); ctx.arc(X(0), Y(0), base * (q ? 0.35 + q[0] / 110 : 1) / 2, 0, 7); ctx.fill(); ctx.restore(); return; }
    if (!q) {
      ctx.lineWidth = base; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
      for (let i = 2; i < pt.length - 2; i += 2) { const mx = (X(i) + X(i + 2)) / 2, my = (Y(i) + Y(i + 2)) / 2; ctx.quadraticCurveTo(X(i), Y(i), mx, my); }
      ctx.lineTo(X(pt.length - 2), Y(pt.length - 2)); ctx.stroke(); ctx.restore(); return;
    }
    // com pressão: um pedaço de curva por ponto, cada um com a sua espessura (lápis com o mesmo alfa sem "manchas")
    const larg = j => base * (0.4 + q[j] / 100 * 0.9);
    if (s.f === "lapis") { ctx.globalAlpha = 1; }
    let px = X(0), py = Y(0);
    for (let j = 1; j < n; j++) {
      const i = j * 2, ult = j === n - 1, mx = ult ? X(i) : (X(i) + X(i + 2)) / 2, my = ult ? Y(i) : (Y(i) + Y(i + 2)) / 2;
      ctx.lineWidth = (larg(j - 1) + larg(j)) / 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(X(i), Y(i), mx, my); ctx.stroke(); px = mx; py = my;
    }
    ctx.restore();
  }
  function redesenhar(n, extra) {
    const el = V.ov && V.ov.querySelector(`[data-pag="${n}"] .est-tinta`); if (!el || !el.width) return;
    const ctx = el.getContext("2d"); ctx.clearRect(0, 0, el.width, el.height);
    (V.anot[n] || []).forEach(s => tracar(ctx, s, el.width, el.height)); if (extra) tracar(ctx, extra, el.width, el.height);
  }
  function atualizarToque() { const box = V.ov && V.ov.querySelector(".est-pags"); if (box) box.classList.toggle("desenhando", V.ferr !== "mao"); }

  /* ---------- caneta, dedo e gestos ----------
     como num tablet: a caneta (e o mouse) escrevem; o dedo rola a página, com embalo, e dois dedos dão zoom.
     Enquanto a caneta encosta na tela, toques de dedo ou da mão apoiada são ignorados. "Escrever com o dedo" fica no menu ⋮. */
  function ligarCaneta(box) {
    let atual = null, pag = 0, embalo = 0;
    const toques = new Map(); let gesto = null;      // dedos na tela: rolar (1) ou pinça de zoom (2)
    const pos = (e, el) => { const r = el.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 10000), Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 10000)]; };
    const dist = () => { const [a, b] = [...toques.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const fimPinca = () => { if (!gesto || gesto.tipo !== "pinca") return; const z = gesto.z; box.style.zoom = ""; gesto = null; mudarZoom(z); };
    const pararEmbalo = () => { if (embalo) { cancelAnimationFrame(embalo); embalo = 0; } };
    const soltarEmbalo = g => {                      // continua rolando depois que o dedo sai, perdendo velocidade
      let vx = g.vx || 0, vy = g.vy || 0; if (Date.now() - g.t > 80 || Math.hypot(vx, vy) < 0.15) return;
      let ant = performance.now();
      const passo = agora => { const dt = Math.min(40, agora - ant); ant = agora; box.scrollBy(-vx * dt, -vy * dt);
        const f = Math.pow(0.995, dt); vx *= f; vy *= f; embalo = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(passo) : 0; };
      embalo = requestAnimationFrame(passo);
    };
    const comecarRolar = e => { gesto = { tipo: "rolar", id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), vx: 0, vy: 0 }; };
    box.onpointerdown = e => {
      if (e.target.closest("button")) return;
      fecharPaineis(); pararEmbalo();
      const dedo = e.pointerType === "touch";
      if (dedo) {
        if (atual && atual.ptr !== "touch") return;                // mão apoiada enquanto a caneta escreve
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (toques.size === 2) {                                   // dois dedos: zoom (descarta o traço que o primeiro dedo começou)
          if (atual) { if (atual.borracha) { aplicar({ pag, rem: atual.rem }, true); } atual = null; redesenhar(pag); }
          gesto = { tipo: "pinca", d0: dist(), z0: V.zoom, z: V.zoom }; e.preventDefault(); return; }
        if (toques.size > 2) return;
        if (!V.dedoEscreve || V.ferr === "mao") { comecarRolar(e); return; } }
      if (V.ferr === "mao") { if (e.pointerType === "mouse") comecarRolar(e); return; }
      const el = e.target.closest(".est-pag"); if (!el) return;
      if (e.button > 0) return;
      e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (er) {}
      pag = +el.dataset.pag;
      const [x, y] = pos(e, el);
      if (V.ferr === "borracha") { atual = { borracha: true, el, rem: [], id: e.pointerId, ptr: e.pointerType }; apagarPerto(x, y, el); return; }
      const caneta = e.pointerType === "pen" && e.pressure > 0;
      atual = { f: V.ferr, c: corDe(V.ferr), w: V.cfg[V.ferr].w, p: [x, y], el, id: e.pointerId, ptr: e.pointerType };
      if (caneta) atual.q = [Math.round(e.pressure * 100)];
    };
    box.onpointermove = e => {
      if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesto && gesto.tipo === "pinca") { if (toques.size >= 2) { gesto.z = Math.max(0.5, Math.min(3, gesto.z0 * dist() / gesto.d0)); box.style.zoom = String(gesto.z / V.zoom); V.ov.querySelector("[data-zoom]").textContent = Math.round(gesto.z * 100) + "%"; } return; }
      if (gesto && gesto.tipo === "rolar" && e.pointerId === gesto.id) {
        const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y, agora = Date.now(), dt = Math.max(1, agora - gesto.t);
        box.scrollBy(-dx, -dy);
        gesto.vx = gesto.vx * 0.6 + (dx / dt) * 0.4; gesto.vy = gesto.vy * 0.6 + (dy / dt) * 0.4;   // velocidade (px/ms) suavizada
        gesto.x = e.clientX; gesto.y = e.clientY; gesto.t = agora; return; }
      if (!atual || e.pointerId !== atual.id) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) { const [x, y] = pos(ev, atual.el);
        if (atual.borracha) apagarPerto(x, y, atual.el);
        else { const n = atual.p.length; if (Math.abs(atual.p[n - 2] - x) + Math.abs(atual.p[n - 1] - y) > 4) { atual.p.push(x, y); if (atual.q) atual.q.push(Math.round((ev.pressure || 0.5) * 100)); } } }
      if (!atual.borracha && !V.raf) V.raf = requestAnimationFrame(() => { V.raf = 0; if (atual && !atual.borracha) redesenhar(pag, limpo(atual)); });
    };
    const limpo = a => { const { el, id, ptr, ...s } = a; if (s.q && s.q.length !== s.p.length / 2) delete s.q; return s; };
    const fim = e => {
      if (toques.has(e.pointerId)) { toques.delete(e.pointerId); if (gesto && gesto.tipo === "pinca" && toques.size < 2) { fimPinca(); return; } }
      if (gesto && gesto.tipo === "rolar" && e.pointerId === gesto.id) { const g = gesto; gesto = null; if (e.type === "pointerup") soltarEmbalo(g); return; }
      if (!atual || e.pointerId !== atual.id) return;
      if (atual.borracha) { if (atual.rem.length) { empilhar({ pag, rem: atual.rem }); marcar(pag); } }
      else { const s = limpo(atual); (V.anot[pag] = V.anot[pag] || []).push(s); empilhar({ pag, add: s }); redesenhar(pag); marcar(pag); }
      atual = null;
    };
    box.onpointerup = fim; box.onpointercancel = fim;
    box.onwheel = () => pararEmbalo();
    function apagarPerto(x, y, el) {
      const lista = V.anot[pag] || [], raio = V.cfg.borracha.w / 2, asp = el.clientHeight / el.clientWidth;
      for (let i = lista.length - 1; i >= 0; i--) {
        const pt = lista[i].p, alc = raio + (lista[i].w || 0) / 2; let perto = false;
        for (let j = 0; j < pt.length && !perto; j += 2) {
          const dx = pt[j] - x, dy = (pt[j + 1] - y) * asp; if (dx * dx + dy * dy < alc * alc) perto = true;
          else if (j + 3 < pt.length) {           // também perto do segmento entre dois pontos
            const ax = pt[j], ay = pt[j + 1] * asp, bx = pt[j + 2], by = pt[j + 3] * asp, px = x, py = y * asp, vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
            const t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0, cx = ax + t * vx - px, cy = ay + t * vy - py;
            if (cx * cx + cy * cy < alc * alc) perto = true; }
        }
        if (perto) { atual.rem.push({ s: lista[i], i }); lista.splice(i, 1); }
      }
      if (atual.rem.length) redesenhar(pag);
    }
  }
  /* desfazer / refazer: cada passo guarda o traço criado ou os traços apagados (com a posição) */
  function empilhar(op) { V.desf.push(op); if (V.desf.length > 300) V.desf.shift(); V.ref = []; status(); }
  function aplicar(op, inverso) {
    const l = V.anot[op.pag] = V.anot[op.pag] || [];
    if (op.add) { if (inverso) { const i = l.lastIndexOf(op.add); if (i >= 0) l.splice(i, 1); } else l.push(op.add); }
    if (op.rem) { if (inverso) op.rem.slice().reverse().forEach(r => l.splice(Math.min(r.i, l.length), 0, r.s)); else op.rem.forEach(r => { const i = l.indexOf(r.s); if (i >= 0) l.splice(i, 1); }); }
    redesenhar(op.pag); marcar(op.pag);
  }
  function desfazer() { const op = V.desf.pop(); if (!op) return; aplicar(op, true); V.ref.push(op); status(); }
  function refazer() { const op = V.ref.pop(); if (!op) return; aplicar(op, false); V.desf.push(op); status(); }
  function status() {
    if (!V.ov) return; const st = V.ov.querySelector("[data-v-st]");
    if (st) st.textContent = V.sujas.size ? "salvando…" : (V.salvoEm ? "salvo ✓" : (V.pags.length ? `${V.pags.length} ${V.pags.length === 1 ? "página" : "páginas"}` : ""));
    const d = V.ov.querySelector('[data-v="desfazer"]'), r = V.ov.querySelector('[data-v="refazer"]');
    if (d) d.disabled = !V.desf.length; if (r) r.disabled = !V.ref.length;
  }
  function marcar(p) { V.sujas.add(p); status(); clearTimeout(V.timer); V.timer = setTimeout(() => salvarAnot(), 900); }
  async function salvarAnot() {
    if (!V.a || !V.sujas.size) return;
    const a = V.a, anot = V.anot, sujas = [...V.sujas]; V.sujas.clear(); const em = Date.now();
    await gr("anot", a.id, { pags: anot, em }).catch(() => {});
    const comTinta = Object.keys(anot).filter(p => (anot[p] || []).length).map(Number).sort((x, y) => x - y);
    const x = E.meta.arquivos.find(y => y.id === a.id), apAntes = (x && x.ap) || [];
    if (x) x.ap = comTinta;
    if (x && apAntes.join() !== comTinta.join()) await salvarMeta();
    V.salvoEm = em; status();
  }
  function paginaNaTela() {
    if (!V.ov) return 1;
    const box = V.ov.querySelector(".est-pags"), meio = box.getBoundingClientRect().top + box.clientHeight / 2;
    let melhor = 1, d0 = 1e9;
    box.querySelectorAll(".est-pag").forEach(el => { const r = el.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - meio); if (d < d0) { d0 = d; melhor = +el.dataset.pag; } });
    return melhor;
  }
  function exportar(n) {
    const el = V.ov.querySelector(`[data-pag="${n}"]`); if (!el) return;
    const b = el.querySelector(".est-base"), t = el.querySelector(".est-tinta"), cv = document.createElement("canvas");
    cv.width = b.width; cv.height = b.height; const ctx = cv.getContext("2d"); ctx.drawImage(b, 0, 0); ctx.drawImage(t, 0, 0);
    cv.toBlob(bl => bl && baixar(bl, `${V.a.nome} - página ${n}.png`), "image/png");
  }

  function sairDaAba() { if (V.ov) fecharLeitor(); document.querySelectorAll(".est-pop").forEach(x => x.remove()); }
  (window.LAComp = window.LAComp || {}).Estante = { render, sairDaAba, _estado: () => ({ V, E }) };   // _estado: usado pelos testes
})();
