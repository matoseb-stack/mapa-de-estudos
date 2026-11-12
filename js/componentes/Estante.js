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
  const estreito = () => window.matchMedia && matchMedia("(max-width: 700px)").matches;
  function emFolha(el, pai, fechar) {
    if (!estreito()) return null;
    el.classList.add("est-folha"); const v = document.createElement("div"); v.className = "est-veu";
    pai.insertBefore(v, el); v.addEventListener("click", fechar); return v;
  }
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
    if (a.compart) return baixarConjunto(a);
    const b = await lg("arquivos", a.id).catch(() => null); if (b) return b;
    throw new Error("arquivo não está neste aparelho");
  }
  /* pacote .laest: o arquivo + as anotações, para abrir em outro aparelho */
  const MAGICO = "LAEST1\n";
  async function montarPacote(a) {
    const anot = await lg("anot", a.id).catch(() => null), b = await blobDe(a).catch(() => null);
    if (a.tipo !== "caderno" && !b) return null;
    const { capa, compart, fid, dono, membros, nomes, ...info } = a, cab = JSON.stringify({ info, anot: anot ? anot.pags : {}, capa: capa || null });
    const tamCab = new TextEncoder().encode(cab).length;
    return new Blob([MAGICO, String(tamCab).padStart(12, "0"), cab, b || new Blob([])], { type: "application/octet-stream" });
  }
  async function exportarPacote(a) {
    const pk = await montarPacote(a); if (!pk) { APP.toast("Este arquivo não está neste aparelho."); return; }
    baixar(pk, a.nome + ".laest");
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

  /* ---------- arquivos conjuntos (compartilhados/{id}: arquivo em partes e um documento por traço; todos editam) ----------
     Só estes ficam na nuvem, porque várias pessoas precisam ver e escrever. Limite menor para não pesar. */
  const MAX_CONJ = 25 * 1024 * 1024, PEDACO_C = 700000;
  const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let t = ""; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(t); };
  const deB64 = t => { const b = atob(t), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const semId = s => JSON.stringify(s, (k, v) => k === "_id" || k === "_k" ? undefined : v);
  const nuv = () => APP && APP.db && APP.db();
  const conjRef = fid => nuv().collection("compartilhados").doc(fid);
  function ouvirConjuntos() {
    const db = nuv(), parar = () => { [E.compUnsub, E.convUnsub].forEach(f => { if (f) try { f(); } catch (e) {} }); E.compUnsub = E.convUnsub = null; };
    if (!db || !E.uid || E.uid === "visitante") { parar(); E.comp = {}; E.convites = {}; avisarConvites(); return; }
    if (E.compUid === E.uid && E.compUnsub) return;
    parar(); E.compUid = E.uid; E.comp = E.comp || {}; E.convites = E.convites || {};
    const repintar = () => { avisarConvites(); if (APP.naTela() && CONT && E.meta && !V.ov) pintar(); if (APP.convitesMudou) APP.convitesMudou(); };
    E.compUnsub = db.collection("compartilhados").where("membros", "array-contains", E.uid).onSnapshot(sn => {
      const m = {}; sn.docs.forEach(d => { const x = d.data(); if (x && x.completo) m[d.id] = { ...x, fid: d.id }; }); E.comp = m; repintar();
    }, e => console.warn("conjuntos", e && e.code));
    E.convUnsub = db.collection("compartilhados").where("convidados", "array-contains", E.uid).onSnapshot(sn => {
      const m = {}; sn.docs.forEach(d => { const x = d.data(); if (x && x.completo) m[d.id] = { ...x, fid: d.id }; }); E.convites = m; repintar();
    }, e => console.warn("convites", e && e.code));
  }
  function avisarConvites() { if (APP && APP.badgeConvites) APP.badgeConvites(Object.keys(E.convites || {}).length); }
  function iniciar(app) { APP = APP || app; const uid = app.uid(); if (E.uid !== uid) Object.assign(E, { uid, meta: null, cat: "todas", busca: "", comp: {}, convites: {} }); ouvirConjuntos(); }
  const estadoConvite = fid => (E.comp || {})[fid] ? "membro" : (E.convites || {})[fid] ? "convidado" : "";
  async function aceitarConvite(fid) {
    const FV = window.firebase && firebase.firestore.FieldValue; if (!FV || !nuv()) return false;
    try { await conjRef(fid).update({ membros: FV.arrayUnion(E.uid), convidados: FV.arrayRemove(E.uid), atualizado: Date.now() }); APP.toast("Pronto! O arquivo está em Notas compartilhadas."); return true; }
    catch (e) { APP.toast(e && e.code === "permission-denied" ? "Este convite não vale mais (foi cancelado ou o arquivo foi apagado)." : "Não foi possível aceitar agora (" + ((e && e.code) || "erro") + ")."); return false; }
  }
  async function recusarConvite(fid) {
    const FV = window.firebase && firebase.firestore.FieldValue; if (!FV || !nuv()) return false;
    try { await conjRef(fid).update({ convidados: FV.arrayRemove(E.uid), atualizado: Date.now() }); APP.toast("Convite recusado."); return true; }
    catch (e) { APP.toast("Este convite não vale mais."); return false; }
  }
  const comoArquivo = x => ({ id: "c_" + x.fid, fid: x.fid, compart: true, nome: x.nome, tipo: x.tipo, mime: x.mime, modelo: x.modelo, paginas: x.paginas, tam: x.tam,
    cat: "", criado: x.criado, aberto: x.atualizado, dono: x.dono, membros: x.membros || [], nomes: x.nomes || {}, partes: x.partes, capa: (E.capasC || {})[x.fid] || null });
  const conjuntos = () => Object.values(E.comp || {}).map(comoArquivo);
  const acharArq = id => E.meta.arquivos.find(x => x.id === id) || (String(id).startsWith("c_") ? conjuntos().find(x => x.id === id) : null);
  const outrosNomes = a => (a.membros || []).filter(u => u !== E.uid).map(u => (a.nomes || {})[u] || "alguém");
  async function criarConjunto(a, pessoas) {
    const db = nuv(); if (!db) return;
    let blob = null;
    if (a.tipo !== "caderno") { blob = await blobDe(a).catch(() => null); if (!blob) { APP.toast("Este arquivo não está neste aparelho."); return; }
      if (blob.size > MAX_CONJ) { APP.toast(`Arquivos conjuntos podem ter até ${tamTxt(MAX_CONJ)}. Divida o PDF ou envie uma cópia em vez de editar junto.`); return; } }
    const ref = db.collection("compartilhados").doc(), n = blob ? Math.max(1, Math.ceil(blob.size / PEDACO_C)) : 0;
    const nomes = { [E.uid]: APP.meuNome ? APP.meuNome() : "Eu" }; pessoas.forEach(p => nomes[p.id] = p.nome);
    APP.toast(`Preparando “${a.nome}” para editar junto…`);
    try {
      await ref.set({ dono: E.uid, membros: [E.uid], convidados: pessoas.map(p => p.id), nomes, nome: a.nome, tipo: a.tipo, mime: a.mime || "", modelo: a.modelo || "", paginas: a.paginas || 1, tam: a.tam || 0, partes: n, criado: Date.now(), atualizado: Date.now(), completo: false });
      for (let i = 0; i < n; i++) await ref.collection("partes").doc(String(i).padStart(4, "0")).set({ i, d: await b64(blob.slice(i * PEDACO_C, (i + 1) * PEDACO_C)) });
      const an = await lg("anot", a.id).catch(() => null);
      if (an && an.pags) for (const [pg, lista] of Object.entries(an.pags)) for (const st of lista || []) await ref.collection("tracos").add({ pag: +pg, s: semId(st), autor: E.uid, em: Date.now() });
      await ref.update({ completo: true });
      if (blob) await gr("arquivos", "c_" + ref.id, blob).catch(() => {});
      if (a.capa) { await gr("capas", "c_" + ref.id, a.capa).catch(() => {}); (E.capasC = E.capasC || {})[ref.id] = a.capa; }
      let falhou = 0; for (const p of pessoas) { try { await APP.convidarNaConversa(p.id, { fid: ref.id, nome: a.nome, tipo: a.tipo }); } catch (e) { falhou++; } }
      APP.toast(`Convite enviado para ${pessoas.map(p => p.nome).join(", ")} nas Mensagens. Quando aceitarem, vocês editam juntos.${falhou ? " (Alguns convites não chegaram: a pessoa pode só aceitar mensagens de amigos.)" : ""}`);
      E.cat = "comp"; if (APP.naTela()) pintar(); else if (APP.irPara) APP.irPara("estante");
    } catch (e) { console.warn("conjunto", e); APP.toast("Não foi possível criar o arquivo conjunto (" + ((e && e.code) || "erro") + ")."); try { await ref.delete(); } catch (er) {} }
  }
  async function convidarConjunto(a) {
    if (a.dono !== E.uid) { APP.toast("Só quem criou o arquivo pode convidar mais pessoas."); return; }
    const ps = await APP.escolherPessoas({ titulo: `Convidar para “${a.nome}”`, texto: "A pessoa recebe o convite nas Mensagens e precisa aceitar.", botao: "Convidar", multi: true, tirar: a.membros });
    if (!ps.length) return;
    const FV = window.firebase && firebase.firestore.FieldValue, upd = { convidados: FV.arrayUnion(...ps.map(p => p.id)), atualizado: Date.now() };
    ps.forEach(p => upd["nomes." + p.id] = p.nome);
    try { await conjRef(a.fid).update(upd); for (const p of ps) { try { await APP.convidarNaConversa(p.id, { fid: a.fid, nome: a.nome, tipo: a.tipo }); } catch (e) {} }
      APP.toast("Convite enviado nas Mensagens."); } catch (e) { APP.toast("Não foi possível convidar (" + ((e && e.code) || "erro") + ")."); }
  }
  async function sairConjunto(a) {
    if (a.dono === E.uid) {
      if (!await perguntar(`Apagar “${a.nome}” para todos?`, "O arquivo conjunto e tudo o que foi escrito nele somem para todas as pessoas.", "Apagar para todos", true)) return;
      try { const r = conjRef(a.fid);
        for (const col of ["tracos", "partes"]) { const sn = await r.collection(col).get(); for (const d of sn.docs) await d.ref.delete(); }
        await r.delete(); APP.toast("Arquivo conjunto apagado."); } catch (e) { APP.toast("Não foi possível apagar (" + ((e && e.code) || "erro") + ")."); }
    } else {
      if (!await perguntar(`Sair de “${a.nome}”?`, "Você deixa de ver e de editar este arquivo. Quem compartilhou pode te convidar de novo.", "Sair", true)) return;
      try { await conjRef(a.fid).update({ membros: window.firebase.firestore.FieldValue.arrayRemove(E.uid), atualizado: Date.now() }); APP.toast("Você saiu do arquivo."); } catch (e) { APP.toast("Não foi possível sair (" + ((e && e.code) || "erro") + ")."); }
    }
    await Promise.all([ap("arquivos", a.id), ap("capas", a.id)].map(x => x.catch(() => {})));
  }
  async function baixarConjunto(a) {
    const loc = await lg("arquivos", a.id).catch(() => null); if (loc) return loc;
    const sn = await conjRef(a.fid).collection("partes").orderBy("i").get();
    if (sn.size < (a.partes || 0)) throw new Error("arquivo incompleto");
    const blob = new Blob(sn.docs.map(d => deB64(d.data().d)), { type: a.mime || "application/octet-stream" });
    await gr("arquivos", a.id, blob).catch(() => {}); return blob;
  }
  /* compartilhar: cópia pelo aparelho, cópia para alguém do site ou arquivo conjunto */
  function modalCompartilhar(a) {
    const temConta = !!nuv() && E.uid !== "visitante";
    const bg = modal(`<h3 style="margin:0">Compartilhar “${APP.esc(a.nome)}”</h3>
      <div class="opts opts-col">
        <button type="button" class="opt" data-cp="aparelho"><b>📲 Enviar uma cópia pelo aparelho</b><span>WhatsApp, e-mail, Drive… ${a.tipo === "caderno" ? "Vai como arquivo .laest, que abre na estante do Logic Academy." : "Vai o arquivo original."}</span></button>
        <button type="button" class="opt" data-cp="pessoa" ${temConta ? "" : "disabled"}><b>💬 Enviar uma cópia para alguém do Logic Academy</b><span>Chega nas Mensagens com as suas anotações; a pessoa aceita e guarda na estante dela.${temConta ? "" : " Entre com sua conta para usar."}</span></button>
        <button type="button" class="opt" data-cp="junto" ${temConta ? "" : "disabled"}><b>👥 Editar junto (arquivo conjunto)</b><span>A pessoa recebe um convite nas Mensagens. Depois de aceitar, vocês escrevem no mesmo arquivo e veem as mudanças na hora. Até ${tamTxt(MAX_CONJ)}; fica guardado na nuvem enquanto existir.${temConta ? "" : " Entre com sua conta para usar."}</span></button>
      </div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button></div>`);
    bg.addEventListener("click", async e => {
      const b = e.target.closest("[data-cp]"); if (!b || b.disabled) return; bg.remove();
      const x = b.dataset.cp;
      if (x === "aparelho") {
        try {
          const blob = a.tipo === "caderno" ? await montarPacote(a) : await blobDe(a);
          if (!blob) { APP.toast("Este arquivo não está neste aparelho."); return; }
          const nome = a.tipo === "caderno" ? a.nome + ".laest" : a.nome + (a.tipo === "pdf" ? ".pdf" : "." + ((a.mime || "").split("/")[1] || "png"));
          const f = new File([blob], nome, { type: blob.type || a.mime || "application/octet-stream" });
          if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: a.nome });
          else { baixar(f, nome); APP.toast("Este navegador não abre o menu de compartilhar: o arquivo foi baixado para você enviar."); }
        } catch (er) { if (!er || er.name !== "AbortError") APP.toast("Não foi possível compartilhar agora."); }
      } else if (x === "pessoa") {
        const ps = await APP.escolherPessoas({ titulo: "Enviar uma cópia para…", botao: "Enviar", multi: true }); if (!ps.length) return;
        const pk = await montarPacote(a); if (!pk) { APP.toast("Este arquivo não está neste aparelho."); return; }
        const f = new File([pk], a.nome + ".laest", { type: "application/octet-stream" });
        APP.toast("Enviando…"); let ok = 0;
        for (const p of ps) { try { if (await APP.enviarParaPessoa(p.id, f, "", { nome: a.nome, tipo: a.tipo })) ok++; } catch (er) {} }
        APP.toast(ok ? `Enviado para ${ok === ps.length ? ps.map(p => p.nome).join(", ") : ok + " de " + ps.length + " pessoas"}.` : "Não foi possível enviar.");
      } else if (x === "junto") {
        const ps = await APP.escolherPessoas({ titulo: "Editar junto com…", texto: "Quem você escolher pode ver e escrever no arquivo.", botao: "Compartilhar", multi: true }); if (!ps.length) return;
        criarConjunto(a, ps);
      }
    });
  }

  /* ---------- aba "Notas compartilhadas": convites para aceitar e arquivos conjuntos ---------- */
  const temConta = () => !!nuv() && E.uid !== "visitante";
  function chipsHtml() {
    const { esc } = APP, M = E.meta, semCat = M.arquivos.filter(a => !catDe(a.cat)).length, nComp = Object.keys(E.comp || {}).length, nConv = Object.keys(E.convites || {}).length;
    return `<div class="est-cats" role="tablist" aria-label="Categorias">
        <button type="button" role="tab" class="est-cat ${E.cat === "todas" ? "on" : ""}" data-cat="todas" aria-selected="${E.cat === "todas"}">📚 Todos <small>${M.arquivos.length}</small></button>
        ${temConta() || nComp ? `<button type="button" role="tab" class="est-cat est-cat-comp ${E.cat === "comp" ? "on" : ""}" data-cat="comp" aria-selected="${E.cat === "comp"}">👥 Compartilhadas <small>${nComp}</small>${nConv ? `<span class="est-conv-n" title="Convites esperando você">${nConv}</span>` : ""}</button>` : ""}
        ${M.categorias.map(c => `<button type="button" role="tab" class="est-cat ${E.cat === c.id ? "on" : ""}" data-cat="${c.id}" aria-selected="${E.cat === c.id}"><i style="background:${c.cor}"></i>${esc(c.nome)} <small>${M.arquivos.filter(a => a.cat === c.id).length}</small></button>`).join("")}
        ${semCat && M.categorias.length ? `<button type="button" role="tab" class="est-cat ${E.cat === "sem" ? "on" : ""}" data-cat="sem">Sem categoria <small>${semCat}</small></button>` : ""}
        <button type="button" class="est-cat nova" data-e="nova-cat">＋ Nova categoria</button>
      </div>`;
  }
  // "👥 Compartilhadas" dentro da estante: convites para aceitar e notas que você edita junto com outras pessoas
  function pintarComp() {
    const { esc, ico } = APP, conv = Object.values(E.convites || {}), lista = visiveis(), conta = temConta();
    CONT.innerHTML = `<div class="page estante est-comp">
      ${APP.pageHead("Minha estante", "Notas compartilhadas: cadernos e arquivos que você edita junto com outras pessoas, ao vivo.",
        conta ? `<button class="btn primary" type="button" data-e="nova-comp">${ico("plus")}Nova nota compartilhada</button>` : "")}
      ${chipsHtml()}
      ${!conta ? `<div class="card stack"><b>Entre com a sua conta para compartilhar notas.</b><p class="small muted" style="margin:0">No modo visitante nada vai para a nuvem, então não dá para editar junto com outras pessoas.</p></div>` : ""}
      ${conv.length ? `<div class="card est-convites"><div class="card-h"><h3>📨 Convites para você (${conv.length})</h3></div>
        <div class="list">${conv.map(c => `<div class="li est-convite" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><b>${esc(c.nome)}</b>
          <div class="small muted">${esc((c.nomes || {})[c.dono] || "Alguém")} te convidou para editar junto · ${c.tipo === "caderno" ? "caderno" : c.tipo === "pdf" ? "PDF" : "imagem"}</div></div>
          <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm ghost" type="button" data-recusar="${c.fid}">Recusar</button><button class="btn sm primary" type="button" data-aceitar="${c.fid}">Aceitar</button></div></div>`).join("")}</div></div>` : ""}
      ${lista.length ? `<div class="est-grade">${lista.map(cartao).join("")}</div>`
        : conta ? `<div class="card est-vazia" data-e="nova-comp"><div class="est-vazia-ic">👥</div><h3>Nenhuma nota compartilhada ainda</h3>
            <p class="muted small">Crie uma nota nova aqui e convide colegas, ou compartilhe um arquivo da estante em ⋯ › Compartilhar › Editar junto.</p>
            <p class="small"><b>Toque aqui</b> para criar uma nota compartilhada.</p></div>` : ""}
      <p class="hint">As notas compartilhadas ficam guardadas na nuvem enquanto existirem, para todos verem. Quem criou pode convidar mais pessoas ou apagar; os outros podem sair quando quiserem.</p>
    </div>`;
    CONT.oncontextmenu = e => { const c = e.target.closest(".est-arq"); if (!c) return; e.preventDefault(); menuArquivo(c.dataset.arq, c.querySelector("[data-menu]")); };
    CONT.onclick = async e => {
      const c = e.target.closest("[data-cat]"); if (c) { E.cat = c.dataset.cat; pintar(); return; }
      if (e.target.closest('[data-e="nova-cat"]')) { modalCategoria(); return; }
      const ab = e.target.closest("[data-abrir]"); if (ab) { abrir(ab.dataset.abrir); return; }
      const mn = e.target.closest("[data-menu]"); if (mn) { menuArquivo(mn.dataset.menu, mn); return; }
      const ac = e.target.closest("[data-aceitar]"); if (ac) { ac.disabled = true; await aceitarConvite(ac.dataset.aceitar); return; }
      const rc = e.target.closest("[data-recusar]"); if (rc) { rc.disabled = true; await recusarConvite(rc.dataset.recusar); return; }
      if (e.target.closest('[data-e="nova-comp"]')) novaNotaComp();
    };
  }
  function novaNotaComp() {
    const bg = modal(`<h3 style="margin:0">Nova nota compartilhada</h3>
      <div class="field"><label for="nc-nome">Nome</label><input type="text" id="nc-nome" maxlength="80" value="Resumo em grupo"></div>
      <div class="field"><label>Folha</label><div class="seg" id="nc-mod">${Object.entries(MODELOS).map(([k, n], i) => `<button type="button" data-mod="${k}" class="${i === 1 ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Escolher pessoas</button></div>`);
    let mod = "pautado";
    bg.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => { mod = b.dataset.mod; bg.querySelectorAll("[data-mod]").forEach(x => x.classList.toggle("on", x === b)); });
    bg.querySelector("[data-ok]").onclick = async () => {
      const nome = bg.querySelector("#nc-nome").value.trim() || "Nota compartilhada"; bg.remove();
      const ps = await APP.escolherPessoas({ titulo: `Convidar para “${nome}”`, texto: "As pessoas recebem um convite nas Mensagens e precisam aceitar.", botao: "Criar e convidar", multi: true });
      if (!ps.length) return;
      const info = await capaDe("caderno", null, mod);
      criarConjunto({ id: "nova-" + novoId(), nome, tipo: "caderno", modelo: mod, paginas: 1, tam: 0, capa: info.capa }, ps);
    };
  }

  /* ---------- tela da estante ---------- */
  let CONT = null;
  async function render(container, app, modo) {
    APP = app; CONT = container; container.onclick = null; if (modo === "comp") E.irComp = true;
    const uid = app.uid(); if (E.uid !== uid) Object.assign(E, { uid, meta: null, cat: "todas", busca: "", comp: {} });
    if (E.irComp) { E.irComp = false; E.cat = "comp"; }
    ouvirConjuntos();
    if (!E.meta) {
      container.innerHTML = `<div class="page">${app.pageHead("Minha estante", "Seus arquivos de estudo organizados por matéria.")}<div class="card row muted"><span class="spinner"></span>Abrindo sua estante…</div></div>`;
      try { await carregarMeta(); } catch (e) { E.meta = { categorias: [], arquivos: [], atual: 0 }; }
      try { for (const fid of Object.keys(E.comp || {})) { const c = await lg("capas", "c_" + fid).catch(() => null); if (c) (E.capasC = E.capasC || {})[fid] = c; } } catch (e) {}
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
    const meus = E.cat === "comp" ? [] : E.meta.arquivos.filter(a => (E.cat === "todas" || (E.cat === "sem" ? !catDe(a.cat) : a.cat === E.cat)));
    const comp = E.cat === "comp" ? conjuntos() : [];
    return meus.concat(comp).filter(a => !q || a.nome.toLowerCase().includes(q)).sort((x, y) => (y.aberto || y.criado) - (x.aberto || x.criado));
  }
  function pintar() {
    const { esc, ico } = APP, M = E.meta, total = M.arquivos.reduce((s, a) => s + (a.tam || 0), 0), semCat = M.arquivos.filter(a => !catDe(a.cat)).length;
    const nComp = Object.keys(E.comp || {}).length;
    if (E.cat === "comp") return pintarComp();
    if (E.cat !== "todas" && E.cat !== "sem" && !catDe(E.cat)) E.cat = "todas";
    const nConv = Object.keys(E.convites || {}).length;
    const lista = visiveis(), cat = catDe(E.cat);
    CONT.innerHTML = `<div class="page estante">
      ${APP.pageHead("Minha estante", "Organize seus PDFs, fotos e cadernos por matéria e escreva por cima deles.",
        `<button class="btn" type="button" data-e="caderno">${ico("edit")}Novo caderno</button><button class="btn primary" type="button" data-e="enviar">${ico("upload")}Enviar arquivo</button>`)}
      <input type="file" id="est-arq" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,.laest" multiple hidden>
      ${chipsHtml()}
      ${nConv ? `<button type="button" class="card est-aviso-conv" data-cat="comp">📨 <b>${nConv === 1 ? "Você tem 1 convite" : `Você tem ${nConv} convites`}</b> para editar junto. <span class="muted">Toque para ver.</span></button>` : ""}
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
    const tipo = (a.compart ? "👥 " : "") + (a.tipo === "pdf" ? "PDF" : a.tipo === "img" ? "Imagem" : `Caderno ${MODELOS[a.modelo] ? MODELOS[a.modelo].toLowerCase() : ""}`);
    return `<div class="est-arq" data-arq="${a.id}">
      <button type="button" class="est-capa" data-abrir="${a.id}" aria-label="Abrir ${esc(a.nome)}">${a.capa ? `<img src="${a.capa}" alt="">` : `<span class="est-capa-ic">${a.compart ? "👥" : a.tipo === "pdf" ? "📄" : a.tipo === "img" ? "🖼️" : "📓"}</span>`}
        ${a.ap && a.ap.length ? `<span class="est-marcado" title="Tem anotações">✏️</span>` : ""}</button>
      <div class="est-info"><b title="${esc(a.nome)}">${esc(a.nome)}</b>
        <span class="small muted">${tipo}${a.paginas ? ` · ${a.paginas} ${a.paginas === 1 ? "página" : "páginas"}` : ""}${a.tam ? ` · ${tamTxt(a.tam)}` : ""}</span>
        <span class="small">${a.compart ? `<span class="muted" title="Arquivo conjunto">com ${esc(outrosNomes(a).join(", ") || "só você")}</span>` : c ? `<i class="est-dot" style="background:${c.cor}"></i>${esc(c.nome)}` : `<span class="muted">Sem categoria</span>`}${env != null ? ` · <span class="muted">☁️ ${Math.round(env * 100)}%</span>` : ""}</span></div>
      <button type="button" class="btn icon ghost est-menu" data-menu="${a.id}" aria-label="Opções de ${esc(a.nome)}">⋯</button></div>`;
  }
  function pintarCartao(id) {
    const el = CONT && CONT.querySelector(`[data-arq="${id}"]`), a = E.meta && acharArq(id);
    if (el && a) { const t = document.createElement("div"); t.innerHTML = cartao(a); el.replaceWith(t.firstElementChild); }
  }
  function ligar() {
    const inp = CONT.querySelector("#est-arq");
    inp.onchange = () => { const fs = [...inp.files]; inp.value = ""; enviar(fs); };
    const busca = CONT.querySelector("#est-busca");
    busca.oninput = () => { E.busca = busca.value; const g = CONT.querySelector(".est-grade,.est-vazia"); const lista = visiveis();
      if (g && g.classList.contains("est-grade")) g.innerHTML = lista.map(cartao).join("") || `<p class="small muted">Nenhum arquivo com esse nome.</p>`; };
    CONT.oncontextmenu = e => { const c = e.target.closest(".est-arq"); if (!c) return; e.preventDefault(); menuArquivo(c.dataset.arq, c.querySelector("[data-menu]")); };
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
    document.querySelectorAll(".est-pop,body>.est-veu").forEach(x => x.remove());
    const a = acharArq(id); if (!a) return;
    const pop = document.createElement("div"); pop.className = "est-pop"; pop.setAttribute("role", "menu");
    pop.innerHTML = a.compart ? `<div class="est-folha-h"><b>${APP.esc(a.nome)}</b></div>
      <button type="button" role="menuitem" data-m="abrir"><span>📖</span>Abrir</button>
      <div class="est-pop-info small muted">👥 Com ${APP.esc(outrosNomes(a).join(", ") || "só você")}${a.dono === E.uid ? "" : ` · de ${APP.esc((a.nomes || {})[a.dono] || "outra pessoa")}`}</div>
      <button type="button" role="menuitem" data-m="convidar"><span>➕</span>Convidar mais pessoas</button>
      ${a.tipo !== "caderno" ? `<button type="button" role="menuitem" data-m="baixar"><span>⬇</span>Baixar o original</button>` : ""}
      <button type="button" role="menuitem" data-m="sair" class="danger"><span>${a.dono === E.uid ? "🗑️" : "🚪"}</span>${a.dono === E.uid ? "Apagar para todos" : "Sair do arquivo"}</button>`
      : `<div class="est-folha-h"><b>${APP.esc(a.nome)}</b></div>
      <button type="button" role="menuitem" data-m="abrir"><span>📖</span>Abrir</button><button type="button" role="menuitem" data-m="compartilhar"><span>🔗</span>Compartilhar</button><button type="button" role="menuitem" data-m="renomear"><span>✎</span>Renomear</button><button type="button" role="menuitem" data-m="mover"><span>🗂️</span>Mudar de categoria</button>
      <button type="button" role="menuitem" data-m="pacote"><span>📦</span>Baixar com anotações <small>para outro aparelho</small></button>
      ${a.tipo !== "caderno" ? `<button type="button" role="menuitem" data-m="baixar"><span>⬇</span>Baixar o original</button>` : ""}<button type="button" role="menuitem" data-m="apagar" class="danger"><span>🗑️</span>Apagar</button>`;
    document.body.appendChild(pop);
    let veu = null;
    const tirar = () => { pop.remove(); if (veu) veu.remove(); document.removeEventListener("pointerdown", fechar, true); };
    const fechar = ev => { if (ev.target.classList && ev.target.classList.contains("est-veu")) return; if (!pop.contains(ev.target)) tirar(); };
    veu = emFolha(pop, document.body, tirar);
    if (!veu) { const r = ancora.getBoundingClientRect(); pop.style.top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4)) + "px"; pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px"; }
    setTimeout(() => document.addEventListener("pointerdown", fechar, true), 0);
    pop.onclick = async e => {
      const m = e.target.closest("[data-m]"); if (!m) return; tirar();
      const x = m.dataset.m;
      if (x === "abrir") abrir(id);
      else if (x === "renomear") { const n = await pedirTexto("Renomear arquivo", "Novo nome", a.nome); if (n) { a.nome = n.slice(0, 80); await salvarMeta(); pintar(); } }
      else if (x === "mover") { const bg = modal(`<h3 style="margin:0">Mudar “${APP.esc(a.nome)}” de categoria</h3>${selectCat("em-cat", a.cat)}
          <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-x>Cancelar</button><button class="btn primary" type="button" data-ok>Mover</button></div>`);
        bg.querySelector("[data-ok]").onclick = async () => { a.cat = bg.querySelector("#em-cat").value; await salvarMeta(); bg.remove(); pintar(); }; }
      else if (x === "baixar") { try { const b = await blobDe(a); baixar(b, a.nome + (a.tipo === "pdf" ? ".pdf" : "." + ((a.mime || "").split("/")[1] || "png"))); } catch (err) { APP.toast("Não foi possível baixar agora."); } }
      else if (x === "pacote") exportarPacote(a);
      else if (x === "compartilhar") modalCompartilhar(a);
      else if (x === "convidar") convidarConjunto(a);
      else if (x === "sair") sairConjunto(a);
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

  /* ================= leitor com caneta (tela cheia, ferramentas numa barra lateral que minimiza) ================= */
  // traço: { f: tipo de caneta (veja PINCEIS), c: cor, w: espessura (fração da largura da página × 10000),
  //          p: [x, y, x, y…] em 0..10000, q?: [pressão 0..100 por ponto] (só com caneta de tablet) }
  const hsl = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join(""); };
  // paleta completa: cinzas + 11 tons em 4 intensidades
  const PALETA = ["#000000", "#111827", "#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#cbd5e1", "#e5e7eb", "#f3f4f6", "#fafaf9", "#ffffff"]
    .concat(...[30, 42, 56, 72].map(l => [0, 22, 40, 52, 95, 150, 175, 200, 222, 265, 300, 330].map(h => hsl(h, h === 52 ? 92 : 78, h === 52 ? l - 6 : l))));
  const PALETA_MARCA = ["#fde047", "#facc15", "#bef264", "#86efac", "#5eead4", "#7dd3fc", "#a5b4fc", "#c4b5fd", "#f0abfc", "#f9a8d4", "#fda4af", "#fdba74"];
  const PALETA_NEON = ["#faff00", "#39ff14", "#00f5ff", "#ff2bd6", "#ff6b00", "#b026ff"];
  const PALETA_PASTEL = ["#fef3c7", "#dcfce7", "#e0f2fe", "#ede9fe", "#fce7f3", "#ffedd5"];
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra || ""}</svg>`;
  const ICF = {
    caneta: svg(`<path d="M4.5 19.5l1-4.2L16.2 4.6a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5z"/><path d="M14.5 6.3l3.2 3.2"/>`),
    tinteiro: svg(`<path d="M12 3l5 6-3 9h-4L7 9z"/><path d="M12 3v8"/><circle cx="12" cy="12" r="1.2"/><path d="M10 18h4v3h-4z"/>`),
    fina: svg(`<path d="M5 19l2-2L17 7l-2-2L5 15z"/><path d="M3.5 20.5L5 19"/><path d="M15 5l2-2 4 4-2 2"/>`),
    pincel: svg(`<path d="M14 4l6 6-7 7-6-6z"/><path d="M7 11c-3 1-3 4-4 9 5-1 8-1 9-4"/>`),
    lapis: svg(`<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M6 15l3 3"/><path d="M14 7l3 3"/>`),
    lapiseira: svg(`<path d="M4 20l2-1 11-11-1-1L5 18z"/><path d="M16 7l3-3 1 1-3 3"/><path d="M3.5 20.5l.5-.5"/>`),
    marca: svg(`<path d="M9.5 14.5l-4 4.5h5.5l1.3-1.5"/><path d="M9.5 14.5l2.8 2.8 8.2-8.2-2.8-2.8z"/>`),
    marcador: svg(`<path d="M8 14l-3 6h5l2-3"/><path d="M8 14l4 3 8-8-4-4z"/><path d="M15 6l3 3"/>`),
    giz: svg(`<path d="M6 18l9-9 3 3-9 9H6z"/><path d="M15 9l3-3 3 3-3 3"/><path d="M8 16l2 2"/>`),
    aquarela: svg(`<path d="M12 3c3 4 6 7 6 10a6 6 0 01-12 0c0-3 3-6 6-10z"/><path d="M9 14a3 3 0 003 3"/>`),
    borracha: svg(`<path d="M8 20h11"/><path d="M4.6 14.6l8.8-8.8a2 2 0 012.8 0l2 2a2 2 0 010 2.8L11 18.8 8 19z"/><path d="M9.5 9.7l4.8 4.8"/>`),
    mao: svg(`<path d="M8 12.5V6a1.5 1.5 0 013 0v5m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v6.5m0-3a1.5 1.5 0 013 0V14c0 4-3 7-7 7-2.7 0-4.4-1.2-6-3.6l-2.3-3.4a1.6 1.6 0 012.6-1.8L8 14"/>`),
    desfazer: svg(`<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>`),
    refazer: svg(`<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>`),
    mais: svg(`<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>`),
    voltar: svg(`<path d="M15 18l-6-6 6-6"/>`),
    lixo: svg(`<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>`),
    cheia: svg(`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`),
    sairCheia: svg(`<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>`),
    recolher: svg(`<path d="M15 6l-6 6 6 6"/>`),
    estrela: svg(`<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>`)
  };
  /* tipos de caneta. modo: "liso" (espessura fixa), "pressao" (varia com a força e a velocidade), "afina" (pincel, pontas finas),
     "chanfro" (caligrafia). alfa/comp: transparência e mistura; tex: textura de grafite ou giz */
  const PINCEIS = {
    caneta:     { n: "Esferográfica",   g: "canetas",   ic: "caneta",    w: [8, 12, 18, 26, 38],      modo: "liso",    alfa: 0.95, c: "#111827" },
    gel:        { n: "Caneta gel",      g: "canetas",   ic: "caneta",    w: [10, 14, 20, 28, 40],     modo: "liso",    alfa: 1,    c: "#1d4ed8" },
    fina:       { n: "Caneta fina",     g: "canetas",   ic: "fina",      w: [4, 6, 9, 13, 18],        modo: "liso",    alfa: 1,    c: "#111827" },
    tinteiro:   { n: "Caneta-tinteiro", g: "canetas",   ic: "tinteiro",  w: [12, 18, 26, 38, 56],     modo: "pressao", alfa: 1,    c: "#1e3a8a" },
    caligrafia: { n: "Caligrafia",      g: "canetas",   ic: "tinteiro",  w: [30, 45, 65, 90, 130],    modo: "chanfro", alfa: 1,    c: "#111827" },
    pincel:     { n: "Pincel",          g: "canetas",   ic: "pincel",    w: [30, 50, 80, 120, 180],   modo: "afina",   alfa: 0.92, c: "#7c3aed" },
    lapis:      { n: "Grafite HB",      g: "grafites",  ic: "lapis",     w: [8, 12, 16, 22, 30],      modo: "pressao", alfa: 0.6,  tex: "grafite", c: "#374151" },
    lapis2b:    { n: "Grafite 2B",      g: "grafites",  ic: "lapis",     w: [10, 14, 20, 28, 38],     modo: "pressao", alfa: 0.78, tex: "grafite", c: "#1f2937" },
    lapis6b:    { n: "Grafite 6B",      g: "grafites",  ic: "lapis",     w: [14, 20, 28, 38, 52],     modo: "pressao", alfa: 0.93, tex: "grafite", c: "#111111" },
    lapiseira:  { n: "Lapiseira 0,5",   g: "grafites",  ic: "lapiseira", w: [4, 6, 8, 10, 14],        modo: "liso",    alfa: 0.72, tex: "grafite", c: "#374151" },
    lapiscor:   { n: "Lápis de cor",    g: "grafites",  ic: "lapis",     w: [12, 18, 26, 36, 48],     modo: "pressao", alfa: 0.85, tex: "grafite", c: "#dc2626" },
    marca:      { n: "Marca-texto",     g: "marca",     ic: "marca",     w: [70, 100, 140, 190, 260], modo: "liso",    alfa: 0.4,  comp: "multiply", ponta: "butt", c: "#fde047", pal: "marca" },
    neon:       { n: "Marca-texto neon",g: "marca",     ic: "marca",     w: [70, 100, 140, 190, 260], modo: "liso",    alfa: 0.5,  comp: "multiply", ponta: "butt", c: "#39ff14", pal: "neon" },
    pastel:     { n: "Marca-texto pastel", g: "marca",  ic: "marca",     w: [70, 100, 140, 190, 260], modo: "liso",    alfa: 0.65, comp: "multiply", ponta: "butt", c: "#e0f2fe", pal: "pastel" },
    marcafina:  { n: "Marca-texto fino",g: "marca",     ic: "marca",     w: [30, 45, 60, 80, 100],    modo: "liso",    alfa: 0.42, comp: "multiply", c: "#f9a8d4", pal: "marca" },
    marcador:   { n: "Marcador",        g: "outros",    ic: "marcador",  w: [30, 45, 65, 90, 120],    modo: "liso",    alfa: 0.94, c: "#dc2626" },
    giz:        { n: "Giz de cera",     g: "outros",    ic: "giz",       w: [30, 45, 65, 90, 130],    modo: "pressao", alfa: 0.92, tex: "giz", c: "#ea580c" },
    aquarela:   { n: "Aquarela",        g: "outros",    ic: "aquarela",  w: [60, 90, 130, 180, 240],  modo: "afina",   alfa: 0.28, comp: "multiply", c: "#0ea5e9" },
    apagador:   { n: "Borracha de área",g: "",          ic: "borracha",  w: [60, 110, 170, 260, 400], modo: "liso",    alfa: 1,    comp: "destination-out" }
  };
  const GRUPOS = [["favs", "⭐ Favoritas"], ["canetas", "Canetas"], ["grafites", "Grafites"], ["marca", "Marca-textos"], ["outros", "Outros"]];
  const BORR_W = [60, 110, 170, 260, 400];
  const pincelDe = t => PINCEIS[t] || PINCEIS.caneta;
  const FAVS0 = [{ t: "caneta", c: "#111827", w: 18 }, { t: "caneta", c: "#2563eb", w: 18 }, { t: "tinteiro", c: "#dc2626", w: 26 }, { t: "lapis", c: "#374151", w: 16 }, { t: "marca", c: "#fde047", w: 140 }];
  const V = { a: null, pdf: null, img: null, pags: [], anot: {}, ferr: "pincel", pen: { ...FAVS0[0] }, borr: { modo: "traco", w: 170 },
    favs: FAVS0.map(f => ({ ...f })), recentes: ["#111827", "#2563eb", "#dc2626", "#16a34a"], dedoEscreve: false, lado: "esq", minim: false, aba: "favs",
    zoom: 1, desf: [], ref: [], sujas: new Set(), timer: null, obs: null, raf: 0, vis: new Set() };
  try { const s = JSON.parse(localStorage.getItem("la_estante_pref") || "null");
    if (s) { ["pen", "borr", "favs", "recentes", "dedoEscreve", "lado", "minim", "aba"].forEach(k => { if (s[k] != null) V[k] = s[k]; }); if (["pincel", "borracha", "mao"].includes(s.ferr)) V.ferr = s.ferr; }
    else { const v = JSON.parse(localStorage.getItem("la_estante_caneta") || "null"); if (v) V.dedoEscreve = !!v.dedoEscreve; } } catch (e) {}
  if (!PINCEIS[V.pen.t]) V.pen = { ...FAVS0[0] };
  const guardarPrefs = () => { try { localStorage.setItem("la_estante_pref", JSON.stringify({ pen: V.pen, borr: V.borr, favs: V.favs, recentes: V.recentes, dedoEscreve: V.dedoEscreve, lado: V.lado, minim: V.minim, aba: V.aba, ferr: V.ferr })); } catch (e) {} };

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
    const a = acharArq(id); if (!a) return;
    if (!a.compart) { a.aberto = Date.now(); salvarMeta(); }
    const ov = document.createElement("div"); ov.className = "est-leitor"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", a.nome);
    ov.innerHTML = `<div class="est-top">
        <button class="est-ic" type="button" data-v="voltar" aria-label="Voltar para a estante" title="Voltar">${ICF.voltar}</button>
        <div class="est-tt"><b class="est-titulo">${APP.esc(a.nome)}</b><span class="est-st" data-v-st></span></div>
        <button class="est-tx" type="button" data-v="transmitir" hidden title="Transmitir esta página na chamada (quem está na chamada vê o arquivo e o que você escreve)"><span class="est-tx-p"></span>📡 <span class="est-tx-t">Transmitir</span></button>
        <button class="est-zoom" type="button" data-v="zoom100" data-zoom title="Voltar ao tamanho da tela">100%</button>
        <button class="est-ic" type="button" data-v="cheia" aria-label="Tela cheia" title="Tela cheia">${ICF.cheia}</button>
        <button class="est-ic" type="button" data-v="menu" aria-label="Mais opções" title="Mais opções" aria-haspopup="menu">${ICF.mais}</button>
      </div>
      <div class="est-pags" tabindex="0"><div class="card row muted" style="margin:84px auto;max-width:420px"><span class="spinner"></span>Abrindo…</div></div>`;
    document.body.appendChild(ov); document.documentElement.classList.add("est-aberto");
    Object.assign(V, { a, pdf: null, img: null, pags: [], anot: {}, desf: [], ref: [], sujas: new Set(), zoom: 1, ov, salvoEm: 0, vis: new Set() });
    ov.classList.toggle("lado-dir", V.lado === "dir");
    ov.querySelector('[data-v="voltar"]').onclick = fecharLeitor;
    ov.querySelector(".est-top").onclick = e => {
      const v = e.target.closest("[data-v]"); if (!v) return; const x = v.dataset.v;
      if (x === "zoom100") mudarZoom(1); else if (x === "cheia") telaCheia(); else if (x === "menu") abrirMenu(v); else if (x === "transmitir") transmitir();
    };
    V.tecla = e => {
      if (document.querySelector(".est-modal")) return;
      if (e.key === "Escape") { if (ov.querySelector(".est-painel,.est-menu-v")) fecharPaineis(); else if (!document.fullscreenElement) fecharLeitor(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); refazer(); }
    };
    addEventListener("keydown", V.tecla);
    V.cheiaMudou = () => { const b = ov.querySelector('[data-v="cheia"]'); if (b) b.innerHTML = document.fullscreenElement ? ICF.sairCheia : ICF.cheia; setTimeout(() => { if (V.ov) ajustarAoRedimensionar(); }, 150); };
    document.addEventListener("fullscreenchange", V.cheiaMudou);
    V.chTick = setInterval(atualizarTx, 1500); atualizarTx();
    V.redim = () => { clearTimeout(V.redimT); V.redimT = setTimeout(() => { if (V.ov) ajustarAoRedimensionar(); }, 200); };
    addEventListener("resize", V.redim);
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
      ov.querySelector(".est-pags").innerHTML = `<div class="card stack" style="margin:84px auto;max-width:460px"><b>Não foi possível abrir este arquivo.</b><p class="small muted">Ele não está guardado neste aparelho. No aparelho onde ele está, use ⋯ › “Baixar com anotações” e envie o arquivo .laest aqui.</p></div>`;
      return;
    }
    if (!ov.isConnected) return;
    montarBarra(); montarPaginas();
  }
  async function carregarAnot() {
    if (V.a.compart) return ouvirTracos();
    const loc = await lg("anot", V.a.id).catch(() => null); V.anot = (loc && loc.pags) || {};
  }
  // arquivo conjunto: os traços chegam e saem em tempo real (um documento por traço)
  function ouvirTracos() {
    const a = V.a, r = conjRef(a.fid); V.anot = {}; V.idsSync = {}; V.unsubs = []; V.vivos = {};
    p2pIniciar(a);
    return new Promise(pronto => {
      let primeiro = true;
      V.unsubs.push(r.collection("tracos").onSnapshot(sn => {
        const mexidas = new Set(), novos = [];
        sn.docChanges().forEach(ch => {
          const d = ch.doc.data(), pg = +d.pag, id = ch.doc.id; if (!pg) return;
          const lista = V.anot[pg] = V.anot[pg] || [], ids = V.idsSync[pg] = V.idsSync[pg] || new Set();
          if (ch.type === "removed") { const i = lista.findIndex(x => x._id === id); if (i >= 0) { lista.splice(i, 1); mexidas.add(pg); } ids.delete(id); }
          else if (ch.type === "added" && !lista.some(x => x._id === id)) { try { const st = JSON.parse(d.s); st._id = id; novos.push([pg, st, d.em || 0]); ids.add(id); } catch (e) {} }
        });
        novos.sort((x, y) => x[2] - y[2]).forEach(([pg, st]) => { V.anot[pg].push(st); mexidas.add(pg); });
        if (primeiro) { primeiro = false; pronto(); } else mexidas.forEach(pg => redesenhar(pg));
      }, e => { console.warn("traços", e && e.code); if (primeiro) { primeiro = false; pronto(); } }));
      V.unsubs.push(r.onSnapshot(d => {
        if (!d.exists) { if (V.ov && V.a === a) { APP.toast("Este arquivo conjunto foi apagado ou você saiu dele."); fecharLeitor(); } return; }
        const x = d.data(); if (a.tipo === "caderno" && V.ov && (x.paginas || 1) > V.pags.length) { const box = V.ov.querySelector(".est-pags"), topo = box && box.scrollTop;
          while (V.pags.length < x.paginas) V.pags.push({ n: V.pags.length + 1, w: 1000, h: 1414 }); a.paginas = x.paginas; if (box) { montarPaginas(); box.scrollTop = topo; } }
      }, () => {}));
    });
  }
  function telaCheia() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (V.ov.requestFullscreen) V.ov.requestFullscreen().catch(() => APP.toast("Este navegador não deixa usar a tela cheia aqui."));
      else APP.toast("Este navegador não tem tela cheia. Dica: adicione o site à tela inicial para abrir como aplicativo.");
    } catch (e) {}
  }
  function fecharLeitor() {
    if (!V.ov) return; salvarAnot(true);
    removeEventListener("keydown", V.tecla); removeEventListener("resize", V.redim); document.removeEventListener("fullscreenchange", V.cheiaMudou);
    clearInterval(V.chTick); pararTx(); (V.unsubs || []).forEach(f => { try { f(); } catch (e) {} }); V.unsubs = []; p2pParar();
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    if (V.obs) V.obs.disconnect();
    if (V.pdf) { try { V.pdf.destroy(); } catch (e) {} }
    document.querySelectorAll(".est-modal").forEach(m => m.remove());
    V.ov.remove(); V.ov = null; document.documentElement.classList.remove("est-aberto");
    if (APP.naTela()) pintar();
  }
  const ehCaderno = () => V.a && V.a.tipo === "caderno";
  /* ---------- transmitir a página na chamada (para dar aula) ----------
     o que aparece na tela do leitor (folhas e desenhos) é copiado ~8 vezes por segundo para um vídeo que vai na chamada */
  const TX = { cv: null, track: null, laco: 0 };
  function atualizarTx() {
    if (!V.ov) return; const b = V.ov.querySelector('[data-v="transmitir"]'); if (!b) return;
    const pode = !!(APP.naChamada && APP.naChamada()), on = !!(TX.track && TX.track.readyState === "live" && APP.transmitindo && APP.transmitindo());
    if (TX.track && !on) pararTx(true);
    b.hidden = !pode && !on; b.classList.toggle("on", on); b.querySelector(".est-tx-t").textContent = on ? "Transmitindo" : "Transmitir";
  }
  function transmitir() {
    if (!V.ov) return;
    if (TX.track) { pararTx(); APP.toast("Transmissão encerrada."); return; }
    if (!(APP.naChamada && APP.naChamada())) { APP.toast("Entre numa chamada (Mensagens › 📹) para transmitir este arquivo."); return; }
    TX.cv = document.createElement("canvas");
    const quadro = () => vista(TX.cv, true);
    quadro();
    const st = TX.cv.captureStream ? TX.cv.captureStream(8) : null, t = st && st.getVideoTracks()[0];
    if (!t) { APP.toast("Este navegador não consegue transmitir o arquivo."); TX.cv = null; return; }
    t._estante = true; t.contentHint = "detail"; TX.track = t; TX.laco = setInterval(quadro, 125);
    APP.transmitir(t); atualizarTx();
    APP.toast("Transmitindo: quem está na chamada vê esta página e tudo o que você escrever.");
  }
  // desenha no canvas o que está na tela do leitor (folhas e traços); "ajustar" muda o tamanho do canvas para o da tela
  function vista(cv, ajustar) {
    if (!V.ov) return; const box = V.ov.querySelector(".est-pags"); if (!box) return;
    const bw = box.clientWidth, bh = box.clientHeight;
    if (ajustar) { const k0 = Math.min(1, 1280 / Math.max(1, bw)), W0 = Math.round(bw * k0), H0 = Math.round(bh * k0); if (cv.width !== W0 || cv.height !== H0) { cv.width = W0; cv.height = H0; } }
    const k = Math.min(cv.width / Math.max(1, bw), cv.height / Math.max(1, bh)), ox = (cv.width - bw * k) / 2, oy = (cv.height - bh * k) / 2;
    const c = cv.getContext("2d"), rb = box.getBoundingClientRect(); c.fillStyle = "#e9ebef"; c.fillRect(0, 0, cv.width, cv.height);
    box.querySelectorAll(".est-pag").forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom < rb.top || r.top > rb.bottom || r.right < rb.left || r.left > rb.right) return;
      const x = ox + (r.left - rb.left) * k, y = oy + (r.top - rb.top) * k, w = r.width * k, h = r.height * k;
      c.fillStyle = "#fff"; c.fillRect(x, y, w, h);
      [".est-base", ".est-tinta"].forEach(sel => { const q = el.querySelector(sel); if (q && q.width) try { c.drawImage(q, x, y, w, h); } catch (e) {} }); });
  }
  function pararTx(jaParou) { clearInterval(TX.laco); TX.laco = 0; if (TX.track) { if (!jaParou && APP.pararTransmissao) APP.pararTransmissao(); try { TX.track.stop(); } catch (e) {} } TX.track = null; TX.cv = null; if (V.ov) { const b = V.ov.querySelector('[data-v="transmitir"]'); if (b) { b.classList.remove("on"); b.querySelector(".est-tx-t").textContent = "Transmitir"; } } }
  function fecharPaineis() { if (V.ov) V.ov.querySelectorAll(".est-painel,.est-menu-v,.est-veu").forEach(x => x.remove()); }

  /* ---------- barra lateral de ferramentas (minimiza e maximiza) ---------- */
  const mesmaCaneta = (a, b) => a && b && a.t === b.t && a.c === b.c && a.w === b.w;
  function botaoCaneta(f, attrs, extra) {
    const pc = pincelDe(f.t);
    return `<button type="button" class="est-t est-pen ${extra || ""}" ${attrs} title="${APP.esc(pc.n)}" aria-label="${APP.esc(pc.n)}">${ICF[pc.ic]}<i class="est-ponta" style="background:${f.c}"></i></button>`;
  }
  function montarBarra() {
    const w = document.createElement("div"); w.className = "est-lado"; w.setAttribute("role", "toolbar"); w.setAttribute("aria-label", "Ferramentas de desenho"); w.setAttribute("aria-orientation", "vertical");
    V.ov.appendChild(w); V.barra = w;
    pintarBarra();
    w.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.v === "minim" || V.minim) { V.minim = !V.minim; guardarPrefs(); fecharPaineis(); pintarBarra(); ajustarAoRedimensionar(); return; }
      if (b.dataset.fav != null) { const f = V.favs[+b.dataset.fav]; if (!f) return;
        if (V.ferr === "pincel" && mesmaCaneta(V.pen, f)) { abrirPainel(); return; }
        V.pen = { ...f }; V.ferr = "pincel"; guardarPrefs(); fecharPaineis(); pintarBarra(); atualizarToque(); return; }
      const v = b.dataset.v;
      if (v === "pen") { if (V.ferr === "pincel") abrirPainel(); else { V.ferr = "pincel"; guardarPrefs(); pintarBarra(); atualizarToque(); } }
      else if (v === "borracha" || v === "mao") { if (V.ferr === v && v === "borracha") { abrirPainel(); return; } V.ferr = v; guardarPrefs(); fecharPaineis(); pintarBarra(); atualizarToque(); }
      else if (v === "desfazer") desfazer(); else if (v === "refazer") refazer();
    };
  }
  function pintarBarra() {
    const w = V.barra; if (!w) return;
    V.ov.classList.toggle("barra-min", V.minim);
    if (V.minim) {
      w.innerHTML = `<button type="button" class="est-t est-abre" data-v="minim" aria-label="Mostrar as ferramentas" title="Mostrar as ferramentas">${V.ferr === "pincel" ? ICF[pincelDe(V.pen.t).ic] : ICF[V.ferr]}${V.ferr === "pincel" ? `<i class="est-ponta" style="background:${V.pen.c}"></i>` : ""}</button>`;
      return;
    }
    const naFav = V.favs.findIndex(f => mesmaCaneta(f, V.pen));
    w.innerHTML = `<button type="button" class="est-t est-min" data-v="minim" aria-label="Esconder as ferramentas" title="Esconder as ferramentas">${ICF.recolher}</button>
      ${botaoCaneta(V.pen, `data-v="pen" aria-pressed="${V.ferr === "pincel"}"`, `est-atual ${V.ferr === "pincel" && naFav < 0 ? "on" : ""}`)}
      <div class="est-favs">${V.favs.map((f, i) => botaoCaneta(f, `data-fav="${i}"`, V.ferr === "pincel" && i === naFav ? "on" : "")).join("")}</div>
      <span class="est-sep"></span>
      <button type="button" class="est-t ${V.ferr === "borracha" ? "on" : ""}" data-v="borracha" aria-pressed="${V.ferr === "borracha"}" title="Borracha (toque de novo para as opções)" aria-label="Borracha">${ICF.borracha}</button>
      <button type="button" class="est-t ${V.ferr === "mao" ? "on" : ""}" data-v="mao" aria-pressed="${V.ferr === "mao"}" title="Mover a página" aria-label="Mover a página">${ICF.mao}</button>
      <span class="est-sep"></span>
      <button type="button" class="est-t" data-v="desfazer" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" ${V.desf.length ? "" : "disabled"}>${ICF.desfazer}</button>
      <button type="button" class="est-t" data-v="refazer" aria-label="Refazer" title="Refazer (Ctrl+Y)" ${V.ref.length ? "" : "disabled"}>${ICF.refazer}</button>`;
  }
  function usarCor(c) {
    V.pen = { ...V.pen, c }; V.ferr = "pincel";
    if (!pincelDe(V.pen.t).pal) V.recentes = [c].concat(V.recentes.filter(x => x !== c)).slice(0, 8);
    guardarPrefs(); pintarBarra(); atualizarToque();
  }
  // traço de exemplo para as prévias
  function amostra(ctx, f, W, H, larg) {
    ctx.clearRect(0, 0, W, H);
    const pts = [], q = []; for (let i = 0; i <= 26; i++) { pts.push(Math.round(700 + i * 330), Math.round(5000 + Math.sin(i / 3.3) * 2600)); q.push(30 + Math.round(60 * Math.sin(Math.PI * i / 26))); }
    tracar(ctx, { f: f.t, c: f.c, w: larg || f.w, p: pts, q }, W, H);
  }
  /* painel de canetas: abas (favoritas, canetas, grafites, marca-textos, outros), espessura e paleta completa */
  function abrirPainel() {
    fecharPaineis();
    const borr = V.ferr === "borracha", pc = pincelDe(V.pen.t);
    const p = document.createElement("div"); p.className = "est-painel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", borr ? "Borracha" : "Canetas e cores");
    if (borr) {
      p.innerHTML = `<div class="est-pn-h"><b>Borracha</b><button type="button" class="est-ic sm" data-pn="x" aria-label="Fechar">✕</button></div>
        <div class="seg est-seg" role="group"><button type="button" data-bm="traco" class="${V.borr.modo === "traco" ? "on" : ""}">Apaga o traço inteiro</button><button type="button" data-bm="area" class="${V.borr.modo === "area" ? "on" : ""}">Apaga só onde passar</button></div>
        <div class="est-pn-l small muted">Tamanho</div>
        <div class="est-tams">${BORR_W.map((t, i) => `<button type="button" class="est-tam ${V.borr.w === t ? "on" : ""}" data-bw="${t}" aria-label="Tamanho ${i + 1}"><i style="width:${6 + i * 5}px;height:${6 + i * 5}px"></i></button>`).join("")}</div>
        <button type="button" class="btn sm" data-pn="limpar" style="margin-top:12px">${ICF.lixo} Apagar todos os desenhos desta página</button>`;
    } else {
      const aba = V.aba, lista = aba === "favs" ? null : Object.entries(PINCEIS).filter(([, v]) => v.g === aba);
      const pal = pc.pal === "neon" ? PALETA_NEON : pc.pal === "pastel" ? PALETA_PASTEL : pc.pal === "marca" ? PALETA_MARCA : null;
      const naFav = V.favs.some(f => mesmaCaneta(f, V.pen));
      p.innerHTML = `<div class="est-pn-h"><b>${APP.esc(pc.n)}</b><span class="row" style="gap:4px"><button type="button" class="est-fav-b ${naFav ? "on" : ""}" data-pn="fav" aria-pressed="${naFav}" title="${naFav ? "Tirar das favoritas" : "Salvar nas favoritas"}">${ICF.estrela}<span>${naFav ? "Favorita" : "Favoritar"}</span></button><button type="button" class="est-ic sm" data-pn="x" aria-label="Fechar">✕</button></span></div>
        <canvas class="est-prev" width="600" height="90" aria-hidden="true"></canvas>
        <div class="est-abas" role="tablist">${GRUPOS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${aba === k}" class="${aba === k ? "on" : ""}" data-aba="${k}">${n}</button>`).join("")}</div>
        <div class="est-pincs">${lista ? lista.map(([k, v]) => `<button type="button" class="est-pinc ${V.pen.t === k ? "on" : ""}" data-pinc="${k}"><canvas width="160" height="44" data-amostra="${k}"></canvas><span>${APP.esc(v.n)}</span></button>`).join("")
          : (V.favs.length ? V.favs.map((f, i) => `<div class="est-pinc est-pinc-fav ${mesmaCaneta(f, V.pen) ? "on" : ""}"><button type="button" class="est-pinc-b" data-usafav="${i}"><canvas width="160" height="44" data-amostrafav="${i}"></canvas><span>${APP.esc(pincelDe(f.t).n)}</span></button><button type="button" class="est-pinc-x" data-tirafav="${i}" aria-label="Tirar das favoritas">✕</button></div>`).join("")
          : `<p class="small muted" style="grid-column:1/-1;margin:4px 2px">Escolha uma caneta, a cor e a espessura e toque em ⭐ Favoritar. Ela aparece na barra lateral.</p>`)}</div>
        <div class="est-pn-l small muted">Espessura</div>
        <div class="est-tams">${pc.w.map((t, i) => `<button type="button" class="est-tam ${V.pen.w === t ? "on" : ""}" data-w="${t}" aria-label="Espessura ${i + 1}"><i style="width:${5 + i * 5}px;height:${5 + i * 5}px;background:${V.pen.c}"></i></button>`).join("")}</div>
        <input type="range" min="${pc.w[0]}" max="${pc.w[4]}" value="${Math.min(pc.w[4], Math.max(pc.w[0], V.pen.w))}" data-pn="w" aria-label="Espessura">
        ${V.recentes.length && !pal ? `<div class="est-pn-l small muted">Recentes</div><div class="est-pal-g est-rec">${V.recentes.map(c => `<button type="button" class="est-cq ${c === V.pen.c ? "on" : ""}" data-pc="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join("")}</div>` : ""}
        ${pal ? `<div class="est-pn-l small muted">Cores do ${APP.esc(pc.n.toLowerCase())}</div><div class="est-pal-g">${pal.map(c => `<button type="button" class="est-cq ${c === V.pen.c ? "on" : ""}" data-pc="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join("")}</div>` : ""}
        <div class="est-pn-l small muted">Paleta</div>
        <div class="est-pal-g est-pal-12">${PALETA.map(c => `<button type="button" class="est-cq ${c === V.pen.c ? "on" : ""}" data-pc="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join("")}</div>
        <label class="btn sm est-outra"><span class="est-cq est-cq-livre" aria-hidden="true"></span>Escolher qualquer cor<input type="color" value="${V.pen.c}" data-pn="cor"></label>`;
    }
    V.ov.appendChild(p);
    if (!emFolha(p, V.ov, fecharPaineis)) {
      const rb = V.barra.getBoundingClientRect(), top = V.ov.querySelector(".est-top").getBoundingClientRect().bottom + 8;
      p.style.top = top + "px"; p.style.maxHeight = `calc(100% - ${top + 12}px)`;
      if (V.lado === "dir") p.style.right = (innerWidth - rb.left + 10) + "px"; else p.style.left = (rb.right + 10) + "px";
    }
    const prev = () => { const cv = p.querySelector(".est-prev"); if (cv) amostra(cv.getContext("2d"), V.pen, 600, 90, V.pen.w * 1.5); };
    prev();
    p.querySelectorAll("[data-amostra]").forEach(cv => { const t = cv.dataset.amostra, v = PINCEIS[t]; amostra(cv.getContext("2d"), { t, c: v.pal ? v.c : (V.pen.t === t || !pincelDe(V.pen.t).pal ? V.pen.c : v.c), w: v.w[2] }, 160, 44, v.w[2] * 1.8); });
    p.querySelectorAll("[data-amostrafav]").forEach(cv => { const f = V.favs[+cv.dataset.amostrafav]; amostra(cv.getContext("2d"), f, 160, 44, f.w * 1.8); });
    const refazerPainel = () => { const sc = p.querySelector(".est-pincs"), s = sc ? sc.scrollLeft : 0, rol = p.scrollTop; abrirPainel(); const np = V.ov.querySelector(".est-painel"); if (np) { np.scrollTop = rol; const ns = np.querySelector(".est-pincs"); if (ns) ns.scrollLeft = s; } };
    p.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.aba) { V.aba = b.dataset.aba; guardarPrefs(); refazerPainel(); return; }
      if (b.dataset.pinc) { const t = b.dataset.pinc, v = PINCEIS[t], antes = pincelDe(V.pen.t);
        const c = v.pal ? (antes.pal === v.pal ? V.pen.c : v.c) : (antes.pal ? (V.recentes[0] || v.c) : V.pen.c);
        V.pen = { t, c, w: v.w[2] }; V.ferr = "pincel"; guardarPrefs(); pintarBarra(); atualizarToque(); refazerPainel(); return; }
      if (b.dataset.usafav != null) { const f = V.favs[+b.dataset.usafav]; if (f) { V.pen = { ...f }; V.ferr = "pincel"; guardarPrefs(); pintarBarra(); atualizarToque(); refazerPainel(); } return; }
      if (b.dataset.tirafav != null) { V.favs.splice(+b.dataset.tirafav, 1); guardarPrefs(); pintarBarra(); refazerPainel(); return; }
      if (b.dataset.w) { V.pen = { ...V.pen, w: +b.dataset.w }; guardarPrefs(); pintarBarra(); refazerPainel(); return; }
      if (b.dataset.pc) { usarCor(b.dataset.pc); refazerPainel(); return; }
      if (b.dataset.bm) { V.borr.modo = b.dataset.bm; guardarPrefs(); refazerPainel(); return; }
      if (b.dataset.bw) { V.borr.w = +b.dataset.bw; guardarPrefs(); refazerPainel(); return; }
      const x = b.dataset.pn;
      if (x === "x") fecharPaineis();
      else if (x === "limpar") { fecharPaineis(); limparPagina(paginaNaTela()); }
      else if (x === "fav") { const i = V.favs.findIndex(f => mesmaCaneta(f, V.pen));
        if (i >= 0) V.favs.splice(i, 1); else { if (V.favs.length >= 12) { APP.toast("Você pode ter até 12 favoritas. Tire uma para salvar outra."); return; } V.favs.push({ ...V.pen }); APP.toast("Salva nas favoritas: ela está na barra lateral."); }
        guardarPrefs(); pintarBarra(); refazerPainel(); }
    };
    const rg = p.querySelector('[data-pn="w"]');
    if (rg) { rg.oninput = e => { V.pen = { ...V.pen, w: +e.target.value }; p.querySelectorAll("[data-w]").forEach(x => x.classList.toggle("on", +x.dataset.w === V.pen.w)); prev(); };
      rg.onchange = () => { guardarPrefs(); pintarBarra(); }; }
    const cor = p.querySelector('[data-pn="cor"]'); if (cor) cor.onchange = e => { usarCor(e.target.value); refazerPainel(); };
  }
  // menu ⋮ do leitor
  function abrirMenu(ancora) {
    const ja = V.ov.querySelector(".est-menu-v"); fecharPaineis(); if (ja) return;
    const n = paginaNaTela(), cad = ehCaderno(), m = document.createElement("div"); m.className = "est-menu-v"; m.setAttribute("role", "menu");
    m.innerHTML = `<div class="est-mn-zoom"><span>🔍</span>Zoom <button type="button" class="est-ic sm" data-mn="menos" aria-label="Diminuir">−</button><b>${Math.round(V.zoom * 100)}%</b><button type="button" class="est-ic sm" data-mn="mais" aria-label="Aumentar">+</button><button type="button" class="est-zoom" data-mn="z100">Ajustar</button></div>
      <button type="button" role="menuitemcheckbox" aria-checked="${V.dedoEscreve}" data-mn="caneta"><span>${V.dedoEscreve ? "✓" : "☝️"}</span>Escrever com o dedo <small>para celular sem caneta</small></button>
      <button type="button" role="menuitem" data-mn="lado"><span>↔</span>Ferramentas do lado ${V.lado === "dir" ? "esquerdo" : "direito"}</button>
      <button type="button" role="menuitem" data-mn="cheia"><span>⛶</span>${document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia"}</button>
      ${cad && V.a.compart ? `<button type="button" role="menuitem" data-mn="inserir"><span>＋</span>Nova folha no fim</button>` : ""}
      ${cad && !V.a.compart ? `<button type="button" role="menuitem" data-mn="inserir"><span>＋</span>Nova folha depois da ${n}</button>
        <button type="button" role="menuitem" data-mn="apagar-folha" class="danger" ${V.pags.length < 2 ? "disabled" : ""}><span>${ICF.lixo}</span>Apagar a folha ${n}${V.pags.length < 2 ? " <small>o caderno precisa de ao menos uma</small>" : ""}</button>` : ""}
      <button type="button" role="menuitem" data-mn="limpar"><span>🧽</span>Apagar os desenhos da página ${n}</button>
      <button type="button" role="menuitem" data-mn="exportar"><span>⬇</span>Baixar a página ${n} como imagem</button>
      <button type="button" role="menuitem" data-mn="renomear"><span>✎</span>Renomear</button>`;
    V.ov.appendChild(m);
    const tirar = () => { m.remove(); fecharPaineis(); document.removeEventListener("pointerdown", fora, true); };
    if (!emFolha(m, V.ov, tirar)) { const r = ancora.getBoundingClientRect(); m.style.top = (r.bottom + 6) + "px"; m.style.right = Math.max(8, innerWidth - r.right) + "px"; }
    const fora = ev => { if (ev.target.classList && ev.target.classList.contains("est-veu")) return; if (!m.contains(ev.target) && !ancora.contains(ev.target)) tirar(); };
    setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
    m.onclick = async e => {
      const b = e.target.closest("[data-mn]"); if (!b || b.disabled) return;
      const x = b.dataset.mn;
      if (x === "mais" || x === "menos" || x === "z100") { mudarZoom(x === "z100" ? 1 : V.zoom + (x === "mais" ? 0.25 : -0.25)); const z = m.querySelector(".est-mn-zoom b"); if (z) z.textContent = Math.round(V.zoom * 100) + "%"; return; }
      tirar();
      if (x === "caneta") { V.dedoEscreve = !V.dedoEscreve; guardarPrefs(); APP.toast(V.dedoEscreve ? "O dedo também escreve. Para rolar, use dois dedos ou a mão (✋)." : "O dedo rola a página e a caneta escreve."); }
      else if (x === "lado") { V.lado = V.lado === "dir" ? "esq" : "dir"; guardarPrefs(); V.ov.classList.toggle("lado-dir", V.lado === "dir"); ajustarAoRedimensionar(); }
      else if (x === "cheia") telaCheia();
      else if (x === "inserir") inserirFolha(n);
      else if (x === "apagar-folha") apagarFolha(n);
      else if (x === "limpar") limparPagina(n);
      else if (x === "exportar") exportar(n);
      else if (x === "renomear") { if (V.a.compart) { APP.toast("O nome do arquivo conjunto é o que a pessoa que compartilhou escolheu."); return; } const nome = await pedirTexto("Renomear", "Nome", V.a.nome); if (nome) { V.a.nome = nome.slice(0, 80); V.ov.querySelector(".est-titulo").textContent = V.a.nome; salvarMeta(); } }
    };
  }

  /* ---------- folhas do caderno ---------- */
  function renumerar(map) { const novo = {}; Object.keys(V.anot).forEach(k => { const d = map(+k); if (d) novo[d] = V.anot[k]; }); V.anot = novo; }
  async function inserirFolha(depois) {
    const total = V.pags.length;
    if (V.a.compart) { V.pags.push({ n: total + 1, w: 1000, h: 1414 }); V.a.paginas = V.pags.length;
      try { await conjRef(V.a.fid).update({ paginas: V.pags.length, atualizado: Date.now() }); } catch (e) { APP.toast("Não foi possível criar a folha."); V.pags.pop(); return; }
      const box = V.ov.querySelector(".est-pags"), topo = box.scrollTop; montarPaginas(); box.scrollTop = topo;
      setTimeout(() => { const el = V.ov && V.ov.querySelector(`[data-pag="${V.pags.length}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
      APP.toast(`Folha ${V.pags.length} criada no fim do caderno.`); return; }
    renumerar(k => k > depois ? k + 1 : k);
    V.pags.push({ n: total + 1, w: 1000, h: 1414 }); V.pags.forEach((p, i) => { p.n = i + 1; p.pronta = 0; });
    for (let k = depois + 1; k <= total + 1; k++) V.sujas.add(k);
    V.desf = []; V.ref = []; V.a.paginas = V.pags.length; await salvarMeta();
    const box = V.ov.querySelector(".est-pags"), topo = box.scrollTop;
    montarPaginas(); box.scrollTop = topo; salvarAnot();
    setTimeout(() => { const el = V.ov && V.ov.querySelector(`[data-pag="${depois + 1}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    APP.toast(`Folha ${depois + 1} criada.`);
  }
  async function apagarFolha(n) {
    if (V.a.compart) { APP.toast("Em arquivos conjuntos não dá para apagar folhas. Apague os desenhos da página pelo menu ⋮."); return; }
    if (V.pags.length < 2) { APP.toast("O caderno precisa de pelo menos uma folha. Para recomeçar, apague os desenhos da página."); return; }
    if (!await perguntar(`Apagar a folha ${n}?`, "A folha e tudo o que foi escrito nela somem. As folhas seguintes sobem uma posição.", "Apagar folha", true)) return;
    const total = V.pags.length;
    renumerar(k => k < n ? k : k > n ? k - 1 : 0);
    V.pags.pop(); V.pags.forEach((p, i) => { p.n = i + 1; p.pronta = 0; });
    for (let k = n; k <= total; k++) V.sujas.add(k);
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

  /* ---------- páginas (ocupam a tela toda) ---------- */
  function largura() {
    const box = V.ov.querySelector(".est-pags"), larga = box.clientWidth >= 900, folga = box.clientWidth < 600 ? 12 : 32;
    const lateral = larga && !V.minim ? 76 : 0;              // em telas largas, a página não fica embaixo da barra lateral
    return Math.max(200, Math.min(box.clientWidth - folga - lateral, 1500)) * V.zoom;
  }
  function tamanhoDe(p, W) { return [Math.round(W), Math.round(W * p.h / p.w)]; }
  function montarPaginas() {
    const box = V.ov.querySelector(".est-pags"), W = largura(), cad = ehCaderno();
    box.innerHTML = `<div class="est-conteudo">${V.pags.map(p => { const [w, h] = tamanhoDe(p, W); return `<div class="est-pag" data-pag="${p.n}" style="width:${w}px;height:${h}px"><canvas class="est-base"></canvas><canvas class="est-tinta"></canvas>
        <span class="est-num">${p.n} / ${V.pags.length}</span>${cad && V.pags.length > 1 && !V.a.compart ? `<button type="button" class="est-pag-x" data-apagar-folha="${p.n}" aria-label="Apagar a folha ${p.n}" title="Apagar esta folha">${ICF.lixo}</button>` : ""}</div>`; }).join("")
      + (cad ? `<button type="button" class="est-nova-folha" style="width:${Math.round(W)}px" data-nova-folha>＋ Nova folha</button>` : "")}</div>`;
    V.pags.forEach(p => p.pronta = 0); V.vis = new Set();
    if (V.obs) V.obs.disconnect();
    V.obs = new IntersectionObserver(es => es.forEach(en => { const n = +en.target.dataset.pag; if (en.isIntersecting) { V.vis.add(n); desenharPagina(n); } else V.vis.delete(n); }), { root: box, rootMargin: "600px 300px" });
    box.querySelectorAll(".est-pag").forEach(el => V.obs.observe(el));
    box.onclick = e => {
      const nf = e.target.closest("[data-nova-folha]"); if (nf) { inserirFolha(V.pags.length); return; }
      const af = e.target.closest("[data-apagar-folha]"); if (af) apagarFolha(+af.dataset.apagarFolha);
    };
    ligarCaneta(box); atualizarToque(); mostrarZoom(); status();
  }
  function mostrarZoom(z) { const el = V.ov && V.ov.querySelector("[data-zoom]"); if (el) el.textContent = Math.round((z || V.zoom) * 100) + "%"; }
  // zoom sem recarregar: as folhas mudam de tamanho na hora (a imagem atual estica) e a versão nítida entra quando fica pronta
  function aplicarTamanhos() {
    const box = V.ov.querySelector(".est-pags"), W = largura();
    box.querySelectorAll(".est-pag").forEach(el => { const p = V.pags[+el.dataset.pag - 1]; if (!p) return; const [w, h] = tamanhoDe(p, W); el.style.width = w + "px"; el.style.height = h + "px"; });
    const nf = box.querySelector(".est-nova-folha"); if (nf) nf.style.width = Math.round(W) + "px";
  }
  function mudarZoom(z, centro) {
    z = Math.max(0.5, Math.min(4, +(+z).toFixed(2))); if (!V.ov || z === V.zoom) { mostrarZoom(); return; }
    const box = V.ov.querySelector(".est-pags"), r = box.getBoundingClientRect();
    const cx = centro ? centro.x - r.left : box.clientWidth / 2, cy = centro ? centro.y - r.top : box.clientHeight / 2;
    const kx = (box.scrollLeft + cx) / Math.max(1, box.scrollWidth), ky = (box.scrollTop + cy) / Math.max(1, box.scrollHeight);
    V.zoom = z; aplicarTamanhos();
    box.scrollLeft = kx * box.scrollWidth - cx; box.scrollTop = ky * box.scrollHeight - cy;
    mostrarZoom();
    V.pags.forEach(p => { const el = box.querySelector(`[data-pag="${p.n}"]`); if (el) redesenhar(p.n); });   // tinta nítida na hora
    clearTimeout(V.zoomT); V.zoomT = setTimeout(() => { [...V.vis].forEach(n => desenharPagina(n)); }, 120);
  }
  function ajustarAoRedimensionar() { if (!V.ov || !V.pags.length) return; aplicarTamanhos(); [...V.vis].forEach(n => desenharPagina(n)); V.pags.forEach(p => redesenhar(p.n)); }
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const escala = W => Math.min(dpr(), 2600 / Math.max(1, W));      // limita o tamanho da imagem em zoom alto (memória)
  async function desenharPagina(n) {
    const p = V.pags[n - 1], el = V.ov && V.ov.querySelector(`[data-pag="${n}"]`); if (!p || !el) return;
    const W = parseFloat(el.style.width) || el.clientWidth, H = parseFloat(el.style.height) || el.clientHeight, r = escala(W);
    const k = Math.round(W * r) + "x" + Math.round(H * r); if (p.pronta === k || p.fazendo === k) return; p.fazendo = k;
    const base = el.querySelector(".est-base"), tmp = document.createElement("canvas");
    tmp.width = Math.round(W * r); tmp.height = Math.round(H * r);
    const ctx = tmp.getContext("2d");
    try {
      if (V.pdf) { const pg = await V.pdf.getPage(n), v = pg.getViewport({ scale: tmp.width / p.w }); await pg.render({ canvasContext: ctx, viewport: v }).promise; }
      else if (V.img) ctx.drawImage(V.img, 0, 0, tmp.width, tmp.height);
      else fundoCaderno(ctx, tmp.width, tmp.height, V.a.modelo);
    } catch (e) { p.fazendo = 0; return; }
    if (p.fazendo !== k || !el.isConnected) return;         // outro zoom começou: este resultado ficou velho
    base.width = tmp.width; base.height = tmp.height; base.getContext("2d").drawImage(tmp, 0, 0);
    p.pronta = k; p.fazendo = 0;
    redesenhar(n);
  }

  /* ---------- desenho dos traços ---------- */
  const TEX = {};
  function textura(tipo) {                                    // ruído para grafite e giz (cada ponto com transparência diferente)
    if (TEX[tipo]) return TEX[tipo];
    const cv = document.createElement("canvas"), N = 64; cv.width = cv.height = N; const c = cv.getContext("2d"), im = c.createImageData(N, N);
    let sem = tipo === "giz" ? 7 : 3; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    for (let i = 0; i < N * N; i++) {
      const v = rnd(); let a;
      if (tipo === "giz") a = v < 0.3 ? 0 : 150 + v * 105; else a = v < 0.12 ? 40 : 120 + v * 135;
      im.data[i * 4 + 3] = a;
    }
    if (tipo === "giz") for (let i = 0; i < N * N; i += 5) if (rnd() < 0.5) im.data[i * 4 + 3] = 0;
    c.putImageData(im, 0, 0); return (TEX[tipo] = cv);
  }
  let RASC = null;
  function rascunho(w, h) { if (!RASC) RASC = document.createElement("canvas"); if (RASC.width < w) RASC.width = Math.ceil(w); if (RASC.height < h) RASC.height = Math.ceil(h); const c = RASC.getContext("2d"); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, RASC.width, RASC.height); return c; }
  // forma do traço desenhada em cor sólida (sem transparência) no contexto c, já deslocada por (ox, oy)
  function forma(c, s, W, H, ox, oy, pc, base) {
    const pt = s.p, n = pt.length / 2, X = i => pt[i] / 10000 * W - ox, Y = i => pt[i + 1] / 10000 * H - oy;
    c.strokeStyle = c.fillStyle = s.c || "#000"; c.lineJoin = "round"; c.lineCap = pc.ponta || "round";
    const q = s.q && s.q.length === n ? s.q : null;
    if (n === 1) { c.beginPath(); c.arc(X(0), Y(0), base / 2, 0, 7); c.fill(); return; }
    if (pc.modo === "chanfro") {                              // caligrafia: ponta chata inclinada a 45°
      const dx = base * 0.5 * Math.SQRT1_2, dy = -base * 0.5 * Math.SQRT1_2;
      for (let j = 1; j < n; j++) { const ax = X(2 * j - 2), ay = Y(2 * j - 2), bx = X(2 * j), by = Y(2 * j);
        c.beginPath(); c.moveTo(ax - dx, ay - dy); c.lineTo(ax + dx, ay + dy); c.lineTo(bx + dx, by + dy); c.lineTo(bx - dx, by - dy); c.closePath(); c.fill();
        c.lineWidth = Math.max(1, base * 0.08); c.stroke(); }
      return;
    }
    const varia = pc.modo === "pressao" || pc.modo === "afina" || (q && pc.modo === "liso" && !pc.comp);
    if (!varia) {
      c.lineWidth = base; c.beginPath(); c.moveTo(X(0), Y(0));
      for (let i = 2; i < pt.length - 2; i += 2) c.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 2)) / 2, (Y(i) + Y(i + 2)) / 2);
      c.lineTo(X(pt.length - 2), Y(pt.length - 2)); c.stroke(); return;
    }
    // espessura por ponto: força da caneta (ou velocidade, sem caneta), pontas finas no pincel
    const lg = [];
    for (let j = 0; j < n; j++) {
      let f;
      if (q) f = pc.modo === "liso" ? 0.8 + q[j] / 100 * 0.4 : 0.35 + q[j] / 100 * 0.95;
      else { const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1), d = Math.hypot(X(2 * b) - X(2 * a), Y(2 * b) - Y(2 * a)) / Math.max(1, b - a); f = Math.max(0.5, Math.min(1.25, 1.3 - d / (base * 5))); }
      if (pc.modo === "afina") { const t = Math.min(j, n - 1 - j) / Math.max(1, Math.min(8, n / 3)); f *= Math.min(1, 0.25 + t * 0.75); }
      lg.push(base * f);
    }
    for (let j = 1; j < n; j++) lg[j] = lg[j - 1] * 0.45 + lg[j] * 0.55;   // suaviza a variação
    let px = X(0), py = Y(0);
    for (let j = 1; j < n; j++) {
      const i = j * 2, ult = j === n - 1, mx = ult ? X(i) : (X(i) + X(i + 2)) / 2, my = ult ? Y(i) : (Y(i) + Y(i + 2)) / 2;
      c.lineWidth = Math.max(0.6, (lg[j - 1] + lg[j]) / 2); c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(X(i), Y(i), mx, my); c.stroke(); px = mx; py = my;
    }
  }
  function tracar(ctx, s, W, H) {
    const pt = s.p; if (!pt || pt.length < 2) return;
    const pc = pincelDe(s.f), base = Math.max(0.8, s.w / 10000 * W);
    const simples = (pc.alfa || 1) >= 1 && !pc.tex && (!pc.comp || pc.comp === "destination-out");
    ctx.save();
    if (simples) { if (pc.comp) ctx.globalCompositeOperation = pc.comp; forma(ctx, s, W, H, 0, 0, pc, base); ctx.restore(); return; }
    // traço transparente ou com textura: desenha a forma sólida num rascunho do tamanho do traço e cola com a transparência
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pt.length; i += 2) { const x = pt[i] / 10000 * W, y = pt[i + 1] / 10000 * H; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const m = base * 1.4 + 2; x0 = Math.floor(Math.max(0, x0 - m)); y0 = Math.floor(Math.max(0, y0 - m)); x1 = Math.ceil(Math.min(W, x1 + m)); y1 = Math.ceil(Math.min(H, y1 + m));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) { ctx.restore(); return; }
    const c = rascunho(w, h); forma(c, s, W, H, x0, y0, pc, base);
    if (pc.tex) { c.globalCompositeOperation = "destination-in"; const pat = c.createPattern(textura(pc.tex), "repeat"); c.save(); c.translate(-x0 % 64, -y0 % 64); c.fillStyle = pat; c.fillRect(0, 0, w + 64, h + 64); c.restore(); c.globalCompositeOperation = "source-over"; }
    ctx.globalAlpha = pc.alfa || 1; if (pc.comp) ctx.globalCompositeOperation = pc.comp;
    ctx.drawImage(RASC, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
  }
  function redesenhar(n, extra) {
    const el = V.ov && V.ov.querySelector(`[data-pag="${n}"] .est-tinta`); if (!el) return;
    const pg = el.parentNode, W = parseFloat(pg.style.width) || pg.clientWidth, H = parseFloat(pg.style.height) || pg.clientHeight, r = escala(W);
    const tw = Math.round(W * r), th = Math.round(H * r);
    if (el.width !== tw || el.height !== th) { el.width = tw; el.height = th; }
    const ctx = el.getContext("2d"); ctx.clearRect(0, 0, el.width, el.height);
    (V.anot[n] || []).forEach(s => tracar(ctx, s, el.width, el.height));
    if (V.vivos) Object.values(V.vivos).forEach(x => { if (x.pag === n && Date.now() - x.em < 8000) tracar(ctx, x.s, el.width, el.height); });
    if (extra) tracar(ctx, extra, el.width, el.height);
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
    const meio = () => { const [a, b] = [...toques.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const fimPinca = () => { if (!gesto || gesto.tipo !== "pinca") return; const g = gesto; gesto = null; const w = box.querySelector(".est-conteudo"); if (w) w.style.transform = ""; mudarZoom(g.z, g.m); };
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
          const m = meio(), w = box.querySelector(".est-conteudo"), r = w.getBoundingClientRect();
          w.style.transformOrigin = `${m.x - r.left}px ${m.y - r.top}px`;
          gesto = { tipo: "pinca", d0: dist(), z0: V.zoom, z: V.zoom, m }; e.preventDefault(); return; }
        if (toques.size > 2) return;
        if (!V.dedoEscreve || V.ferr === "mao") { comecarRolar(e); return; } }
      if (V.ferr === "mao") { if (e.pointerType === "mouse") comecarRolar(e); return; }
      const el = e.target.closest(".est-pag"); if (!el) return;
      if (e.button > 0) return;
      e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (er) {}
      pag = +el.dataset.pag;
      const [x, y] = pos(e, el);
      if (V.ferr === "borracha" && V.borr.modo !== "area") { atual = { borracha: true, el, rem: [], id: e.pointerId, ptr: e.pointerType }; apagarPerto(x, y, el); return; }
      const caneta = e.pointerType === "pen" && e.pressure > 0;
      atual = V.ferr === "borracha" ? { f: "apagador", c: "#000", w: V.borr.w, p: [x, y], el, id: e.pointerId, ptr: e.pointerType }
        : { f: V.pen.t, c: V.pen.c, w: V.pen.w, p: [x, y], el, id: e.pointerId, ptr: e.pointerType };
      if (V.a.compart) atual.k = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (caneta) atual.q = [Math.round(e.pressure * 100)];
    };
    box.onpointermove = e => {
      if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesto && gesto.tipo === "pinca") { if (toques.size >= 2) { gesto.z = Math.max(0.5, Math.min(4, gesto.z0 * dist() / gesto.d0)); const w = box.querySelector(".est-conteudo"); if (w) w.style.transform = `scale(${gesto.z / V.zoom})`; mostrarZoom(gesto.z); } return; }
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
      if (!atual.borracha && V.a.compart) p2pVivo(pag, limpo(atual), atual.k);
    };
    const limpo = a => { const { el, id, ptr, k, ...s } = a; if (s.q && s.q.length !== s.p.length / 2) delete s.q; return s; };
    const fim = e => {
      if (toques.has(e.pointerId)) { toques.delete(e.pointerId); if (gesto && gesto.tipo === "pinca" && toques.size < 2) { fimPinca(); return; } }
      if (gesto && gesto.tipo === "rolar" && e.pointerId === gesto.id) { const g = gesto; gesto = null; if (e.type === "pointerup") soltarEmbalo(g); return; }
      if (!atual || e.pointerId !== atual.id) return;
      if (atual.borracha) { if (atual.rem.length) { empilhar({ pag, rem: atual.rem }); marcar(pag); } }
      else { const s = limpo(atual); if (atual.k) { s._k = atual.k; } (V.anot[pag] = V.anot[pag] || []).push(s); empilhar({ pag, add: s }); redesenhar(pag);
        if (V.a.compart) { clearTimeout(V.timer); V.sujas.add(pag); salvarAnot(); } else marcar(pag); }
      atual = null;
    };
    box.onpointerup = fim; box.onpointercancel = fim;
    box.onwheel = e => { pararEmbalo(); if (e.ctrlKey) { e.preventDefault(); mudarZoom(V.zoom * (e.deltaY < 0 ? 1.1 : 0.9), { x: e.clientX, y: e.clientY }); } };   // pinça do touchpad
    function apagarPerto(x, y, el) {
      const lista = V.anot[pag] || [], raio = V.borr.w / 2, asp = el.clientHeight / el.clientWidth;
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
    const vivos = V.a && V.a.compart ? p2pAbertos().length : 0;
    if (st) st.textContent = (vivos ? `⚡ ao vivo com ${vivos === 1 ? "1 pessoa" : vivos + " pessoas"} · ` : "") + (V.sujas.size ? "salvando…" : (V.salvoEm ? "salvo ✓" : (V.pags.length ? `${V.pags.length} ${V.pags.length === 1 ? "página" : "páginas"}` : "")));
    V.ov.querySelectorAll('[data-v="desfazer"]').forEach(d => d.disabled = !V.desf.length);
    V.ov.querySelectorAll('[data-v="refazer"]').forEach(r => r.disabled = !V.ref.length);
  }
  function marcar(p) { V.sujas.add(p); status(); clearTimeout(V.timer); V.timer = setTimeout(() => salvarAnot(), V.a && V.a.compart ? 60 : 900); }
  async function salvarAnot() {
    if (!V.a || !V.sujas.size) return;
    if (V.a.compart) return salvarTracos();
    const a = V.a, anot = V.anot, sujas = [...V.sujas]; V.sujas.clear(); const em = Date.now();
    await gr("anot", a.id, { pags: anot, em }).catch(() => {});
    const comTinta = Object.keys(anot).filter(p => (anot[p] || []).length).map(Number).sort((x, y) => x - y);
    const x = E.meta.arquivos.find(y => y.id === a.id), apAntes = (x && x.ap) || [];
    if (x) x.ap = comTinta;
    if (x && apAntes.join() !== comTinta.join()) await salvarMeta();
    V.salvoEm = em; status();
  }
  /* ---------- conexão direta entre quem está com a nota aberta (WebRTC) ----------
     O aparelho do autor é a central (se ele não estiver, o primeiro da lista): os outros se ligam a ele e ele repassa.
     Traços, apagados e o traço que ainda está sendo escrito chegam em décimos de segundo; a nuvem só guarda. */
  const P2P = { fid: null, sessao: "", pcs: {}, online: {}, unsubs: [], hb: 0, central: null, ultimoVivo: 0 };
  const p2pAtivo = () => !!P2P.fid;
  function p2pIniciar(a) {
    const db = nuv(); if (!db || !window.RTCPeerConnection) return;
    p2pParar(); Object.assign(P2P, { fid: a.fid, dono: a.dono, sessao: Math.random().toString(36).slice(2, 10), pcs: {}, online: {}, unsubs: [], central: null });
    const r = conjRef(a.fid), eu = r.collection("online").doc(E.uid);
    const pulso = () => eu.set({ sessao: P2P.sessao, em: Date.now(), nome: APP.meuNome ? APP.meuNome() : "" }).catch(() => {});
    pulso(); P2P.hb = setInterval(pulso, 20000);
    P2P.unsubs.push(r.collection("online").onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { const x = d.data(); if (d.id !== E.uid && Date.now() - (x.em || 0) < 75000) m[d.id] = x; }); P2P.online = m; p2pOrganizar(); }, () => {}));
    P2P.unsubs.push(r.collection("sinais").where("para", "==", E.uid).onSnapshot(sn => sn.docChanges().forEach(ch => { if (ch.type === "added") { const d = ch.doc.data(); ch.doc.ref.delete().catch(() => {}); p2pSinal(d); } }), () => {}));
  }
  function p2pParar() {
    if (!P2P.fid) return; const fid = P2P.fid;
    clearInterval(P2P.hb); P2P.unsubs.forEach(f => { try { f(); } catch (e) {} });
    Object.keys(P2P.pcs).forEach(p2pFechar);
    try { conjRef(fid).collection("online").doc(E.uid).delete().catch(() => {}); } catch (e) {}
    Object.assign(P2P, { fid: null, pcs: {}, online: {}, unsubs: [], central: null }); V.vivos = {};
  }
  function p2pCentral() { const ids = [E.uid].concat(Object.keys(P2P.online)); return ids.includes(P2P.dono) ? P2P.dono : ids.sort()[0]; }
  function p2pOrganizar() {
    if (!P2P.fid) return; const c = p2pCentral(); P2P.central = c;
    const quero = c === E.uid ? Object.keys(P2P.online) : (P2P.online[c] ? [c] : []);
    Object.keys(P2P.pcs).forEach(u => { const x = P2P.pcs[u]; if (!quero.includes(u) || (P2P.online[u] && P2P.online[u].sessao !== x.sessaoDele)) p2pFechar(u); });
    quero.forEach(u => { if (!P2P.pcs[u] && E.uid === c) p2pOferecer(u); });   // a central liga para cada um
    status();
  }
  function p2pPar(u, sessaoDele) {
    const pc = new RTCPeerConnection({ iceServers: (APP.ice && APP.ice()) || [{ urls: "stun:stun.l.google.com:19302" }] });
    const x = { pc, dc: null, sessaoDele, fila: [], criado: Date.now() }; P2P.pcs[u] = x;
    pc.onicecandidate = e => { if (e.candidate) p2pEnviarSinal(u, sessaoDele, "ice", JSON.stringify(e.candidate)); };
    pc.ondatachannel = e => p2pCanal(u, e.channel);
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") { if (P2P.pcs[u] === x) p2pFechar(u); setTimeout(p2pOrganizar, 1500); } status(); };
    return x;
  }
  function p2pCanal(u, dc) { const x = P2P.pcs[u]; if (!x) return; x.dc = dc; dc.onopen = () => status(); dc.onclose = () => status(); dc.onmessage = e => { try { p2pReceber(u, JSON.parse(e.data)); } catch (er) {} }; }
  async function p2pOferecer(u) {
    const d = P2P.online[u]; if (!d) return; const x = p2pPar(u, d.sessao);
    p2pCanal(u, x.pc.createDataChannel("tracos", { ordered: true }));
    try { const o = await x.pc.createOffer(); await x.pc.setLocalDescription(o); p2pEnviarSinal(u, d.sessao, "offer", JSON.stringify(x.pc.localDescription)); } catch (e) { console.warn("p2p oferta", e); }
  }
  function p2pEnviarSinal(u, alvo, tipo, dados) { if (!P2P.fid) return; conjRef(P2P.fid).collection("sinais").add({ de: E.uid, para: u, sde: P2P.sessao, alvo, tipo, dados, em: Date.now() }).catch(() => {}); }
  async function p2pSinal(d) {
    if (!P2P.fid || d.alvo !== P2P.sessao || Date.now() - (d.em || 0) > 60000) return;
    try {
      if (d.tipo === "offer") { if (P2P.pcs[d.de]) p2pFechar(d.de); const x = p2pPar(d.de, d.sde); await x.pc.setRemoteDescription(JSON.parse(d.dados));
        for (const c of x.fila.splice(0)) await x.pc.addIceCandidate(c).catch(() => {});
        const r = await x.pc.createAnswer(); await x.pc.setLocalDescription(r); p2pEnviarSinal(d.de, d.sde, "answer", JSON.stringify(x.pc.localDescription)); }
      else if (d.tipo === "answer") { const x = P2P.pcs[d.de]; if (x && x.pc.signalingState === "have-local-offer") { await x.pc.setRemoteDescription(JSON.parse(d.dados)); for (const c of x.fila.splice(0)) await x.pc.addIceCandidate(c).catch(() => {}); } }
      else if (d.tipo === "ice") { const x = P2P.pcs[d.de]; if (!x) return; const c = JSON.parse(d.dados); if (x.pc.remoteDescription) await x.pc.addIceCandidate(c).catch(() => {}); else x.fila.push(c); }
    } catch (e) { console.warn("p2p sinal", e); }
  }
  function p2pFechar(u) { const x = P2P.pcs[u]; if (!x) return; try { x.pc.close(); } catch (e) {} delete P2P.pcs[u]; Object.keys(V.vivos || {}).forEach(k => { if (k.startsWith(u + ":")) { const pg = V.vivos[k].pag; delete V.vivos[k]; redesenhar(pg); } }); }
  const p2pAbertos = () => Object.entries(P2P.pcs).filter(([, x]) => x.dc && x.dc.readyState === "open");
  function p2pMandar(msg, exceto) { const t = JSON.stringify(msg); p2pAbertos().forEach(([u, x]) => { if (u !== exceto) try { x.dc.send(t); } catch (e) {} }); }
  function p2pReceber(de, m) {
    if (!V.a || !V.a.compart || V.a.fid !== P2P.fid) return;
    if (P2P.central === E.uid) p2pMandar(m, de);                    // a central repassa para os outros
    const pg = +m.pag;
    if (m.t === "add" && m.s && m.s._id && pg) { const l = V.anot[pg] = V.anot[pg] || []; if (!l.some(x => x._id === m.s._id)) { l.push(m.s); (V.idsSync[pg] = V.idsSync[pg] || new Set()).add(m.s._id); }
      if (m.k) delete (V.vivos || {})[m.k]; redesenhar(pg); }
    else if (m.t === "del" && pg) { const l = V.anot[pg] || []; (m.ids || []).forEach(id => { const i = l.findIndex(x => x._id === id); if (i >= 0) l.splice(i, 1); if (V.idsSync[pg]) V.idsSync[pg].delete(id); }); redesenhar(pg); }
    else if (m.t === "vivo" && pg && m.k) { (V.vivos = V.vivos || {})[m.k] = { pag: pg, s: m.s, em: Date.now() }; redesenhar(pg); }
    else if (m.t === "fimvivo" && m.k && V.vivos && V.vivos[m.k]) { const p2 = V.vivos[m.k].pag; delete V.vivos[m.k]; redesenhar(p2); }
  }
  // traço sendo escrito agora: vai ~20 vezes por segundo para quem está com a nota aberta
  function p2pVivo(pag, s, k) { if (!p2pAtivo() || !p2pAbertos().length) return; const agora = Date.now(); if (agora - P2P.ultimoVivo < 50) return; P2P.ultimoVivo = agora; p2pMandar({ t: "vivo", pag, k: E.uid + ":" + k, s }); }
  function p2pFimVivo(k) { if (p2pAtivo()) p2pMandar({ t: "fimvivo", k: E.uid + ":" + k }); }

  // envia o que mudou nas páginas sujas: traço novo vira documento, traço apagado sai da nuvem
  async function salvarTracos() {
    const a = V.a, col = conjRef(a.fid).collection("tracos"), sujas = [...V.sujas]; V.sujas.clear();
    try {
      const gravar = [];
      for (const pg of sujas) {
        const lista = V.anot[pg] || [], antes = V.idsSync[pg] = V.idsSync[pg] || new Set(), agora = new Set(), novos = [], saiu = [];
        for (const st of lista) { if (!st._id) st._id = col.doc().id; agora.add(st._id); if (!antes.has(st._id)) { antes.add(st._id); novos.push(st); } }
        for (const id of [...antes]) if (!agora.has(id)) { antes.delete(id); saiu.push(id); }
        novos.forEach(st => p2pMandar({ t: "add", pag: pg, s: st, k: st._k ? E.uid + ":" + st._k : undefined }));
        if (saiu.length) p2pMandar({ t: "del", pag: pg, ids: saiu });
        novos.forEach(st => gravar.push(col.doc(st._id).set({ pag: pg, s: semId(st), autor: E.uid, em: Date.now() })));
        saiu.forEach(id => gravar.push(col.doc(id).delete().catch(() => {})));
      }
      await Promise.all(gravar);
      V.salvoEm = Date.now();
    } catch (e) { console.warn("salvar traços", e); APP.toast("Não foi possível salvar no arquivo conjunto. Confira a internet."); sujas.forEach(p => V.sujas.add(p)); }
    status();
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

  function transmitirPublico() { if (V.ov) transmitir(); }
  function sairDaAba() { if (V.ov) fecharLeitor(); document.querySelectorAll(".est-pop").forEach(x => x.remove()); }
  (window.LAComp = window.LAComp || {}).Estante = { render, renderComp: (c, app) => render(c, app, "comp"), verComp: () => { E.irComp = true; }, iniciar, estadoConvite, aceitarConvite, recusarConvite,
    importar: async f => { if (!E.meta) { try { await carregarMeta(); } catch (e) { E.meta = { categorias: [], arquivos: [], atual: 0 }; } } return importarPacote(f); },
    sairDaAba, transmitir: transmitirPublico, vista: cv => vista(cv, false), _estado: () => ({ V, E }) };   // _estado: usado pelos testes
})();
