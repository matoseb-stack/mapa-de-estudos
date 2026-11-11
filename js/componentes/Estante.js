/* Estante — aba "Minha estante": a pessoa organiza os próprios arquivos de estudo (PDF e imagens) em categorias
   que ela mesma cria (Matemática, Geografia…) e escreve por cima deles, como num caderno digital:
   caneta, marca-texto, borracha, cores, espessura, desfazer/refazer, zoom e "só caneta" (o dedo rola a página).
   Também cria cadernos em branco (liso, pautado ou quadriculado).
   Onde fica cada coisa:
   - no aparelho (IndexedDB "la-estante-<uid>"): os arquivos, as capas, os desenhos e a lista (abre rápido e sem internet);
   - na nuvem (com conta): data/users/{uid}/estante/meta (lista e categorias), .../meta/partes/{id}_{n} (arquivo em
     pedaços de 700 KB), .../meta/anot/{id}_{página} (desenhos) e .../meta/capas/{id} (miniatura). Só a pessoa lê e grava.
   Uso: LAComp.Estante.render(container, app)  ·  app: { uid, db, esc, ico, pageHead, toast, naTela } */
(function () {
  "use strict";
  const MAX_ARQ = 15 * 1024 * 1024, MAX_TOTAL = 200 * 1024 * 1024, PEDACO = 700000;
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const CORES_CAT = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#64748b"];
  const CORES_TINTA = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#f97316"];
  const CORES_MARCA = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fdba74"];
  const MODELOS = { liso: "Liso", pautado: "Pautado", quadriculado: "Quadriculado" };
  const E = { uid: null, meta: null, cat: "todas", busca: "", nuvemOk: false, envios: {} };
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const tamTxt = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;
  const dataTxt = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

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

  /* ---------- nuvem (Firestore, só com conta) ---------- */
  let APP = null;
  const nuvem = () => APP && APP.db && APP.db();
  const raiz = () => nuvem().collection("data/users/" + E.uid).doc("estante");   // data/users/{uid}/estante (+ partes, anot, capas)
  const semCapa = m => ({ ...m, arquivos: m.arquivos.map(a => { const { capa, ...r } = a; return r; }) });
  async function salvarMeta() {
    E.meta.atual = Date.now();
    await gr("meta", "meta", E.meta).catch(() => {});
    if (nuvem()) try { await raiz().set(semCapa(E.meta)); } catch (e) { console.warn("estante meta", e && e.code); }
  }
  async function carregarMeta() {
    let m = await lg("meta", "meta").catch(() => null);
    if (nuvem()) {
      try {
        const s = await raiz().get();
        if (s.exists) { const c = s.data(); if (!m || (c.atual || 0) >= (m.atual || 0)) m = { ...c, arquivos: c.arquivos.map(a => ({ ...a, capa: ((m && m.arquivos) || []).find(x => x.id === a.id)?.capa || null })) }; }
        else if (m && m.arquivos.length) await raiz().set(semCapa(m));   // primeira vez com conta: sobe o que já estava no aparelho
        E.nuvemOk = true;
      } catch (e) { console.warn("estante nuvem", e && e.code); }
    }
    E.meta = m || { categorias: [], arquivos: [], atual: 0 };
    E.meta.categorias = E.meta.categorias || []; E.meta.arquivos = E.meta.arquivos || [];
  }
  const b64 = buf => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const deB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function subirArquivo(a, blob) {
    if (!nuvem()) return;
    const buf = await blob.arrayBuffer(), n = Math.max(1, Math.ceil(buf.byteLength / PEDACO)), col = raiz().collection("partes");
    E.envios[a.id] = 0; pintarCartao(a.id);
    try {
      for (let i = 0; i < n; i++) {
        await col.doc(a.id + "_" + i).set({ d: b64(buf.slice(i * PEDACO, (i + 1) * PEDACO)), i, n });
        E.envios[a.id] = (i + 1) / n; pintarCartao(a.id);
      }
      const x = E.meta.arquivos.find(y => y.id === a.id); if (x) { x.partes = n; x.nuvem = true; await salvarMeta(); }
    } catch (e) { console.warn("estante envio", e && e.code); APP.toast("Não foi possível guardar o arquivo na nuvem agora. Ele ficou salvo neste aparelho."); }
    delete E.envios[a.id]; pintarCartao(a.id);
  }
  async function baixarDaNuvem(a) {
    const col = raiz().collection("partes"), partes = [];
    for (let i = 0; i < a.partes; i++) { const s = await col.doc(a.id + "_" + i).get(); if (!s.exists) throw new Error("pedaço faltando"); partes.push(deB64(s.data().d)); }
    const blob = new Blob(partes, { type: a.mime || "application/octet-stream" });
    await gr("arquivos", a.id, blob).catch(() => {});
    return blob;
  }
  async function blobDe(a) {
    if (a.tipo === "caderno") return null;
    const b = await lg("arquivos", a.id).catch(() => null); if (b) return b;
    if (nuvem() && a.partes) return baixarDaNuvem(a);
    throw new Error("arquivo não está neste aparelho");
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
    const uid = app.uid(); if (E.uid !== uid) Object.assign(E, { uid, meta: null, cat: "todas", busca: "", nuvemOk: false });
    if (!E.meta) {
      container.innerHTML = `<div class="page">${app.pageHead("Minha estante", "Seus arquivos de estudo organizados por matéria.")}<div class="card row muted"><span class="spinner"></span>Abrindo sua estante…</div></div>`;
      try { await carregarMeta(); } catch (e) { E.meta = { categorias: [], arquivos: [], atual: 0 }; }
      if (!app.naTela()) return;
      completarCapas();
    }
    pintar();
  }
  // capas que estão só na nuvem (outro aparelho) ou só no aparelho
  async function completarCapas() {
    for (const a of E.meta.arquivos) {
      if (a.capa) continue;
      let c = await lg("capas", a.id).catch(() => null);
      if (!c && nuvem()) { try { const s = await raiz().collection("capas").doc(a.id).get(); if (s.exists) { c = s.data().d; gr("capas", a.id, c).catch(() => {}); } } catch (e) {} }
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
      <input type="file" id="est-arq" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" multiple hidden>
      <div class="est-cats" role="tablist" aria-label="Categorias">
        <button type="button" role="tab" class="est-cat ${E.cat === "todas" ? "on" : ""}" data-cat="todas" aria-selected="${E.cat === "todas"}">📚 Todos <small>${M.arquivos.length}</small></button>
        ${M.categorias.map(c => `<button type="button" role="tab" class="est-cat ${E.cat === c.id ? "on" : ""}" data-cat="${c.id}" aria-selected="${E.cat === c.id}"><i style="background:${c.cor}"></i>${esc(c.nome)} <small>${M.arquivos.filter(a => a.cat === c.id).length}</small></button>`).join("")}
        ${semCat && M.categorias.length ? `<button type="button" role="tab" class="est-cat ${E.cat === "sem" ? "on" : ""}" data-cat="sem">Sem categoria <small>${semCat}</small></button>` : ""}
        <button type="button" class="est-cat nova" data-e="nova-cat">＋ Nova categoria</button>
      </div>
      <div class="row est-barra">
        <input type="search" id="est-busca" placeholder="Buscar arquivo pelo nome" value="${esc(E.busca)}" aria-label="Buscar arquivo">
        ${cat ? `<button class="btn sm ghost" type="button" data-e="edit-cat">${ico("gear")}Editar “${esc(cat.nome)}”</button>` : ""}
        <span class="small muted" style="margin-left:auto">${M.arquivos.length} ${M.arquivos.length === 1 ? "arquivo" : "arquivos"} · ${tamTxt(total)} de ${tamTxt(MAX_TOTAL)}${nuvem() ? (E.nuvemOk ? " · ☁️ sincronizada" : " · offline") : " · só neste aparelho"}</span>
      </div>
      ${lista.length ? `<div class="est-grade">${lista.map(cartao).join("")}</div>`
        : `<div class="card est-vazia" data-e="enviar"><div class="est-vazia-ic">📂</div><h3>${M.arquivos.length ? "Nada nesta categoria ainda" : "Sua estante está vazia"}</h3>
            <p class="muted small">Envie PDFs de apostilas e listas, fotos do caderno ou crie um caderno em branco. Depois é só abrir e escrever por cima com caneta ou marca-texto.</p>
            <p class="small"><b>Toque aqui</b> ou arraste os arquivos para esta tela.</p></div>`}
      <p class="hint">Aceita PDF e imagens (JPG, PNG, WebP) de até ${tamTxt(MAX_ARQ)}. ${nuvem() ? "Com a sua conta, os arquivos e os desenhos ficam guardados na nuvem e abrem em qualquer aparelho." : "No modo visitante, os arquivos ficam só neste aparelho."}</p>
    </div>`;
    ligar();
  }
  function cartao(a) {
    const { esc } = APP, c = catDe(a.cat), env = E.envios[a.id];
    const tipo = a.tipo === "pdf" ? "PDF" : a.tipo === "img" ? "Imagem" : `Caderno ${MODELOS[a.modelo] ? MODELOS[a.modelo].toLowerCase() : ""}`;
    return `<div class="est-arq" data-arq="${a.id}">
      <button type="button" class="est-capa" data-abrir="${a.id}" aria-label="Abrir ${esc(a.nome)}">${a.capa ? `<img src="${a.capa}" alt="">` : `<span class="est-capa-ic">${a.tipo === "pdf" ? "📄" : a.tipo === "img" ? "🖼️" : "📓"}</span>`}
        ${a.ap && a.ap.length ? `<span class="est-tinta" title="Tem anotações">✏️</span>` : ""}</button>
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
    let total = E.meta.arquivos.reduce((s, a) => s + (a.tam || 0), 0);
    for (const f of files) {
      const tipo = f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : /^image\/(png|jpe?g|webp|gif)$/.test(f.type) ? "img" : null;
      if (!tipo) { APP.toast(`“${f.name}” não é PDF nem imagem.`); continue; }
      if (f.size > MAX_ARQ) { APP.toast(`“${f.name}” passa de ${tamTxt(MAX_ARQ)}. Divida o PDF ou comprima a imagem.`); continue; }
      if (total + f.size > MAX_TOTAL) { APP.toast(`Sua estante chegou a ${tamTxt(MAX_TOTAL)}. Apague arquivos antigos para enviar mais.`); break; }
      total += f.size;
      APP.toast(`Guardando “${f.name}”…`);
      const id = novoId(), info = await capaDe(tipo, f);
      if (tipo === "pdf" && !info.paginas) { APP.toast(`Não foi possível ler “${f.name}”. O PDF pode estar protegido ou danificado.`); continue; }
      const a = { id, nome: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Arquivo", tipo, mime: f.type || "application/pdf", tam: f.size, paginas: info.paginas,
        cat: catDe(E.cat) ? E.cat : "", criado: Date.now(), ap: [] };
      await gr("arquivos", id, f);
      if (info.capa) { await gr("capas", id, info.capa).catch(() => {}); if (nuvem()) raiz().collection("capas").doc(id).set({ d: info.capa }).catch(() => {}); }
      E.meta.arquivos.push({ ...a, capa: info.capa }); await salvarMeta();
      if (APP.naTela()) pintar();
      subirArquivo(a, f);
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
      if (info.capa) { await gr("capas", id, info.capa).catch(() => {}); if (nuvem()) raiz().collection("capas").doc(id).set({ d: info.capa }).catch(() => {}); }
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
      if (!confirm(`Apagar a categoria “${c.nome}”?${n ? ` Os ${n} arquivos dela não são apagados: vão para “Sem categoria”.` : ""}`)) return;
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
      ${a.tipo !== "caderno" ? `<button type="button" data-m="baixar">Baixar o original</button>` : ""}<button type="button" data-m="apagar" class="danger">Apagar</button>`;
    document.body.appendChild(pop);
    const r = ancora.getBoundingClientRect(); pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + "px"; pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    const fechar = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("pointerdown", fechar, true); } };
    setTimeout(() => document.addEventListener("pointerdown", fechar, true), 0);
    pop.onclick = async e => {
      const m = e.target.closest("[data-m]"); if (!m) return; pop.remove(); document.removeEventListener("pointerdown", fechar, true);
      const x = m.dataset.m;
      if (x === "abrir") abrir(id);
      else if (x === "renomear") { const n = prompt("Novo nome do arquivo:", a.nome); if (n && n.trim()) { a.nome = n.trim().slice(0, 80); await salvarMeta(); pintar(); } }
      else if (x === "mover") { const bg = modal(`<h3 style="margin:0">Mudar “${APP.esc(a.nome)}” de categoria</h3>${selectCat("em-cat", a.cat)}
          <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Mover</button></div>`);
        bg.querySelector("[data-ok]").onclick = async () => { a.cat = bg.querySelector("#em-cat").value; await salvarMeta(); bg.remove(); pintar(); }; }
      else if (x === "baixar") { try { const b = await blobDe(a); baixar(b, a.nome + (a.tipo === "pdf" ? ".pdf" : "." + ((a.mime || "").split("/")[1] || "png"))); } catch (err) { APP.toast("Não foi possível baixar agora."); } }
      else if (x === "apagar") apagar(a);
    };
  }
  async function apagar(a) {
    if (!confirm(`Apagar “${a.nome}” e as anotações dele? Não dá para desfazer.`)) return;
    E.meta.arquivos = E.meta.arquivos.filter(x => x.id !== a.id); await salvarMeta(); pintar();
    await Promise.all([ap("arquivos", a.id), ap("anot", a.id), ap("capas", a.id)].map(p => p.catch(() => {})));
    if (nuvem()) { const r = raiz(), ops = [r.collection("capas").doc(a.id).delete()];
      for (let i = 0; i < (a.partes || 0); i++) ops.push(r.collection("partes").doc(a.id + "_" + i).delete());
      (a.ap || []).forEach(p => ops.push(r.collection("anot").doc(a.id + "_" + p).delete()));
      await Promise.all(ops.map(p => p.catch(() => {}))); }
    APP.toast("Arquivo apagado.");
  }
  function baixar(blob, nome) { const u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = nome; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  function modal(html) {
    document.querySelectorAll(".modal-bg").forEach(m => m.remove());
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" style="width:min(460px,100%)">${html}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); });
    return bg;
  }

  /* ================= leitor com caneta ================= */
  // traço: { f: "caneta"|"marca", c: cor, w: espessura (fração da largura da página × 10000), p: [x, y, x, y…] em 0..10000 }
  const V = { a: null, pdf: null, img: null, pags: [], anot: {}, ferr: "caneta", cor: CORES_TINTA[0], corMarca: CORES_MARCA[0], esp: { caneta: 22, marca: 140, borracha: 160 },
    soCaneta: false, zoom: 1, desf: [], ref: [], sujas: new Set(), timer: null, obs: null, raf: 0 };
  async function abrir(id) {
    const a = E.meta.arquivos.find(x => x.id === id); if (!a) return;
    a.aberto = Date.now(); salvarMeta();
    const ov = document.createElement("div"); ov.className = "est-leitor"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", a.nome);
    ov.innerHTML = `<div class="est-top"><button class="btn icon ghost" type="button" data-v="voltar" aria-label="Voltar para a estante">←</button><b class="est-titulo">${APP.esc(a.nome)}</b><span class="small muted" data-v-st></span></div>
      <div class="est-pags" tabindex="0"><div class="card row muted" style="margin:24px auto;max-width:420px"><span class="spinner"></span>Abrindo…</div></div>`;
    document.body.appendChild(ov); document.documentElement.classList.add("est-aberto");
    Object.assign(V, { a, pdf: null, img: null, pags: [], anot: {}, desf: [], ref: [], sujas: new Set(), zoom: 1, ov });
    ov.querySelector('[data-v="voltar"]').onclick = fecharLeitor;
    V.tecla = e => { if (e.key === "Escape") fecharLeitor(); else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); refazer(); } };
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
      ov.querySelector(".est-pags").innerHTML = `<div class="card stack" style="margin:24px auto;max-width:460px"><b>Não foi possível abrir este arquivo.</b><p class="small muted">${nuvem() ? "Confira sua internet: ele pode estar guardado só na nuvem." : "Ele foi enviado em outro aparelho e não está guardado neste."}</p></div>`;
      return;
    }
    if (!ov.isConnected) return;
    montarBarra(); montarPaginas();
  }
  async function carregarAnot() {
    const loc = await lg("anot", V.a.id).catch(() => null); V.anot = (loc && loc.pags) || {};
    if (nuvem() && (V.a.ap || []).length) {
      const r = raiz().collection("anot");
      await Promise.all(V.a.ap.map(async p => { try { const s = await r.doc(V.a.id + "_" + p).get(); if (s.exists) { const d = s.data(); if (!loc || (d.em || 0) >= (loc.em || 0)) V.anot[p] = JSON.parse(d.s || "[]"); } } catch (e) {} }));
    }
  }
  function fecharLeitor() {
    if (!V.ov) return; salvarAnot(true);
    removeEventListener("keydown", V.tecla); if (V.obs) V.obs.disconnect();
    if (V.pdf) { try { V.pdf.destroy(); } catch (e) {} }
    V.ov.remove(); V.ov = null; document.documentElement.classList.remove("est-aberto");
    if (APP.naTela()) pintar();
  }
  function montarBarra() {
    const top = V.ov.querySelector(".est-top"), ferr = [["caneta", "✒️", "Caneta"], ["marca", "🖍️", "Marca-texto"], ["borracha", "🧽", "Borracha"], ["mao", "✋", "Mover (rolar a página)"]];
    const barra = document.createElement("div"); barra.className = "est-ferr";
    barra.innerHTML = `${ferr.map(([k, e, t]) => `<button type="button" class="est-f ${V.ferr === k ? "on" : ""}" data-f="${k}" title="${t}" aria-label="${t}">${e}</button>`).join("")}
      <span class="est-sep"></span><span class="est-cores-t" data-cores></span>
      <label class="est-esp" title="Espessura"><span class="sr-only">Espessura</span><input type="range" min="1" max="10" data-esp></label>
      <span class="est-sep"></span>
      <button type="button" class="est-f" data-v="desfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button><button type="button" class="est-f" data-v="refazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">↷</button>
      <span class="est-sep"></span>
      <button type="button" class="est-f" data-v="menos" title="Diminuir" aria-label="Diminuir zoom">−</button><span class="small mono" data-zoom>100%</span><button type="button" class="est-f" data-v="mais" title="Aumentar" aria-label="Aumentar zoom">+</button>
      <span class="est-sep"></span>
      <button type="button" class="est-f est-txt ${V.soCaneta ? "on" : ""}" data-v="caneta" title="Só a caneta desenha; o dedo rola a página (para tablets com caneta)">🖊️ Só caneta</button>
      ${V.a.tipo === "caderno" ? `<button type="button" class="est-f est-txt" data-v="pagina" title="Adicionar uma folha no fim">＋ Folha</button>` : ""}
      <button type="button" class="est-f est-txt" data-v="limpar" title="Apagar os desenhos da página que está na tela">Limpar página</button>
      <button type="button" class="est-f est-txt" data-v="exportar" title="Baixar a página da tela com os desenhos (imagem)">⬇ Página</button>`;
    top.after(barra);
    const pintarCores = () => { const lista = V.ferr === "marca" ? CORES_MARCA : CORES_TINTA, atual = V.ferr === "marca" ? V.corMarca : V.cor;
      barra.querySelector("[data-cores]").innerHTML = lista.map(c => `<button type="button" class="est-cor sm ${c === atual ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join("");
      const esp = barra.querySelector("[data-esp]"), k = V.ferr === "mao" ? "caneta" : V.ferr, base = { caneta: 22, marca: 140, borracha: 160 }[k];
      esp.value = Math.round(V.esp[k] / base * 5); esp.disabled = V.ferr === "mao";
      barra.querySelector("[data-cores]").style.display = V.ferr === "borracha" || V.ferr === "mao" ? "none" : ""; };
    pintarCores();
    barra.onclick = e => {
      const f = e.target.closest("[data-f]"); if (f) { V.ferr = f.dataset.f; barra.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === f)); pintarCores(); atualizarToque(); return; }
      const c = e.target.closest("[data-c]"); if (c) { if (V.ferr === "marca") V.corMarca = c.dataset.c; else V.cor = c.dataset.c; pintarCores(); return; }
      const v = e.target.closest("[data-v]"); if (!v) return;
      const x = v.dataset.v;
      if (x === "desfazer") desfazer(); else if (x === "refazer") refazer();
      else if (x === "mais" || x === "menos") { V.zoom = Math.max(0.5, Math.min(3, +(V.zoom + (x === "mais" ? 0.25 : -0.25)).toFixed(2))); aplicarZoom(); }
      else if (x === "caneta") { V.soCaneta = !V.soCaneta; v.classList.toggle("on", V.soCaneta); APP.toast(V.soCaneta ? "Só a caneta desenha. Use o dedo para rolar a página." : "Dedo, mouse e caneta desenham."); }
      else if (x === "pagina") { const n = V.pags.length + 1; V.pags.push({ n, w: 1000, h: 1414 }); V.a.paginas = n; salvarMeta(); montarPaginas(); setTimeout(() => { const el = V.ov.querySelector(`[data-pag="${n}"]`); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 60); }
      else if (x === "limpar") { const p = paginaNaTela(); if (!p || !(V.anot[p] || []).length) return; if (!confirm(`Apagar todos os desenhos da página ${p}?`)) return;
        empilhar({ pag: p, rem: V.anot[p].map((s, i) => ({ s, i })) }); V.anot[p] = []; redesenhar(p); marcar(p); }
      else if (x === "exportar") exportar(paginaNaTela());
    };
    barra.querySelector("[data-esp]").oninput = e => { if (V.ferr === "mao") return; const base = { caneta: 22, marca: 140, borracha: 160 }[V.ferr]; V.esp[V.ferr] = Math.round(base * e.target.value / 5); };
  }
  function largura() { const box = V.ov.querySelector(".est-pags"); return Math.min(box.clientWidth - 24, 980) * V.zoom; }
  function montarPaginas() {
    const box = V.ov.querySelector(".est-pags"), W = largura();
    box.innerHTML = V.pags.map(p => `<div class="est-pag" data-pag="${p.n}" style="width:${W}px;height:${Math.round(W * p.h / p.w)}px"><canvas class="est-base"></canvas><canvas class="est-tinta"></canvas><span class="est-num">${p.n}/${V.pags.length}</span></div>`).join("");
    if (V.obs) V.obs.disconnect();
    V.obs = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) desenharPagina(+en.target.dataset.pag); }), { root: box, rootMargin: "600px 0px" });
    box.querySelectorAll(".est-pag").forEach(el => V.obs.observe(el));
    ligarCaneta(box); atualizarToque();
    V.ov.querySelector("[data-zoom]").textContent = Math.round(V.zoom * 100) + "%";
    status();
  }
  function aplicarZoom() {
    const box = V.ov.querySelector(".est-pags"), antes = box.scrollTop / Math.max(1, box.scrollHeight);
    V.pags.forEach(p => p.pronta = 0); montarPaginas(); box.scrollTop = antes * box.scrollHeight;
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
    redesenho(n);
  }
  const redesenho = n => redesenhar(n);
  function tracar(ctx, s, W, H) {
    const pt = s.p; if (!pt || pt.length < 2) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1, s.w / 10000 * W);
    if (s.f === "marca") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; ctx.lineCap = "butt"; }
    ctx.strokeStyle = s.c; ctx.beginPath();
    const X = i => pt[i] / 10000 * W, Y = i => pt[i + 1] / 10000 * H;
    ctx.moveTo(X(0), Y(0));
    if (pt.length === 2) ctx.lineTo(X(0) + 0.1, Y(0));
    for (let i = 2; i < pt.length - 2; i += 2) { const mx = (X(i) + X(i + 2)) / 2, my = (Y(i) + Y(i + 2)) / 2; ctx.quadraticCurveTo(X(i), Y(i), mx, my); }
    if (pt.length > 2) ctx.lineTo(X(pt.length - 2), Y(pt.length - 2));
    ctx.stroke(); ctx.restore();
  }
  function redesenhar(n, extra) {
    const el = V.ov && V.ov.querySelector(`[data-pag="${n}"] .est-tinta`); if (!el || !el.width) return;
    const ctx = el.getContext("2d"); ctx.clearRect(0, 0, el.width, el.height);
    (V.anot[n] || []).forEach(s => tracar(ctx, s, el.width, el.height)); if (extra) tracar(ctx, extra, el.width, el.height);
  }
  function atualizarToque() { const box = V.ov && V.ov.querySelector(".est-pags"); if (box) box.classList.toggle("desenhando", V.ferr !== "mao"); }
  function ligarCaneta(box) {
    let atual = null, pag = 0, rolando = null;
    const pos = (e, el) => { const r = el.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 10000), Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 10000)]; };
    box.onpointerdown = e => {
      if (V.ferr === "mao") return;
      const el = e.target.closest(".est-pag"); if (!el) return;
      if (e.pointerType === "touch" && V.soCaneta) { rolando = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }   // dedo rola
      if (e.button > 0) return;
      e.preventDefault(); box.setPointerCapture(e.pointerId);
      pag = +el.dataset.pag;
      const [x, y] = pos(e, el);
      if (V.ferr === "borracha") { atual = { borracha: true, el, rem: [] }; apagarPerto(x, y, el); return; }
      atual = { f: V.ferr, c: V.ferr === "marca" ? V.corMarca : V.cor, w: V.esp[V.ferr], p: [x, y], el };
    };
    box.onpointermove = e => {
      if (rolando && e.pointerId === rolando.id) { box.scrollBy(rolando.x - e.clientX, rolando.y - e.clientY); rolando.x = e.clientX; rolando.y = e.clientY; return; }
      if (!atual) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const [x, y] = pos(ev, atual.el);
        if (atual.borracha) apagarPerto(x, y, atual.el);
        else { const n = atual.p.length; if (Math.abs(atual.p[n - 2] - x) + Math.abs(atual.p[n - 1] - y) > 6) atual.p.push(x, y); } }
      if (!atual.borracha && !V.raf) V.raf = requestAnimationFrame(() => { V.raf = 0; if (atual) redesenhar(pag, atual); });
    };
    const fim = e => {
      if (rolando && e.pointerId === rolando.id) { rolando = null; return; }
      if (!atual) return;
      if (atual.borracha) { if (atual.rem.length) { empilhar({ pag, rem: atual.rem }); marcar(pag); } }
      else { const { el, ...s } = atual; (V.anot[pag] = V.anot[pag] || []).push(s); empilhar({ pag, add: s }); redesenhar(pag); marcar(pag); }
      atual = null;
    };
    box.onpointerup = fim; box.onpointercancel = fim;
    function apagarPerto(x, y, el) {
      const lista = V.anot[pag] || [], raio = V.esp.borracha / 2, asp = el.clientHeight / el.clientWidth;
      for (let i = lista.length - 1; i >= 0; i--) {
        const pt = lista[i].p; let perto = false;
        for (let j = 0; j < pt.length && !perto; j += 2) { const dx = pt[j] - x, dy = (pt[j + 1] - y) * asp; if (dx * dx + dy * dy < raio * raio) perto = true; }
        if (perto) { atual.rem.push({ s: lista[i], i }); lista.splice(i, 1); }
      }
      if (atual.rem.length) redesenhar(pag);
    }
  }
  /* desfazer / refazer: cada passo guarda o traço criado ou os traços apagados (com a posição) */
  function empilhar(op) { V.desf.push(op); if (V.desf.length > 200) V.desf.shift(); V.ref = []; status(); }
  function aplicar(op, inverso) {
    const l = V.anot[op.pag] = V.anot[op.pag] || [];
    if (op.add) { if (inverso) { const i = l.lastIndexOf(op.add); if (i >= 0) l.splice(i, 1); } else l.push(op.add); }
    if (op.rem) { if (inverso) op.rem.slice().reverse().forEach(r => l.splice(Math.min(r.i, l.length), 0, r.s)); else op.rem.forEach(r => { const i = l.indexOf(r.s); if (i >= 0) l.splice(i, 1); }); }
    redesenhar(op.pag); marcar(op.pag);
  }
  function desfazer() { const op = V.desf.pop(); if (!op) return; aplicar(op, true); V.ref.push(op); status(); }
  function refazer() { const op = V.ref.pop(); if (!op) return; aplicar(op, false); V.desf.push(op); status(); }
  function status() { if (!V.ov) return; const st = V.ov.querySelector("[data-v-st]"); if (st) st.textContent = V.sujas.size ? "salvando…" : (V.salvoEm ? "salvo ✓" : ""); }
  function marcar(p) { V.sujas.add(p); status(); clearTimeout(V.timer); V.timer = setTimeout(() => salvarAnot(), 900); }
  async function salvarAnot() {
    if (!V.a || !V.sujas.size) return;
    const a = V.a, sujas = [...V.sujas]; V.sujas.clear(); const em = Date.now();
    await gr("anot", a.id, { pags: V.anot, em }).catch(() => {});
    const comTinta = Object.keys(V.anot).filter(p => (V.anot[p] || []).length).map(Number).sort((x, y) => x - y);
    const x = E.meta.arquivos.find(y => y.id === a.id), apAntes = (x && x.ap) || [];
    if (x) x.ap = comTinta;
    if (nuvem()) {
      const r = raiz().collection("anot");
      await Promise.all(sujas.map(p => ((V.anot[p] || []).length ? r.doc(a.id + "_" + p).set({ s: JSON.stringify(V.anot[p]), em }) : r.doc(a.id + "_" + p).delete()).catch(e => console.warn("anot", e && e.code))));
    }
    if (x && apAntes.join() !== comTinta.join()) await salvarMeta();
    V.salvoEm = em; status();
  }
  function paginaNaTela() {
    const box = V.ov.querySelector(".est-pags"), meio = box.getBoundingClientRect().top + box.clientHeight / 2;
    let melhor = 1, dist = 1e9;
    box.querySelectorAll(".est-pag").forEach(el => { const r = el.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - meio); if (d < dist) { dist = d; melhor = +el.dataset.pag; } });
    return melhor;
  }
  function exportar(n) {
    const el = V.ov.querySelector(`[data-pag="${n}"]`); if (!el) return;
    const b = el.querySelector(".est-base"), t = el.querySelector(".est-tinta"), cv = document.createElement("canvas");
    cv.width = b.width; cv.height = b.height; const ctx = cv.getContext("2d"); ctx.drawImage(b, 0, 0); ctx.drawImage(t, 0, 0);
    cv.toBlob(bl => bl && baixar(bl, `${V.a.nome} - página ${n}.png`), "image/png");
  }

  function sairDaAba() { if (V.ov) fecharLeitor(); document.querySelectorAll(".est-pop").forEach(x => x.remove()); }
  (window.LAComp = window.LAComp || {}).Estante = { render, sairDaAba };
})();
