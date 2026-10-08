/* =====================================================================
   firebaseServiceMock.js — camada de serviços SIMULADA (Logic Academy)
   ---------------------------------------------------------------------
   Todas as funções devolvem Promises e simulam a latência da rede com
   setTimeout. Os dados ficam no localStorage do aparelho, separados por
   usuário (uid).

   USO: só no modo visitante (sem conta). Com conta, o app usa o serviço
   real em js/firebaseService.js (window.LAService), com a mesma interface.

   COMO TROCAR PELO FIREBASE REAL:
   mantenha os mesmos nomes e formatos de retorno e substitua o corpo de
   cada função pela chamada ao SDK (firebase.firestore()...). Os pontos de
   troca estão marcados com "FIREBASE REAL:". A interface (index.html e
   js/componentes/*) não precisa mudar.
   ===================================================================== */
(function () {
  "use strict";

  const LATENCIA = [250, 650];                 // ms mínimos/máximos de "rede"
  const LIMITE_DIA_MIN = 960;                  // 16 h por dia (mesma regra do servidor real)
  const SESSAO_MAX_MIN = 8 * 60;               // sessão contínua sem confirmação: 8 h
  const CHAVE = uid => "la_mock_" + (uid || "visitante");

  // ---- utilidades internas -------------------------------------------------
  const esperar = (ms) => new Promise(r => setTimeout(r, ms));
  const rede = () => esperar(LATENCIA[0] + Math.random() * (LATENCIA[1] - LATENCIA[0]));
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function lerBase(uid) {
    try { return JSON.parse(localStorage.getItem(CHAVE(uid)) || "{}") || {}; } catch (e) { return {}; }
  }
  function gravarBase(uid, dados) {
    try { localStorage.setItem(CHAVE(uid), JSON.stringify(dados)); } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }
  function atualizar(uid, fn) { const d = lerBase(uid); fn(d); gravarBase(uid, d); return d; }

  // ---- modo de teste (só para o site de testes / ?teste=1) -------------------
  // Permite simular bloqueios do cronômetro sem esperar 16 h de estudo.
  const testes = { forcarBloqueio: null, aleatorio: false, chanceAleatoria: 0.15 };

  // dicas automáticas e instantâneas sobre a redação (também usadas pelo serviço da nuvem)
  function dicasWriting(texto, min, max) {
    texto = String(texto || "");
    const palavras = (texto.match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;
    const paragrafos = texto.split(/\n\s*\n/).filter(p => p.trim()).length;
    const conectivos = (texto.match(/\b(however|moreover|furthermore|although|therefore|in addition|on the other hand|firstly|finally|because|while|whereas|nevertheless)\b/gi) || []).length;
    const dicas = [];
    if (min && palavras < min) dicas.push(`Escreva pelo menos ${min} palavras (você escreveu ${palavras}).`);
    if (max && palavras > max) dicas.push(`Passou do limite de ${max} palavras (você escreveu ${palavras}).`);
    if (paragrafos < 3 && palavras > 80) dicas.push("Divida o texto em parágrafos: introdução, desenvolvimento e conclusão.");
    if (conectivos < 2) dicas.push("Use mais conectivos (however, moreover, therefore, although…) para ligar as ideias.");
    if (!dicas.length) dicas.push("Boa estrutura! O mentor vai revisar vocabulário e gramática.");
    return dicas;
  }

  const Servico = {
    dicasWriting,
    /* ---------------- Idiomas: nível ---------------- */
    // FIREBASE REAL: get(doc(db, "data/users/" + uid + "/idiomas")) → campo ingles.nivel
    async getUserLevel(uid, idioma = "ingles") {
      await rede();
      const d = lerBase(uid);
      return (d.idiomas && d.idiomas[idioma]) || null;   // { nivel, pontos, total, em } ou null
    },
    // FIREBASE REAL: setDoc(doc(...idiomas), { [idioma]: {...} }, { merge: true })
    async saveUserLevel(uid, idioma, resultado) {
      await rede();
      const reg = { nivel: resultado.nivel, pontos: resultado.pontos, total: resultado.total, porNivel: resultado.porNivel || {}, em: Date.now() };
      atualizar(uid, d => { d.idiomas = d.idiomas || {}; d.idiomas[idioma] = reg; });
      return reg;
    },

    /* ---------------- Idiomas: envios ao mentor ---------------- */
    // FIREBASE REAL: addDoc(collection(db, "mentoria/" + uid + "/writing"), payload) e uma Cloud Function corrige
    async submitWriting(uid, payload) {
      await rede(); await esperar(400);
      const texto = String(payload.texto || "");
      const palavras = (texto.match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;
      const paragrafos = texto.split(/\n\s*\n/).filter(p => p.trim()).length;
      const conectivos = (texto.match(/\b(however|moreover|furthermore|although|therefore|in addition|on the other hand|firstly|finally|because|while|whereas|nevertheless)\b/gi) || []).length;
      const envio = { id: novoId(), tipo: "writing", modulo: payload.modulo, nivel: payload.nivel, palavras, paragrafos, conectivos, status: "recebido", em: Date.now() };
      atualizar(uid, d => { (d.envios = d.envios || []).unshift(envio); d.envios = d.envios.slice(0, 50); });
      return { ...envio, previa: dicasWriting(texto, payload.minPalavras, payload.maxPalavras) };
    },
    // FIREBASE REAL: uploadBytes(ref(storage, "speaking/" + uid + "/" + id + ".webm"), blob) + addDoc(...)
    async submitSpeaking(uid, payload) {
      await rede(); await esperar(600);
      const envio = { id: novoId(), tipo: "speaking", modulo: payload.modulo, nivel: payload.nivel, segundos: Math.round(payload.segundos || 0), bytes: payload.bytes || 0, status: "recebido", em: Date.now() };
      atualizar(uid, d => { (d.envios = d.envios || []).unshift(envio); d.envios = d.envios.slice(0, 50); });
      return envio;
    },
    async getSubmissions(uid) { await rede(); return (lerBase(uid).envios || []).slice(); },

    /* ---------------- Integração com a semana ---------------- */
    // FIREBASE REAL: a tarefa vira um bloco em data/users/{uid}/plano (o app grava o plano; aqui só registramos o agendamento)
    async addLanguageTaskToWeek(uid, tarefa) {
      await rede();
      const t = { id: novoId(), idioma: tarefa.idioma || "ingles", modulo: tarefa.modulo, rotulo: tarefa.rotulo, dia: tarefa.dia, inicio: tarefa.inicio, min: tarefa.min, em: Date.now() };
      atualizar(uid, d => { (d.agendados = d.agendados || []).unshift(t); d.agendados = d.agendados.slice(0, 100); });
      return t;
    },

    /* ---------------- XP de idiomas ---------------- */
    // FIREBASE REAL: o XP do perfil é conferido pelas regras do Firestore (coleção resgates).
    // Para somar este XP ao nível do perfil, crie um tipo de resgate "l" (idiomas) nas regras e troque esta função.
    async addLanguageXP(uid, xp, motivo) {
      await rede();
      const ganho = Math.max(0, Math.round(xp));
      const d = atualizar(uid, d => {
        d.xpIdiomas = (d.xpIdiomas || 0) + ganho;
        (d.historicoXP = d.historicoXP || []).unshift({ xp: ganho, motivo, em: Date.now() });
        d.historicoXP = d.historicoXP.slice(0, 100);
      });
      return { total: d.xpIdiomas, ganho };
    },
    async getLanguageProfile(uid) {
      await rede();
      const d = lerBase(uid);
      return { xp: d.xpIdiomas || 0, historico: (d.historicoXP || []).slice(0, 20), concluidos: d.concluidos || {}, agendados: d.agendados || [] };
    },
    async markModuleDone(uid, chaveModulo, resultado) {
      await rede();
      atualizar(uid, d => { d.concluidos = d.concluidos || {}; d.concluidos[chaveModulo] = { ...resultado, em: Date.now() }; });
      return true;
    },

    /* ---------------- Regras do cronômetro ---------------- */
    // FIREBASE REAL: as regras do Firestore recusam a gravação do ranking acima de 16 h/dia
    // (ver firestore.rules → match /ranking). Aqui a mesma regra é simulada antes de gravar.
    // Recebe: { minHoje, minSessao, confirmadoHaMin }. Devolve { permitido, codigo, motivo }.
    async checkFirebaseTimerRules(ctx = {}) {
      await esperar(120 + Math.random() * 180);
      if (testes.forcarBloqueio) {
        const motivo = testes.forcarBloqueio; testes.forcarBloqueio = null;
        return { permitido: false, codigo: "teste", motivo };
      }
      if ((ctx.minHoje || 0) + (ctx.minSessao || 0) >= LIMITE_DIA_MIN)
        return { permitido: false, codigo: "limite-diario", motivo: "Limite de 16 horas de estudo por dia atingido. O tempo extra não seria contado." };
      if ((ctx.confirmadoHaMin || 0) >= SESSAO_MAX_MIN)
        return { permitido: false, codigo: "sessao-expirada", motivo: "Sessão expirada: o cronômetro está há mais de 8 horas sem confirmação. Confirme que ainda está estudando." };
      if (testes.aleatorio && Math.random() < testes.chanceAleatoria)
        return { permitido: false, codigo: "aleatorio", motivo: "Bloqueio simulado (modo de teste): o servidor recusou a contagem." };
      return { permitido: true };
    },

    /* ---------------- Patch notes ---------------- */
    // FIREBASE REAL: getDoc(doc(db, "config/patchNotes")) — permite publicar novidades sem novo deploy
    async getPatchNotes() {
      await rede();
      return window.LA_PATCH_NOTES || null;
    },

    // controles do modo de teste (usados pelos botões de teste da interface)
    testes,
    simularBloqueio(motivo) { testes.forcarBloqueio = motivo || "Bloqueio de teste: regra do Firebase simulada."; },
  };

  window.FirebaseServiceMock = Servico;
})();
