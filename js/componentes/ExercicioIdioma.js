/* ExercicioIdioma — mostra e corrige UM exercício de idioma (usado nas aulas e no nivelamento).
   Tipos (formato em idiomas/FORMATO.md):
     mc     marcar a alternativa
     gap    escrever a palavra que falta
     order  montar a frase clicando nas palavras
     speak  falar no idioma da aula (reconhecimento de voz do navegador); "repetir" uma frase ou "responder" uma pergunta
   Uso: LAComp.Exercicio.render(el, ex, { app, aoResultado(ok, info), aoContinuar(), rotuloContinuar, dica })
   dica (opcional): async (ex, { respondido, ok, info }) => { contexto, caminho: [], porque, erro } — mostra o botão
   "Dica da IA" (antes de responder: caminho sem a resposta; depois: explica a resposta e o erro).
   Também exporta: falar(texto), pararFala(), vozDisponivel(), reconhecimentoDisponivel() e
   idioma("fr-FR") para trocar a voz e o microfone (padrão: inglês britânico). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s || "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9à-ÿœæ' -]/g, " ").replace(/\s+/g, " ").trim();
  const palavras = s => norm(s).split(" ").filter(Boolean);
  // "ecole" = "école": usado para aceitar resposta sem acento (com aviso) e na fala
  const semAcento = s => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
  let LINGUA = "en-GB";
  const NOME_LINGUA = { en: "inglês", fr: "francês", es: "espanhol", de: "alemão", it: "italiano" };
  function idioma(lang) { if (lang && lang !== LINGUA) { LINGUA = lang; vozEn = null; escolherVoz(); } return LINGUA; }

  /* ---------- voz (texto → fala) ---------- */
  let vozEn = null;
  function escolherVoz() {
    if (!("speechSynthesis" in window)) return null;
    const [lg, reg] = LINGUA.split("-"), vs = speechSynthesis.getVoices().filter(v => new RegExp("^" + lg + "[-_]", "i").test(v.lang));
    const daRegiao = v => new RegExp(reg + "$", "i").test(v.lang.replace("_", "-"));
    vozEn = vs.find(v => daRegiao(v) && /Google|Natural|Online/i.test(v.name)) || vs.find(daRegiao) || (lg === "en" && vs.find(v => /US/i.test(v.lang))) || vs[0] || null;
    return vozEn;
  }
  if ("speechSynthesis" in window) { escolherVoz(); speechSynthesis.onvoiceschanged = escolherVoz; }
  const vozDisponivel = () => "speechSynthesis" in window;
  function pararFala() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }
  // fala um texto ou uma lista de falas [{p,t}] alternando o tom por pessoa; devolve Promise que termina no fim
  function falar(conteudo, op = {}) {
    return new Promise(ok => {
      if (!vozDisponivel()) return ok(false);
      pararFala();
      const v = vozEn || escolherVoz(), falas = Array.isArray(conteudo) ? conteudo : [{ p: "A", t: conteudo }];
      const pessoas = [...new Set(falas.map(f => f.p))];
      falas.forEach((f, i) => {
        const u = new SpeechSynthesisUtterance(f.t);
        u.lang = (v && v.lang) || LINGUA; if (v) u.voice = v;
        u.rate = op.rate || 0.95; u.pitch = [1.05, 0.8, 1.3][pessoas.indexOf(f.p) % 3];
        if (i === falas.length - 1) { u.onend = () => ok(true); u.onerror = () => ok(false); }
        speechSynthesis.speak(u);
      });
    });
  }

  /* ---------- reconhecimento de voz (fala → texto) ---------- */
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const reconhecimentoDisponivel = () => !!Rec;
  function ouvir(aoParcial) {
    return new Promise((ok, no) => {
      const r = new Rec(); r.lang = LINGUA; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
      let finais = [], parcial = "";
      r.onresult = e => {
        parcial = ""; finais = [];
        for (const res of e.results) { if (res.isFinal) finais.push([...res].map(a => a.transcript)); else parcial += res[0].transcript; }
        if (aoParcial) aoParcial(finais.map(f => f[0]).join(" ") + " " + parcial);
      };
      r.onerror = e => no(e.error || "erro");
      r.onend = () => {
        // junta as alternativas de cada trecho final (até 3 combinações)
        const alts = [0, 1, 2].map(k => finais.map(f => f[Math.min(k, f.length - 1)]).join(" ").trim()).filter(Boolean);
        if (!alts.length && parcial.trim()) alts.push(parcial.trim());
        ok({ texto: alts[0] || "", alternativas: [...new Set(alts)], parar: () => {} });
      };
      try { r.start(); } catch (e) { no("ocupado"); }
      ouvir.atual = r;
    });
  }
  // parte da frase-alvo que a pessoa disse (maior sequência de palavras em comum)
  function semelhanca(alvo, dito) {
    const a = palavras(alvo), b = palavras(dito); if (!a.length) return 0;
    const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      m[i][j] = a[i - 1] === b[j - 1] || semAcento(a[i - 1]).replace(/'/g, "") === semAcento(b[j - 1]).replace(/'/g, "") ? m[i - 1][j - 1] + 1 : Math.max(m[i - 1][j], m[i][j - 1]);
    return m[a.length][b.length] / a.length;
  }
  function avaliarFala(ex, alternativas) {
    if (ex.modo === "responder") {
      const melhor = alternativas.map(t => { const ws = palavras(t), txt = " " + semAcento(ws.join(" ")) + " ";
        const chave = !(ex.chave || []).length || ex.chave.some(c => txt.includes(" " + semAcento(c)) || txt.includes(semAcento(c) + " "));
        return { t, n: ws.length, chave, ok: ws.length >= (ex.min || 3) && chave }; }).sort((x, y) => (y.ok - x.ok) || (y.n - x.n))[0];
      return melhor || { t: "", n: 0, ok: false };
    }
    const melhor = alternativas.map(t => ({ t, s: semelhanca(ex.frase, t) })).sort((x, y) => y.s - x.s)[0] || { t: "", s: 0 };
    return { ...melhor, ok: melhor.s >= 0.7 };
  }

  /* ---------- correção de texto ---------- */
  // certo / certo mas sem o acento (vale, com aviso) / errado
  const confereGap = (ex, v) => (ex.resp || []).some(r => norm(r) === norm(v)) ? "ok" : (ex.resp || []).some(r => semAcento(r) === semAcento(v)) ? "acento" : "";
  const confereOrder = (ex, frase) => [ex.resp].concat(ex.alt || []).some(r => norm(r) === norm(frase));
  const embaralhar = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b.join(" ") === a.join(" ") && a.length > 2 ? embaralhar(a) : b; };

  const ROTULO = { mc: "Marque", gap: "Escreva", order: "Monte a frase", speak: "Fale" };
  const ICONE = { mc: "☑", gap: "✎", order: "⇄", speak: "🎙" };

  function render(el, ex, op = {}) {
    pararFala();
    const app = op.app || {}, tipo = ex.t;
    let respondido = false;
    const ouvirBtn = ex.ouvir ? `<button type="button" class="btn sm ex-ouvir" data-ex="ouvir">▶ Ouvir</button>` : "";
    const dicaBtn = op.dica ? `<button type="button" class="btn sm ex-dica" data-ex="dica" title="A IA explica o assunto e o caminho até a resposta">💡 Dica da IA</button>` : "";
    let ultimo = { respondido: false };
    let corpo = "";
    // as alternativas aparecem em ordem sorteada (a certa não fica sempre na mesma letra)
    const ordem = tipo === "mc" ? embaralhar(ex.op.map((_, k) => k)) : [];
    if (tipo === "mc") corpo = `<p class="ex-q">${fmtQ(ex.q)}</p><div class="ex-ops">${ordem.map((k, pos) => `<button type="button" class="opt ex-op" data-op="${k}"><b>${"ABCD"[pos]}</b><span>${esc(ex.op[k])}</span></button>`).join("")}</div>`;
    else if (tipo === "gap") corpo = `<p class="ex-q">${esc(ex.q).replace("___", `<input class="ex-gap" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Resposta">`)}</p>${ex.dica ? `<p class="small muted">Dica: <b>${esc(ex.dica)}</b></p>` : ""}`;
    else if (tipo === "order") corpo = `${ex.q ? `<p class="ex-q">${esc(ex.q)}</p>` : `<p class="ex-q">Toque nas palavras na ordem certa.</p>`}<div class="ex-linha" data-linha aria-live="polite"></div><div class="ex-chips" data-chips>${embaralhar(ex.palavras).map((w, i) => `<button type="button" class="ex-chip" data-w="${i}">${esc(w)}</button>`).join("")}</div>`;
    else if (tipo === "speak") corpo = `<p class="ex-q">${esc(ex.q)}</p><div class="ex-fala">${ex.modo === "repetir" ? `<p class="ex-alvo">“${esc(ex.frase)}”</p>` : `<p class="ex-alvo">${esc(ex.frase)}</p>`}
        <button type="button" class="btn sm" data-ex="modelo">▶ ${ex.modo === "repetir" ? "Ouvir a pronúncia" : "Ouvir a pergunta"}</button></div>
        <div class="ex-mic"><button type="button" class="btn primary ex-mic-b" data-ex="mic">🎙 Toque e fale</button><span class="small muted" data-ouvindo></span></div>`;
    el.innerHTML = `<div class="ex" data-tipo="${tipo}">
      <div class="ex-tipo"><span>${ICONE[tipo]}</span>${ROTULO[tipo]}<span class="ex-tipo-acoes">${dicaBtn}${ouvirBtn}</span></div>
      ${corpo}
      <div class="ex-ia" hidden aria-live="polite"></div>
      <div class="ex-fb" hidden></div>
      <div class="row ex-acoes">${tipo === "gap" || tipo === "order" ? `<button type="button" class="btn primary" data-ex="verificar">Verificar</button>` : ""}
        ${tipo === "speak" ? `<button type="button" class="btn ghost sm" data-ex="pular-fala">Não posso falar agora</button>` : ""}
        <button type="button" class="btn primary" data-ex="continuar" hidden>${esc(op.rotuloContinuar || "Continuar")}</button></div></div>`;
    const $ = s => el.querySelector(s), fb = $(".ex-fb");

    function concluir(ok, info = {}) {
      if (respondido) return; respondido = true;
      pararFala();
      const certa = tipo === "mc" ? `${"ABCD"[ordem.indexOf(ex.r)]}) ${ex.op[ex.r]}` : tipo === "gap" ? ex.resp[0] : tipo === "order" ? ex.resp : ex.modo === "repetir" ? ex.frase : ex.modelo;
      fb.hidden = false; fb.className = "ex-fb " + (info.pulado ? "pulado" : ok ? "ok" : "no");
      fb.innerHTML = `<b>${info.pulado ? "Fala pulada" : ok ? "✓ Correto!" : "✗ Ainda não"}</b>
        ${info.acento ? `<p class="small">⚠️ Atenção ao acento: o certo é <b>${esc(ex.resp.find(r => semAcento(r) === semAcento(info.texto)) || certa)}</b>. Na prova, o acento conta.</p>` : ""}
        ${info.ouvido != null ? `<p class="small">A gente ouviu: <i>“${esc(info.ouvido || "…")}”</i>${info.s != null ? ` · ${Math.round(info.s * 100)}% da frase` : ""}</p>` : ""}
        ${!ok || tipo === "speak" ? `<p class="small">${tipo === "speak" && ex.modo === "responder" ? "Exemplo de resposta" : "Resposta"}: <b>${esc(certa)}</b></p>` : ""}
        ${ex.exp ? `<p class="small muted">${esc(ex.exp)}</p>` : ""}`;
      el.querySelectorAll("input,.ex-op,.ex-chip,[data-ex=verificar],[data-ex=mic],[data-ex=pular-fala]").forEach(x => { x.disabled = true; });
      const c = $('[data-ex="continuar"]'); c.hidden = false; setTimeout(() => c.focus({ preventScroll: true }), 30);
      ultimo = { respondido: true, ok, info };
      const db = $('[data-ex="dica"]'); if (db) db.textContent = "💡 Entender com a IA";
      if (op.aoResultado) op.aoResultado(ok, info);
    }
    // dica da IA: antes de responder mostra o caminho (sem a resposta); depois explica a resposta
    if (op.dica) {
      const cache = {};
      $('[data-ex="dica"]').onclick = async () => {
        const box = $(".ex-ia"), fase = ultimo.respondido ? "depois" : "antes", b = $('[data-ex="dica"]');
        if (!box.hidden && box.dataset.fase === fase) { box.hidden = true; return; }
        box.hidden = false; box.dataset.fase = fase; if (fase === "depois") box.dataset.depois = "1";
        if (cache[fase]) { box.innerHTML = cache[fase]; return; }
        box.innerHTML = `<div class="row" style="gap:8px"><span class="spinner"></span><span class="small muted">A IA está preparando ${fase === "antes" ? "uma dica (sem entregar a resposta)" : "a explicação"}…</span></div>`;
        b.disabled = true;
        try {
          const r = await op.dica(ex, ultimo);
          const txt = x => esc(String(x || "")).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
          cache[fase] = `<div class="ex-ia-t">💡 ${fase === "antes" ? "Dica da IA" : "Explicação da IA"}</div>
            ${r.contexto ? `<p><b>📚 O que você está estudando:</b> ${txt(r.contexto)}</p>` : ""}
            ${(r.caminho || []).length ? `<p><b>🧭 Como chegar na resposta:</b></p><ol>${r.caminho.map(x => `<li>${txt(x)}</li>`).join("")}</ol>` : ""}
            ${r.porque ? `<p><b>🤔 Por quê:</b> ${txt(r.porque)}</p>` : ""}
            ${r.erro ? `<p><b>✏️ Sobre a sua resposta:</b> ${txt(r.erro)}</p>` : ""}`;
          if (box.dataset.fase === fase) box.innerHTML = cache[fase];
        } catch (e) {
          box.innerHTML = `<p class="small muted">${esc((e && e.msg) || "A IA não conseguiu responder agora. Tente de novo daqui a pouco.")}</p>`;
        } finally { b.disabled = false; }
      };
    }

    // marcar
    if (tipo === "mc") el.querySelectorAll(".ex-op").forEach(b => b.onclick = () => {
      const k = +b.dataset.op, ok = k === ex.r;
      b.classList.add(ok ? "certa" : "errada"); if (!ok) el.querySelector(`.ex-op[data-op="${ex.r}"]`).classList.add("certa");
      concluir(ok, { escolha: k });
    });
    // escrever
    if (tipo === "gap") {
      const inp = $(".ex-gap");
      const verif = () => { if (!inp.value.trim()) { inp.focus(); return; } const c = confereGap(ex, inp.value), ok = !!c; inp.classList.add(ok ? "ok" : "no"); concluir(ok, { texto: inp.value, acento: c === "acento" }); };
      $('[data-ex="verificar"]').onclick = verif;
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (!respondido) verif(); else $('[data-ex="continuar"]').click(); } });
      setTimeout(() => inp.focus({ preventScroll: true }), 50);
    }
    // montar a frase
    if (tipo === "order") {
      const linha = $("[data-linha]"), chips = $("[data-chips]");
      el.addEventListener("click", e => {
        const c = e.target.closest(".ex-chip"); if (!c || respondido) return;
        (c.parentNode === chips ? linha : chips).appendChild(c);
      });
      $('[data-ex="verificar"]').onclick = () => {
        const frase = [...linha.querySelectorAll(".ex-chip")].map(c => c.textContent).join(" ");
        if (!frase) return;
        const ok = confereOrder(ex, frase); linha.classList.add(ok ? "ok" : "no"); concluir(ok, { texto: frase });
      };
    }
    // falar
    if (tipo === "speak") {
      const mic = $('[data-ex="mic"]'), st = $("[data-ouvindo]");
      $('[data-ex="modelo"]').onclick = () => falar(ex.frase, { rate: 0.9 });
      if (!reconhecimentoDisponivel()) {
        mic.textContent = "Falei em voz alta ✓"; st.textContent = "Seu navegador não reconhece voz (use o Chrome ou o Edge para ser corrigido). Ouça, fale em voz alta e toque no botão.";
        mic.onclick = () => concluir(true, { semReconhecimento: true });
      } else mic.onclick = async () => {
        if (mic.dataset.ouvindo) { try { ouvir.atual && ouvir.atual.stop(); } catch (e) {} return; }
        pararFala(); mic.dataset.ouvindo = "1"; mic.textContent = "■ Parar"; mic.classList.add("gravando"); st.textContent = `Ouvindo… fale agora em ${NOME_LINGUA[LINGUA.slice(0, 2)] || "voz alta"}.`;
        try {
          const r = await ouvir(t => { st.textContent = "“" + t.trim() + "”"; });
          delete mic.dataset.ouvindo; mic.classList.remove("gravando"); mic.textContent = "🎙 Tentar de novo";
          if (!r.alternativas.length) { st.textContent = "Não ouvi nada. Fale mais perto do microfone e tente de novo."; return; }
          const av = avaliarFala(ex, r.alternativas);
          if (av.ok || mic.dataset.tentativas === "1") concluir(av.ok, { ouvido: av.t, s: av.s });
          else { mic.dataset.tentativas = "1"; st.innerHTML = `Ouvi: <i>“${esc(av.t)}”</i>. ${ex.modo === "repetir" ? `Bateu ${Math.round((av.s || 0) * 100)}% da frase.` : "Responda com uma frase mais completa."} Tente mais uma vez.`; }
        } catch (e) {
          delete mic.dataset.ouvindo; mic.classList.remove("gravando"); mic.textContent = "🎙 Toque e fale";
          st.textContent = e === "not-allowed" || e === "service-not-allowed" ? "Permita o microfone para fazer os exercícios de fala." : e === "no-speech" ? "Não ouvi nada. Tente de novo." : "Não consegui ouvir agora. Tente de novo.";
        }
      };
      $('[data-ex="pular-fala"]').onclick = () => concluir(false, { pulado: true });
    }
    const ob = $('[data-ex="ouvir"]'); if (ob) ob.onclick = () => falar(ex.ouvir, { rate: 0.92 });
    $('[data-ex="continuar"]').onclick = () => { pararFala(); if (op.aoContinuar) op.aoContinuar(); };
    if (ex.ouvir && op.autoOuvir !== false) setTimeout(() => { if (!respondido) falar(ex.ouvir, { rate: 0.92 }); }, 350);
  }
  const fmtQ = q => esc(q).replace("___", '<span class="cbt-gap">_____</span>');

  (window.LAComp = window.LAComp || {}).Exercicio = { render, falar, pararFala, vozDisponivel, reconhecimentoDisponivel, semelhanca, norm, semAcento, idioma };
})();
