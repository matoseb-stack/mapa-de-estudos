/* Conteúdo fixo do curso de Inglês (padrão Cambridge).
   - As aulas ficam em idiomas/ingles/<NIVEL>-<habilidade>.json (15 por trilha; formato em idiomas/FORMATO.md)
     e são carregadas só quando a pessoa abre a trilha.
   - Aqui ficam os níveis, as provas-alvo, as habilidades e o banco do teste de nivelamento. */
(function () {
  "use strict";
  const NIVEIS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const EXAME = { A1: "Pre A1–A1 Movers/Flyers", A2: "A2 Key (KET)", B1: "B1 Preliminary (PET)", B2: "B2 First (FCE)", C1: "C1 Advanced (CAE)", C2: "C2 Proficiency (CPE)" };
  // provas que a pessoa pode escolher como meta
  const METAS = [
    { nivel: "A2", nome: "A2 Key", desc: "Básico: entender e escrever mensagens do dia a dia." },
    { nivel: "B1", nome: "B1 Preliminary", desc: "Intermediário: viajar, estudar e trabalhar com inglês simples." },
    { nivel: "B2", nome: "B2 First", desc: "Independente: o mais pedido por faculdades e intercâmbios." },
    { nivel: "C1", nome: "C1 Advanced", desc: "Avançado: universidades no exterior e vida profissional." },
    { nivel: "C2", nome: "C2 Proficiency", desc: "Proficiência: domínio do idioma quase como nativo." }
  ];
  const COMPETENCIAS = [
    { k: "reading", nome: "Reading & Use of English", curto: "Reading", desc: "Leitura e gramática no formato da prova.", min: 25 },
    { k: "listening", nome: "Listening", curto: "Listening", desc: "Áudios com perguntas, ditados e repetição.", min: 25 },
    { k: "writing", nome: "Writing", curto: "Writing", desc: "Preparação + redação corrigida pela IA.", min: 30 },
    { k: "speaking", nome: "Speaking", curto: "Speaking", desc: "Fale em inglês: o app ouve e corrige.", min: 25 }
  ];
  const AULAS_POR_TRILHA = 15;
  const arquivo = (nivel, skill) => `idiomas/ingles/${nivel}-${skill}.json`;

  /* Teste de nivelamento adaptativo: 5 questões por nível (marcar, escrever, montar e falar),
     começando no A1. Quem vai bem sobe para o nível seguinte; o teste para quando a pessoa erra demais. */
  const NIVELAMENTO = {
    A1: [
      { t: "mc", q: "Where ___ your parents live?", op: ["do", "does", "are", "is"], r: 0, exp: "Com they/your parents, a pergunta no presente usa do." },
      { t: "gap", q: "My sister ___ coffee. She prefers tea.", dica: "not like", resp: ["doesn't like", "does not like"], exp: "Terceira pessoa (she) na negativa: doesn't + verbo." },
      { t: "order", palavras: ["What", "time", "do", "you", "usually", "get", "up"], resp: "What time do you usually get up", exp: "Pergunta: palavra interrogativa + do + sujeito + advérbio + verbo." },
      { t: "mc", q: "I can't come now. I ___ my homework.", op: ["do", "am doing", "does", "doing"], r: 1, exp: "Ação acontecendo agora: present continuous (am doing)." },
      { t: "speak", modo: "repetir", q: "Leia a frase em voz alta.", frase: "I usually walk to school with my older brother.", exp: "Atenção ao som de 'walk' (uók) e 'brother' (bráder)." }
    ],
    A2: [
      { t: "mc", q: "I ___ my keys yesterday, so I couldn't get into the house.", op: ["lost", "have lost", "was losing", "lose"], r: 0, exp: "Ação terminada num momento passado definido (yesterday): past simple." },
      { t: "gap", q: "We've lived in this flat ___ 2019.", resp: ["since"], exp: "Since + ponto de partida no tempo; for + duração." },
      { t: "mc", q: "This is the ___ film I've ever seen. I left after twenty minutes.", op: ["baddest", "worse", "worst", "most bad"], r: 2, exp: "Superlativo irregular: bad → worse → worst." },
      { t: "order", palavras: ["She", "was", "reading", "when", "the", "phone", "rang"], resp: "She was reading when the phone rang", alt: ["When the phone rang she was reading"], exp: "Past continuous (ação em andamento) interrompida pelo past simple." },
      { t: "speak", modo: "responder", q: "Responda falando, com uma frase completa.", frase: "What did you do last weekend?", modelo: "Last weekend I visited my grandparents and we had lunch together.", min: 6, chave: ["went", "played", "watched", "visited", "stayed", "had", "did", "was", "were", "saw", "studied", "met"], exp: "Use o past simple: I went, I watched, I visited…" }
    ],
    B1: [
      { t: "mc", q: "If I ___ more free time, I would learn to play the guitar.", op: ["have", "had", "would have", "will have"], r: 1, exp: "Second conditional: if + past simple, would + verbo." },
      { t: "gap", q: "I'm not used to ___ up so early on Saturdays.", dica: "get", resp: ["getting"], exp: "Be used to + verbo com -ing." },
      { t: "mc", q: "The museum, ___ was built in 1850, is closed for repairs.", op: ["that", "who", "which", "where"], r: 2, exp: "Oração explicativa (entre vírgulas) sobre coisa: which (that não é usado com vírgulas)." },
      { t: "order", palavras: ["You", "should", "have", "told", "me", "about", "the", "meeting"], resp: "You should have told me about the meeting", exp: "Should have + particípio: crítica sobre algo do passado." },
      { t: "speak", modo: "repetir", q: "Leia a frase em voz alta.", frase: "Although it was raining heavily, we decided to carry on with the trip.", exp: "'Although' soa ól-DÔU; 'heavily' tem o 'h' aspirado." }
    ],
    B2: [
      { t: "mc", q: "By the time we arrived at the stadium, the concert ___.", op: ["had already started", "has already started", "already started", "was already starting"], r: 0, exp: "Antes de outro momento passado: past perfect." },
      { t: "gap", q: "The ___ of the new bridge took almost three years.", dica: "CONSTRUCT", resp: ["construction"], exp: "Word formation: verbo construct → substantivo construction." },
      { t: "mc", q: "She's remarkably good ___ dealing with difficult customers.", op: ["in", "at", "on", "with"], r: 1, exp: "Good at + -ing." },
      { t: "gap", q: "'I'll help you with your homework,' Tom said to me. (OFFERED) → Tom ___ with my homework.", resp: ["offered to help me"], exp: "Key word transformation: offer + to + verbo." },
      { t: "speak", modo: "responder", q: "Responda falando, com pelo menos duas frases.", frase: "Do you think people rely too much on their phones? Why or why not?", modelo: "I think many people rely too much on their phones because they use them for everything, from work to entertainment. However, phones can also be really useful in emergencies.", min: 15, chave: ["because", "think", "believe", "however", "although", "since", "opinion"], exp: "Dê opinião e justifique: I think… because… However…" }
    ],
    C1: [
      { t: "mc", q: "Not only ___ the deadline, but he also went over budget.", op: ["he missed", "did he miss", "he did miss", "missed he"], r: 1, exp: "Inversão depois de 'Not only' no início: auxiliar + sujeito." },
      { t: "gap", q: "Her ___ to detail makes her an outstanding editor.", dica: "ATTEND", resp: ["attention"], exp: "Collocation fixa: attention to detail." },
      { t: "order", palavras: ["Had", "I", "known", "about", "the", "traffic", "I", "would", "have", "left", "earlier"], resp: "Had I known about the traffic I would have left earlier", exp: "Third conditional com inversão: Had I known = If I had known." },
      { t: "gap", q: "It's possible that she didn't receive my message. (MAY) → She ___ my message.", resp: ["may not have received", "may not have got", "may not have gotten"], exp: "Possibilidade no passado: may not have + particípio." },
      { t: "mc", q: "The proposal was turned down on the ___ that it was far too costly.", op: ["grounds", "reasons", "basis", "causes"], r: 0, exp: "Expressão fixa: on the grounds that = com a justificativa de que." },
      { t: "speak", modo: "repetir", q: "Leia a frase em voz alta.", frase: "Hardly had we sat down when the fire alarm went off.", exp: "Inversão com 'Hardly… when'. Ligue 'went off' (wén-tóf)." }
    ],
    C2: [
      { t: "mc", q: "His explanation, ___ plausible at first, fell apart under closer scrutiny.", op: ["albeit", "however", "whereas", "despite"], r: 0, exp: "Albeit = although it was, seguido de adjetivo." },
      { t: "gap", q: "The report highlighted the ___ of the current safety procedures.", dica: "ADEQUATE", resp: ["inadequacy", "inadequacies"], exp: "Prefixo negativo + sufixo: adequate → inadequacy." },
      { t: "mc", q: "After the public outcry, the minister was forced to ___ his earlier remarks.", op: ["backtrack on", "back down", "back out", "back up"], r: 0, exp: "Backtrack on = voltar atrás em algo que disse." },
      { t: "gap", q: "I had no idea how demanding the job would be. (DID) → Little ___ how demanding the job would be.", resp: ["did i know", "did i realise", "did i realize", "did i suspect"], exp: "Inversão enfática: Little did I know…" },
      { t: "speak", modo: "responder", q: "Responda falando, desenvolvendo a sua opinião.", frase: "To what extent should governments regulate artificial intelligence?", modelo: "To a large extent, I'd argue that some regulation is essential, particularly where safety and privacy are at stake. That said, overly rigid rules could stifle innovation, so governments need to strike a careful balance.", min: 25, chave: ["extent", "argue", "however", "whereas", "although", "regulation", "regulate", "balance", "that said"], exp: "Use estruturas de nível C2: To a large extent… That said… strike a balance." }
    ]
  };

  window.LA_INGLES = {
    k: "ingles", nome: "Inglês", bandeira: "🇬🇧", prova: "Cambridge English", provaCurta: "Cambridge", lang: "en-GB", materia: "Inglês",
    metaPadrao: "B2", placeholder: "Write your answer here…",
    aviso: "Curso no formato das provas Cambridge English (Key, Preliminary, First, Advanced e Proficiency). Conteúdo próprio do Logic Academy, sem vínculo com a Cambridge University Press & Assessment.",
    NIVEIS, EXAME, METAS, COMPETENCIAS, NIVELAMENTO, AULAS_POR_TRILHA, arquivo
  };
  (window.LA_IDIOMAS = window.LA_IDIOMAS || {}).ingles = window.LA_INGLES;
})();
