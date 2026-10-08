/* =====================================================================
   firebaseService.js — serviços REAIS da v2.0 (Firestore + IA da mentoria)
   ---------------------------------------------------------------------
   Mesma interface do firebaseServiceMock.js. O index.html cria o serviço
   depois do login com LAServicoNuvem.criar(deps) e o publica em
   window.LAService; os componentes usam window.LAService quando existe
   e caem no serviço simulado só no modo visitante (sem conta).

   Onde fica cada coisa (regra existente: data/users/{uid}/** só o dono lê e grava):
     data/users/{uid}/idiomas                  → níveis, XP de idiomas, histórico, módulos concluídos, agendados
     data/users/{uid}/idiomas/x/envios/{id}    → redações e falas enviadas ao mentor, com a correção da IA
     data/users/{uid}/avisos                   → versão das novidades já vista (vale em todos os aparelhos)
   deps = { db(), uid(), FieldValue, iaJson(prompt, {audio}), iaDisponivel(), minutosHojeNuvem() }
   ===================================================================== */
(function () {
  "use strict";
  const LIMITE_DIA_MIN = 960, SESSAO_MAX_MIN = 8 * 60;
  const MAX_HIST = 60, MAX_AGENDA = 60, MAX_TEXTO = 6000;

  function criar(deps) {
    const Mock = window.FirebaseServiceMock;            // reaproveita as dicas automáticas e os controles de teste
    const docIdiomas = () => deps.db().collection("data/users/" + deps.uid()).doc("idiomas");
    const colEnvios = () => docIdiomas().collection("envios");
    const docAvisos = () => deps.db().collection("data/users/" + deps.uid()).doc("avisos");
    const FV = deps.FieldValue;
    let cache = null;                                     // último doc lido (evita leituras repetidas na mesma tela)

    async function lerIdiomas(forcar) {
      if (cache && !forcar) return cache;
      const s = await docIdiomas().get();
      cache = s.exists ? s.data() : {};
      return cache;
    }
    // altera o doc numa transação (dois aparelhos ao mesmo tempo não perdem XP)
    async function alterar(fn) {
      const ref = docIdiomas();
      const d = await deps.db().runTransaction(async t => {
        const s = await t.get(ref), d = s.exists ? s.data() : {};
        fn(d); t.set(ref, d); return d;
      });
      cache = d; return d;
    }
    const contarPalavras = t => (String(t || "").match(/[A-Za-zÀ-ÿ'’-]+/g) || []).length;

    /* ---------- correção pela IA ---------- */
    async function corrigirWriting(p) {
      const prompt = `Você é examinador(a) do Cambridge English (${p.nivel}). Corrija a redação abaixo de um estudante brasileiro.
Tarefa pedida: ${p.prompt || "(não informada)"}
Gênero: ${p.genero || "—"} · Limite: ${p.minPalavras || "?"}–${p.maxPalavras || "?"} palavras · O estudante escreveu ${p.palavras} palavras.
Avalie pelos 4 critérios oficiais do Cambridge Writing (Content, Communicative Achievement, Organisation, Language), nota de 0 a 5 cada, considerando o nível ${p.nivel}.
Responda SÓ com JSON, comentários em português simples:
{"nota":0-20,"resumo":"2 frases","criterios":[{"nome":"Content","nota":0-5,"comentario":"..."},{"nome":"Communicative Achievement","nota":0-5,"comentario":"..."},{"nome":"Organisation","nota":0-5,"comentario":"..."},{"nome":"Language","nota":0-5,"comentario":"..."}],
"erros":[{"trecho":"texto original","correcao":"forma correta","explicacao":"curta"}],"dicas":["até 3 dicas práticas"],"versaoMelhorada":"um parágrafo do texto reescrito no nível ${p.nivel}"}
No máximo 6 erros, os mais importantes. Se o texto não estiver em inglês ou fugir da tarefa, diga isso no resumo e dê nota baixa em Content.

REDAÇÃO:
"""${p.texto}"""`;
      const r = await deps.iaJson(prompt);
      const n = x => Math.max(0, Math.min(5, Math.round(+x || 0)));
      const criterios = (Array.isArray(r.criterios) ? r.criterios : []).slice(0, 4).map(c => ({ nome: String(c.nome || ""), nota: n(c.nota), comentario: String(c.comentario || "").slice(0, 500) }));
      return {
        nota: criterios.length ? criterios.reduce((a, c) => a + c.nota, 0) : Math.max(0, Math.min(20, Math.round(+r.nota || 0))),
        resumo: String(r.resumo || "").slice(0, 600), criterios,
        erros: (Array.isArray(r.erros) ? r.erros : []).slice(0, 6).map(e => ({ trecho: String(e.trecho || "").slice(0, 200), correcao: String(e.correcao || "").slice(0, 200), explicacao: String(e.explicacao || "").slice(0, 300) })),
        dicas: (Array.isArray(r.dicas) ? r.dicas : []).slice(0, 3).map(x => String(x).slice(0, 300)),
        versaoMelhorada: String(r.versaoMelhorada || "").slice(0, 1500)
      };
    }
    async function corrigirSpeaking(p) {
      const prompt = `Você é examinador(a) do Cambridge English Speaking (${p.nivel}). Ouça a resposta gravada de um estudante brasileiro.
Tarefa: ${p.prompt || "(não informada)"}
Avalie Grammar & Vocabulary, Discourse Management, Pronunciation e Interactive Communication (0 a 5 cada) para o nível ${p.nivel}.
Responda SÓ com JSON, comentários em português simples:
{"transcricao":"o que o estudante disse, em inglês","resumo":"2 frases","criterios":[{"nome":"Grammar & Vocabulary","nota":0-5,"comentario":"..."},{"nome":"Discourse Management","nota":0-5,"comentario":"..."},{"nome":"Pronunciation","nota":0-5,"comentario":"..."},{"nome":"Interactive Communication","nota":0-5,"comentario":"..."}],"dicas":["até 3 dicas práticas"]}
Se não houver fala em inglês no áudio, diga isso no resumo e dê notas baixas.`;
      const r = await deps.iaJson(prompt, { audio: p.audio });
      const n = x => Math.max(0, Math.min(5, Math.round(+x || 0)));
      const criterios = (Array.isArray(r.criterios) ? r.criterios : []).slice(0, 4).map(c => ({ nome: String(c.nome || ""), nota: n(c.nota), comentario: String(c.comentario || "").slice(0, 500) }));
      return { nota: criterios.reduce((a, c) => a + c.nota, 0), transcricao: String(r.transcricao || "").slice(0, 2000), resumo: String(r.resumo || "").slice(0, 600), criterios, dicas: (Array.isArray(r.dicas) ? r.dicas : []).slice(0, 3).map(x => String(x).slice(0, 300)) };
    }

    const Servico = {
      nuvem: true,
      /* ---------- nível ---------- */
      async getUserLevel(uid, idioma = "ingles") {
        const d = await lerIdiomas(true);
        return (d.niveis && d.niveis[idioma]) || null;
      },
      async saveUserLevel(uid, idioma, resultado) {
        const reg = { nivel: resultado.nivel, pontos: resultado.pontos, total: resultado.total, porNivel: resultado.porNivel || {}, em: Date.now() };
        await alterar(d => { d.niveis = d.niveis || {}; d.niveis[idioma] = reg; });
        return reg;
      },

      /* ---------- envios ao mentor (IA) ---------- */
      async submitWriting(uid, p) {
        const texto = String(p.texto || "").slice(0, MAX_TEXTO), palavras = contarPalavras(texto);
        const previa = Mock.dicasWriting(texto, p.minPalavras, p.maxPalavras);   // dicas instantâneas, sem rede
        const base = { tipo: "writing", modulo: p.modulo, nivel: p.nivel, texto, palavras, prompt: String(p.prompt || "").slice(0, 1200), genero: p.genero || "", minPalavras: p.minPalavras || 0, maxPalavras: p.maxPalavras || 0, em: Date.now(), criadoEm: FV.serverTimestamp() };
        const ref = colEnvios().doc();
        await ref.set({ ...base, status: "corrigindo" });
        let correcao = null, erro = "";
        if (deps.iaDisponivel()) { try { correcao = await corrigirWriting(base); } catch (e) { erro = (e && e.code) || "erro"; } }
        else erro = "ia_indisponivel";
        await ref.set({ status: correcao ? "corrigido" : "pendente", correcao, erro, corrigidoEm: correcao ? Date.now() : 0 }, { merge: true });
        return { id: ref.id, ...base, criadoEm: undefined, palavras, previa, correcao, erro, status: correcao ? "corrigido" : "pendente" };
      },
      // tenta de novo a correção de uma redação que ficou pendente (IA fora do ar ou limite atingido)
      async retryWriting(uid, id) {
        const ref = colEnvios().doc(id), s = await ref.get();
        if (!s.exists) throw { code: "nao-encontrado" };
        const correcao = await corrigirWriting(s.data());
        await ref.set({ status: "corrigido", correcao, erro: "", corrigidoEm: Date.now() }, { merge: true });
        return { id, ...s.data(), correcao, status: "corrigido" };
      },
      async submitSpeaking(uid, p) {
        const base = { tipo: "speaking", modulo: p.modulo, nivel: p.nivel, segundos: Math.round(p.segundos || 0), bytes: p.bytes || 0, prompt: String(p.prompt || "").slice(0, 1200), em: Date.now(), criadoEm: FV.serverTimestamp() };
        const ref = colEnvios().doc();
        let correcao = null, erro = "";
        if (p.audio && deps.iaDisponivel()) { try { correcao = await corrigirSpeaking({ ...base, audio: p.audio }); } catch (e) { erro = (e && e.code) || "erro"; } }
        else erro = p.audio ? "ia_indisponivel" : "sem_audio";
        // o áudio não é guardado (documentos têm limite de 1 MB); ficam a transcrição e a avaliação
        await ref.set({ ...base, status: correcao ? "corrigido" : "pendente", correcao, erro });
        return { id: ref.id, ...base, criadoEm: undefined, correcao, erro, status: correcao ? "corrigido" : "pendente" };
      },
      async getSubmissions(uid, limite = 10) {
        const q = await colEnvios().orderBy("em", "desc").limit(limite).get();
        return q.docs.map(d => ({ id: d.id, ...d.data(), criadoEm: undefined }));
      },

      /* ---------- semana ---------- */
      async addLanguageTaskToWeek(uid, t) {
        const reg = { idioma: t.idioma || "ingles", modulo: t.modulo, rotulo: t.rotulo, dia: t.dia, inicio: t.inicio, min: t.min, em: Date.now() };
        await alterar(d => { d.agendados = [reg].concat(d.agendados || []).slice(0, MAX_AGENDA); });
        return reg;
      },

      /* ---------- XP de idiomas ---------- */
      async addLanguageXP(uid, xp, motivo) {
        const ganho = Math.max(0, Math.round(+xp || 0));
        if (!ganho) return { total: ((await lerIdiomas()).xp) || 0, ganho: 0 };
        const d = await alterar(d => { d.xp = (d.xp || 0) + ganho; d.historico = [{ xp: ganho, motivo: String(motivo || "").slice(0, 120), em: Date.now() }].concat(d.historico || []).slice(0, MAX_HIST); });
        return { total: d.xp, ganho };
      },
      async getLanguageProfile(uid) {
        const d = await lerIdiomas(true);
        return { xp: d.xp || 0, historico: (d.historico || []).slice(0, 20), concluidos: d.concluidos || {}, agendados: d.agendados || [] };
      },
      async markModuleDone(uid, chave, resultado) {
        await alterar(d => { d.concluidos = d.concluidos || {}; d.concluidos[chave] = { ...(resultado || {}), em: Date.now() }; });
        return true;
      },

      /* ---------- regras do cronômetro ---------- */
      // Usa o tempo de hoje salvo na nuvem (soma o que foi estudado em outros aparelhos).
      async checkFirebaseTimerRules(ctx = {}) {
        if (Mock.testes.forcarBloqueio) { const motivo = Mock.testes.forcarBloqueio; Mock.testes.forcarBloqueio = null; return { permitido: false, codigo: "teste", motivo }; }
        let minHoje = ctx.minHoje || 0;
        try { minHoje = Math.max(minHoje, (await deps.minutosHojeNuvem()) + (ctx.minSessao || 0)); } catch (e) { /* sem rede: usa o valor local */ }
        if (minHoje >= LIMITE_DIA_MIN) return { permitido: false, codigo: "limite-diario", motivo: "Limite de 16 horas de estudo por dia atingido (somando todos os seus aparelhos). O tempo extra não seria contado." };
        if ((ctx.confirmadoHaMin || 0) >= SESSAO_MAX_MIN) return { permitido: false, codigo: "sessao-expirada", motivo: "Sessão expirada: o cronômetro está há mais de 8 horas sem confirmação. Confirme que ainda está estudando." };
        if (Mock.testes.aleatorio && Math.random() < Mock.testes.chanceAleatoria) return { permitido: false, codigo: "aleatorio", motivo: "Bloqueio simulado (modo de teste): o servidor recusou a contagem." };
        return { permitido: true };
      },

      /* ---------- novidades ---------- */
      async getPatchNotes() { return window.LA_PATCH_NOTES || null; },
      async getPatchVisto() { const s = await docAvisos().get(); return s.exists ? (s.data().patchVisto || null) : null; },
      async setPatchVisto(versao) { await docAvisos().set({ patchVisto: versao, em: Date.now() }, { merge: true }); },

      testes: Mock.testes,
      simularBloqueio(m) { Mock.simularBloqueio(m); }
    };
    return Servico;
  }
  window.LAServicoNuvem = { criar };
})();
