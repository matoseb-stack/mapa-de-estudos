/* IdiomasView — aba "Idiomas" (primeiro idioma: Inglês, protocolo Cambridge).
   - Na primeira visita pergunta se a pessoa quer o teste de nivelamento (CambridgeTestView).
   - Aulas por competência: Reading & Use of English, Writing, Listening, Speaking.
   - "Adicionar à semana" agenda o módulo no plano principal (app.adicionarBlocoNaSemana).
   - XP de idiomas: acertos nos exercícios + tempo de cronômetro em "Inglês" (app chama IdiomasView.xpPorTempo).
   Uso: LAComp.IdiomasView.render(container, app)
   O objeto app (criado no index.html) dá acesso a: uid, esc, ico, pageHead, toast, diasSemana,
   adicionarBlocoNaSemana, estudarComCronometro. */
(function () {
  "use strict";
  const XP = { acerto: 10, writing: 30, speaking: 20, porMinuto: 1 };
  const MATERIA = "Inglês";
  const E = { nivelVer: null, aula: null, perguntou: false, perfil: null, nivel: null, gravacao: null };

  const Srv = () => window.LAService || window.FirebaseServiceMock;   // nuvem com conta; simulado só no modo visitante
  const IN = () => window.LA_INGLES;
  const chaveMod = (nivel, comp) => `ingles:${nivel}:${comp}`;

  async function render(container, app) {
    container.onclick = null;
    if (E.uid !== app.uid()) Object.assign(E, { uid: app.uid(), nivelVer: null, aula: null, perguntou: false, perfil: null, nivel: null });   // trocou de conta
    container.innerHTML = `<div class="page">${app.pageHead("Idiomas", "Prepare-se para os exames Cambridge com aulas no formato da prova.")}<div class="card row muted"><span class="spinner"></span>Carregando seu perfil de idiomas…</div></div>`;
    let nivel, perfil;
    try { [nivel, perfil] = await Promise.all([Srv().getUserLevel(app.uid(), "ingles"), Srv().getLanguageProfile(app.uid())]); }
    catch (e) { container.innerHTML = `<div class="page">${app.pageHead("Idiomas")}<div class="card"><p>Não foi possível carregar agora. Tente de novo.</p></div></div>`; return; }
    if (!app.naTela()) return;                                   // a pessoa já saiu da aba enquanto carregava
    E.nivel = nivel; E.perfil = perfil;
    if (!E.nivelVer) E.nivelVer = (nivel && nivel.nivel) || "A1";
    if (E.aula) { abrirAula(container, app, E.aula.comp); return; }
    pintarInicio(container, app);
    if (!nivel && !E.perguntou) { E.perguntou = true; perguntarNivelamento(container, app); }
  }

  function perguntarNivelamento(container, app) {
    const esc = app.esc, bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="idm-t">
      <span class="eyebrow">Inglês · Cambridge</span><h3 id="idm-t">Quer fazer um teste de nivelamento rápido?</h3>
      <p class="muted small">São 18 questões (uns 5 minutos) para descobrir seu nível de A1 a C2. As aulas se ajustam ao resultado.</p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" data-idm="nao">Agora não</button><button class="btn primary" type="button" data-idm="sim">Fazer o teste</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => {
      const b = e.target.closest("[data-idm]"); if (!b && e.target !== bg) return;
      bg.remove();
      if (b && b.dataset.idm === "sim") iniciarTeste(container, app);
      else app.toast("Tudo bem! Você pode fazer o nivelamento quando quiser, no topo da aba.");
    });
    setTimeout(() => { const b = bg.querySelector('[data-idm="sim"]'); if (b) b.focus(); }, 60);
  }
  function iniciarTeste(container, app) {
    window.LAComp.CambridgeTestView.abrir(container, {
      app,
      aoConcluir: reg => { E.nivel = reg; E.nivelVer = reg.nivel; render(container, app); },
      aoCancelar: () => render(container, app)
    });
  }

  function pintarInicio(container, app) {
    const { esc, ico } = app, I = IN(), nv = E.nivelVer, perfil = E.perfil || { xp: 0, concluidos: {} };
    const meu = E.nivel && E.nivel.nivel;
    container.innerHTML = `<div class="page idiomas">
      ${app.pageHead("Idiomas", "Prepare-se para os exames Cambridge com aulas no formato da prova.", `<button class="btn" type="button" data-id="nivelamento">${ico("chart")}${meu ? "Refazer nivelamento" : "Fazer nivelamento"}</button>`)}
      <div class="idm-linguas" role="tablist" aria-label="Idioma">
        <button type="button" class="pill solid" role="tab" aria-selected="true">🇬🇧 Inglês</button>
        <button type="button" class="pill" disabled title="Em breve">🇪🇸 Espanhol · em breve</button>
        <button type="button" class="pill" disabled title="Em breve">🇫🇷 Francês · em breve</button>
      </div>
      <div class="idm-resumo">
        <div class="stat"><div class="eyebrow">Seu nível</div><div class="v">${meu ? esc(meu) : "—"}</div><div class="s">${meu ? esc(I.EXAME[meu]) : "Faça o nivelamento"}</div></div>
        <div class="stat"><div class="eyebrow">XP de idiomas</div><div class="v">${perfil.xp}</div><div class="s">acertos + tempo estudado</div></div>
        <div class="stat"><div class="eyebrow">Módulos concluídos</div><div class="v">${Object.keys(perfil.concluidos || {}).length}</div><div class="s">de ${I.NIVEIS.length * I.COMPETENCIAS.length}</div></div>
      </div>
      ${meu ? "" : `<div class="card flat idm-aviso"><span>${ico("bolt")}Descubra seu nível em 5 minutos para receber aulas na medida certa.</span><button class="btn sm primary" type="button" data-id="nivelamento">Fazer o teste</button></div>`}
      <div class="idm-niveis" role="group" aria-label="Nível das aulas"><span class="small muted">Aulas do nível</span>${I.NIVEIS.map(n => `<button type="button" class="qb-chip ${n === nv ? "on" : ""}" data-id-nivel="${n}" aria-pressed="${n === nv}">${n}${n === meu ? " ★" : ""}</button>`).join("")}</div>
      <p class="small muted" style="margin:0 0 12px">${esc(I.EXAME[nv])}</p>
      <div class="idm-grade">${I.COMPETENCIAS.map(c => { const feito = (perfil.concluidos || {})[chaveMod(nv, c.k)];
        return `<div class="card idm-card"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h3 style="margin:0">${esc(c.nome)}</h3>${feito ? `<span class="qb-st qb-resolvida ok">✓ Concluído</span>` : ""}</div>
          <p class="small muted">${esc(c.desc)}</p><p class="small"><b>${esc(nv)} · ${esc(c.nome.split(" ")[0])}</b> · cerca de ${c.min} min</p>
          <div class="row" style="gap:8px"><button class="btn primary sm" type="button" data-id-aula="${c.k}">${ico("play")}${feito ? "Refazer" : "Começar"}</button>
          <button class="btn sm" type="button" data-id-semana="${c.k}">${ico("cal")}Adicionar à semana</button></div></div>`; }).join("")}</div>
      ${perfil.historico && perfil.historico.length ? `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Últimos XP de idiomas</h3></div><div class="list">${perfil.historico.slice(0, 6).map(h => `<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><span class="small">${esc(h.motivo)}</span><b class="small">+${h.xp} XP</b></div>`).join("")}</div></div>` : ""}
      <div data-envios></div>
      <p class="hint" style="margin-top:12px">Formato inspirado nos exames Cambridge English (Key, Preliminary, First, Advanced e Proficiency). Conteúdo próprio do Logic Academy, sem vínculo com a Cambridge University Press & Assessment.</p>
    </div>`;
    pintarEnvios(container, app);
    container.onclick = e => {
      if (e.target.closest("[data-envios]")) return;
      const nb = e.target.closest("[data-id-nivel]"); if (nb) { E.nivelVer = nb.dataset.idNivel; pintarInicio(container, app); return; }
      const a = e.target.closest("[data-id-aula]"); if (a) { E.aula = { comp: a.dataset.idAula }; abrirAula(container, app, a.dataset.idAula); return; }
      const s = e.target.closest("[data-id-semana]"); if (s) { modalSemana(container, app, s.dataset.idSemana); return; }
      if (e.target.closest('[data-id="nivelamento"]')) iniciarTeste(container, app);
    };
  }

  /* ---------- Adicionar à semana ---------- */
  function modalSemana(container, app, comp) {
    const { esc } = app, I = IN(), c = I.COMPETENCIAS.find(x => x.k === comp), nv = E.nivelVer, rotulo = `${c.nome.split(" ")[0]} - ${nv}`;
    const dias = app.diasSemana(), bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<form class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="ids-t">
      <span class="eyebrow">Adicionar à semana</span><h3 id="ids-t">${esc(rotulo)}</h3>
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
        await Srv().addLanguageTaskToWeek(app.uid(), { idioma: "ingles", modulo: chaveMod(nv, comp), rotulo, dia, inicio, min });
        const r = app.adicionarBlocoNaSemana({ dia, inicio, min, materia: MATERIA, tarefa: `${rotulo} (Cambridge)`, tipo: "exercícios" });
        bg.remove(); app.toast(r.msg);
      } catch (err) { bt.disabled = false; bt.textContent = "Adicionar"; app.toast("Não foi possível adicionar agora. Tente de novo."); }
    };
  }

  /* ---------- Aulas ---------- */
  function cabecalhoAula(app, titulo, comp) {
    const { esc, ico } = app;
    return `<div class="row idm-aula-topo"><button class="btn ghost sm" type="button" data-aula="voltar">${ico("back")}Idiomas</button>
      <span class="pill solid">${esc(E.nivelVer)}</span><span class="pill">${esc(titulo)}</span>
      <button class="btn sm" type="button" data-aula="crono" style="margin-left:auto" title="Conta o tempo como Inglês e vale XP">${ico("watch")}Estudar com cronômetro</button></div>`;
  }
  function abrirAula(container, app, comp) {
    const I = IN(), mod = I.MODULOS[I.FAIXA[E.nivelVer]], { esc } = app;
    const sair = () => { E.aula = null; pararFala(); pararGravacao(); pintarInicio(container, app); scrollTo(0, 0); };
    let html = "";
    if (comp === "reading") html = aulaReading(app, mod);
    else if (comp === "writing") html = aulaWriting(app, mod);
    else if (comp === "listening") html = aulaListening(app, mod);
    else html = aulaSpeaking(app, mod);
    container.innerHTML = `<div class="page idiomas" style="max-width:860px">${cabecalhoAula(app, I.COMPETENCIAS.find(c => c.k === comp).nome, comp)}${html}</div>`;
    container.onclick = e => {
      const b = e.target.closest("[data-aula]"); if (!b) return;
      if (b.dataset.aula === "voltar") sair();
      else if (b.dataset.aula === "crono") app.estudarComCronometro(MATERIA, `${comp} - ${E.nivelVer}`);
    };
    ligarAula(container, app, comp, mod);
  }
  const mcq = (app, prefixo, lista) => lista.map((p, i) => `<fieldset class="idm-q" data-q="${prefixo}${i}"><legend>${i + 1}. ${app.esc(p.q).replace("___", '<span class="cbt-gap">_____</span>')}</legend>
    ${p.op.map((o, k) => `<label class="idm-op"><input type="radio" name="${prefixo}${i}" value="${k}"><span>${"ABCD"[k]}) ${app.esc(o)}</span></label>`).join("")}<div class="idm-fb small" hidden></div></fieldset>`).join("");

  function aulaReading(app, mod) {
    const r = mod.reading, u = mod.uso, esc = app.esc;
    return `<div class="card stack"><span class="eyebrow">Reading</span><h2 style="margin:0">${esc(r.titulo)}</h2><div class="idm-texto">${esc(r.texto).replace(/\n/g, "<br>")}</div>${mcq(app, "r", r.perguntas)}</div>
      <div class="card stack" style="margin-top:14px"><span class="eyebrow">Use of English</span><h3 style="margin:0">${esc(u.titulo)}</h3>${mcq(app, "u", u.itens)}</div>
      <div class="row idm-acoes"><button class="btn primary" type="button" data-corrigir>Corrigir e ganhar XP</button><span class="small muted" data-res></span></div>`;
  }
  function aulaListening(app, mod) {
    const l = mod.listening, esc = app.esc, tts = "speechSynthesis" in window;
    return `<div class="card stack"><span class="eyebrow">Listening</span><h2 style="margin:0">${esc(l.titulo)}</h2>
      <div class="idm-player">${l.audio ? `<audio controls src="${esc(l.audio)}" preload="none"></audio>` : tts ? `<button class="btn primary" type="button" data-ouvir>▶ Ouvir o áudio</button><label class="small row" style="gap:6px">Velocidade <select data-vel><option value="0.8">Devagar</option><option value="0.95" selected>Normal</option><option value="1.1">Rápida</option></select></label><span class="small muted">Você pode ouvir duas vezes, como na prova.</span>` : `<p class="small muted">Seu navegador não reproduz a voz. Leia a transcrição abaixo.</p>`}</div>
      ${mcq(app, "l", l.perguntas)}
      ${(l.lacunas || []).map((g, i) => `<div class="idm-q" data-g="${i}"><label>${l.perguntas.length + i + 1}. ${esc(g.frase).replace("___", `<input class="idm-gap" type="text" data-gap="${i}" aria-label="Lacuna ${i + 1}" autocomplete="off">`)}</label><div class="idm-fb small" hidden></div></div>`).join("")}
      <details class="idm-trans" ${tts || l.audio ? "" : "open"}><summary>Transcrição</summary><p>${esc(l.transcricao).replace(/\n/g, "<br>")}</p></details></div>
      <div class="row idm-acoes"><button class="btn primary" type="button" data-corrigir>Corrigir e ganhar XP</button><span class="small muted" data-res></span></div>`;
  }
  function aulaWriting(app, mod) {
    const w = mod.writing, esc = app.esc;
    return `<div class="card stack"><span class="eyebrow">Writing · ${esc(w.genero)}</span><div class="idm-texto">${esc(w.prompt).replace(/\n/g, "<br>")}</div>
      <textarea class="idm-editor" rows="12" spellcheck="true" lang="en" placeholder="Write your answer here…" aria-label="Sua redação em inglês"></textarea>
      <div class="row" style="justify-content:space-between"><span class="small muted" data-contador>0 palavras · meta ${w.min}–${w.max}</span>
      <button class="btn primary" type="button" data-enviar-w>Enviar para o Mentor</button></div><div data-previa></div></div>`;
  }
  function aulaSpeaking(app, mod) {
    const s = mod.speaking, esc = app.esc, pode = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    return `<div class="card stack"><span class="eyebrow">Speaking</span><div class="idm-texto">${esc(s.prompt)}</div>
      <ul class="small muted">${s.dicas.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
      ${pode ? `<div class="idm-rec"><button class="btn primary" type="button" data-rec>🎙️ Gravar resposta</button><span class="mono" data-rec-t>0:00 / ${Math.floor(s.segundos / 60)}:${String(s.segundos % 60).padStart(2, "0")}</span></div>
      <audio controls hidden data-rec-audio></audio>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-enviar-s disabled>Enviar para o Mentor</button></div><div data-previa></div>`
      : `<p class="small muted">Seu navegador não permite gravar áudio. Tente no Chrome, Edge ou Firefox, ou pratique em voz alta cronometrando ${s.segundos} segundos.</p>`}</div>`;
  }

  async function darXP(app, xp, motivo, chave, resultado) {
    if (!xp) return 0;
    const r = await Srv().addLanguageXP(app.uid(), xp, motivo);
    if (chave) await Srv().markModuleDone(app.uid(), chave, resultado || {});
    E.perfil = await Srv().getLanguageProfile(app.uid());
    return r.ganho;
  }
  function ligarAula(container, app, comp, mod) {
    const nv = E.nivelVer, chave = chaveMod(nv, comp), $ = s => container.querySelector(s), $$ = s => [...container.querySelectorAll(s)];
    const corrigir = $("[data-corrigir]");
    if (corrigir) corrigir.onclick = async () => {
      const grupos = comp === "reading" ? [["r", mod.reading.perguntas], ["u", mod.uso.itens]] : [["l", mod.listening.perguntas]];
      let ok = 0, total = 0;
      grupos.forEach(([pref, lista]) => lista.forEach((p, i) => {
        total++; const fs = $(`[data-q="${pref}${i}"]`), marc = fs.querySelector("input:checked"), fb = fs.querySelector(".idm-fb"), certo = marc && +marc.value === p.r;
        if (certo) ok++;
        fs.classList.toggle("ok", !!certo); fs.classList.toggle("no", !certo);
        fb.hidden = false; fb.textContent = certo ? "✓ Correct!" : `✗ Resposta: ${"ABCD"[p.r]}) ${p.op[p.r]}`;
      }));
      if (comp === "listening") (mod.listening.lacunas || []).forEach((g, i) => {
        total++; const inp = $(`[data-gap="${i}"]`), val = (inp.value || "").trim().toLowerCase(), certo = g.resp.some(r => r.toLowerCase() === val), fb = $(`[data-g="${i}"] .idm-fb`);
        if (certo) ok++; inp.classList.toggle("ok", certo); inp.classList.toggle("no", !certo); fb.hidden = false; fb.textContent = certo ? "✓ Correct!" : `✗ Resposta: ${g.resp[0]}`;
      });
      corrigir.disabled = true; corrigir.textContent = "Corrigido";
      const t = container.querySelector(".idm-trans"); if (t) t.open = true;
      const ganho = await darXP(app, ok * XP.acerto, `${comp === "reading" ? "Reading & Use of English" : "Listening"} ${nv}: ${ok}/${total}`, chave, { ok, total });
      const res = $("[data-res]"); if (res) res.innerHTML = `Você acertou <b>${ok} de ${total}</b>${ganho ? ` · <b>+${ganho} XP</b>` : ""}.`;
      app.toast(ok === total ? "Perfeito! Todas certas." : `Você acertou ${ok} de ${total}.`);
    };
    // listening: voz do navegador (en-GB) lendo a transcrição, alternando o tom por pessoa
    const ouvir = $("[data-ouvir]");
    if (ouvir) ouvir.onclick = () => {
      if (speechSynthesis.speaking) { pararFala(); ouvir.textContent = "▶ Ouvir o áudio"; return; }
      const vel = +($("[data-vel]").value || 0.95), vozes = speechSynthesis.getVoices().filter(v => /^en(-|_)/i.test(v.lang));
      const voz = vozes.find(v => /GB/i.test(v.lang)) || vozes[0];
      const falas = mod.listening.transcricao.split("\n").map(l => l.replace(/^[A-Z][\w .]{0,20}:\s*/, "")).filter(Boolean);
      falas.forEach((f, i) => { const u = new SpeechSynthesisUtterance(f); u.lang = (voz && voz.lang) || "en-GB"; if (voz) u.voice = voz; u.rate = vel; u.pitch = i % 2 ? 0.85 : 1.1;
        if (i === falas.length - 1) u.onend = () => { ouvir.textContent = "▶ Ouvir de novo"; }; speechSynthesis.speak(u); });
      ouvir.textContent = "■ Parar";
    };
    // writing
    const ed = $(".idm-editor");
    if (ed) {
      const w = mod.writing, cont = $("[data-contador]"), conta = () => (ed.value.match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;
      ed.oninput = () => { const n = conta(); cont.textContent = `${n} palavras · meta ${w.min}–${w.max}`; cont.classList.toggle("txt-on", n >= w.min && n <= w.max); };
      $("[data-enviar-w]").onclick = async ev => {
        const n = conta(); if (n < Math.min(15, w.min)) { app.toast("Escreva um pouco mais antes de enviar."); return; }
        const b = ev.currentTarget; b.disabled = true; b.textContent = "O mentor está corrigindo…"; ed.readOnly = true;
        $("[data-previa]").innerHTML = `<div class="idm-previa row" style="gap:10px"><span class="spinner"></span><span class="small muted">A IA está lendo sua redação com os critérios Cambridge. Leva uns 10 a 30 segundos.</span></div>`;
        try {
          const r = await Srv().submitWriting(app.uid(), { modulo: chave, nivel: nv, texto: ed.value, minPalavras: w.min, maxPalavras: w.max, prompt: w.prompt, genero: w.genero });
          const ganho = await darXP(app, XP.writing + (r.correcao ? Math.round(r.correcao.nota / 2) : 0), `Writing ${nv} enviado ao mentor`, chave, { palavras: r.palavras, nota: r.correcao ? r.correcao.nota : null });
          b.textContent = "Enviado ✓";
          $("[data-previa]").innerHTML = `<div class="idm-previa"><div class="row" style="gap:8px"><b>${r.correcao ? "Correção do mentor" : "Enviado ao mentor!"}</b>${ganho ? `<span class="pill solid">+${ganho} XP</span>` : ""}</div>
            ${r.correcao ? correcaoHtml(app, r) : `<p class="small muted">${r.nuvem === false || !window.LAService ? "Modo visitante: entre com sua conta para receber a correção da IA." : "A IA não conseguiu corrigir agora. Sua redação ficou salva: tente de novo em “Correções do mentor”, na aba Idiomas."}</p><ul class="small">${(r.previa || []).map(d => `<li>${app.esc(d)}</li>`).join("")}</ul>`}</div>`;
        } catch (e) { b.disabled = false; ed.readOnly = false; b.textContent = "Enviar para o Mentor"; $("[data-previa]").innerHTML = ""; app.toast("Não foi possível enviar agora. Confira sua internet."); }
      };
    }
    // speaking (MediaRecorder)
    const rec = $("[data-rec]");
    if (rec) {
      const s = mod.speaking, tEl = $("[data-rec-t]"), au = $("[data-rec-audio]"), env = $("[data-enviar-s]"), fmt = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
      let blob = null, dur = 0;
      rec.onclick = async () => {
        if (E.gravacao) { E.gravacao.parar(); return; }
        let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch (e) { app.toast("Permita o microfone para gravar sua resposta."); return; }
        const partes = [], mr = new MediaRecorder(stream), t0 = Date.now();
        mr.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
        mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(E.gravacao && E.gravacao.tick); E.gravacao = null;
          dur = (Date.now() - t0) / 1000; blob = new Blob(partes, { type: mr.mimeType || "audio/webm" });
          au.src = URL.createObjectURL(blob); au.hidden = false; env.disabled = dur < 3; rec.textContent = "🎙️ Gravar de novo"; };
        E.gravacao = { parar: () => { if (mr.state !== "inactive") mr.stop(); }, tick: setInterval(() => { const x = (Date.now() - t0) / 1000; tEl.textContent = `${fmt(x)} / ${fmt(s.segundos)}`; if (x >= s.segundos) E.gravacao.parar(); }, 250) };
        mr.start(500); rec.textContent = "■ Parar gravação";
      };
      env.onclick = async () => {
        if (!blob) return; env.disabled = true; env.textContent = "Enviando…";
        try {
          $("[data-previa]").innerHTML = `<div class="idm-previa row" style="gap:10px"><span class="spinner"></span><span class="small muted">A IA está ouvindo sua resposta. Leva uns 10 a 30 segundos.</span></div>`;
          const audio = window.LAService && blob.size < 6e6 ? { mime: (blob.type || "audio/webm").split(";")[0], b64: await paraBase64(blob) } : null;
          const r = await Srv().submitSpeaking(app.uid(), { modulo: chave, nivel: nv, segundos: dur, bytes: blob.size, prompt: s.prompt, audio });
          const ganho = await darXP(app, XP.speaking + (r.correcao ? Math.round(r.correcao.nota / 2) : 0), `Speaking ${nv} enviado ao mentor`, chave, { segundos: Math.round(dur), nota: r.correcao ? r.correcao.nota : null });
          env.textContent = "Enviado ✓";
          $("[data-previa]").innerHTML = `<div class="idm-previa"><div class="row" style="gap:8px"><b>${r.correcao ? "Avaliação do mentor" : "Áudio enviado!"}</b>${ganho ? `<span class="pill solid">+${ganho} XP</span>` : ""}</div>
            ${r.correcao ? correcaoHtml(app, r) : `<p class="small muted">Você falou por ${Math.round(dur)} segundos. ${window.LAService ? "A IA não conseguiu avaliar o áudio agora; grave e envie de novo daqui a pouco." : "Modo visitante: entre com sua conta para receber a avaliação da IA."}</p>`}</div>`;
        } catch (e) { env.disabled = false; env.textContent = "Enviar para o Mentor"; $("[data-previa]").innerHTML = ""; app.toast("Não foi possível enviar agora. Confira sua internet."); }
      };
    }
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
  // lista "Correções do mentor" na tela inicial da aba (só com conta)
  async function pintarEnvios(container, app) {
    const box = container.querySelector("[data-envios]"); if (!box || !window.LAService || !window.LAService.getSubmissions) return;
    let lista = []; try { lista = await window.LAService.getSubmissions(app.uid(), 8); } catch (e) { box.innerHTML = ""; return; }
    if (!lista.length) { box.innerHTML = ""; return; }
    const esc = app.esc, data = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    box.innerHTML = `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Correções do mentor</h3></div><div class="list">${lista.map(e => `<details class="idm-env">
      <summary><span class="pill">${e.tipo === "writing" ? "Writing" : "Speaking"} · ${esc(e.nivel)}</span><span class="small muted">${data(e.em)}</span>
      ${e.correcao ? `<b class="small">${e.correcao.nota}/20</b>` : e.status === "corrigindo" || e.status === "pendente" ? `<span class="small muted">sem correção</span>` : ""}</summary>
      ${e.correcao ? correcaoHtml(app, e) : `<p class="small muted">A IA não conseguiu corrigir na hora.</p>${e.tipo === "writing" ? `<button class="btn sm" type="button" data-refazer="${esc(e.id)}">Pedir correção de novo</button>` : ""}`}
      ${e.texto ? `<details><summary class="small">Seu texto</summary><p class="small idm-texto">${esc(e.texto).replace(/\n/g, "<br>")}</p></details>` : ""}</details>`).join("")}</div></div>`;
    box.onclick = async ev => {
      const b = ev.target.closest("[data-refazer]"); if (!b) return;
      b.disabled = true; b.textContent = "Corrigindo…";
      try { await window.LAService.retryWriting(app.uid(), b.dataset.refazer); app.toast("Correção pronta!"); pintarEnvios(container, app); }
      catch (e) { b.disabled = false; b.textContent = "Pedir correção de novo"; app.toast("A IA ainda não conseguiu corrigir. Tente mais tarde."); }
    };
  }
  function pararFala() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }
  function pararGravacao() { if (E.gravacao) E.gravacao.parar(); }

  // tempo de cronômetro/pomodoro em "Inglês" vira XP de idiomas (1 XP por minuto)
  async function xpPorTempo(uid, minutos) {
    const xp = Math.floor(minutos * XP.porMinuto);
    if (xp > 0) { await Srv().addLanguageXP(uid, xp, `${Math.round(minutos)} min de estudo de Inglês`); E.perfil = null; }
    return xp;
  }
  function sairDaAba() { pararFala(); pararGravacao(); }
  (window.LAComp = window.LAComp || {}).IdiomasView = { render, xpPorTempo, sairDaAba, MATERIA, XP };
})();
