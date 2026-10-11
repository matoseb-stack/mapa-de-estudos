/* Conteúdo fixo do curso de Francês (padrão DELF/DALF, France Éducation international).
   - As aulas ficam em idiomas/frances/<NIVEL>-<habilidade>.json (15 por trilha; formato em idiomas/FORMATO.md,
     resumo das provas em idiomas/frances/PROVAS.md) e são carregadas só quando a pessoa abre a trilha.
   - As chaves das habilidades são as mesmas do inglês (reading, listening, writing, speaking)
     para o resto do app (XP, semana, correção) funcionar igual. */
(function () {
  "use strict";
  const NIVEIS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const EXAME = { A1: "DELF A1", A2: "DELF A2", B1: "DELF B1", B2: "DELF B2", C1: "DALF C1", C2: "DALF C2" };
  const METAS = [
    { nivel: "A2", nome: "DELF A2", desc: "Básico: se virar no dia a dia, em viagens e em mensagens simples." },
    { nivel: "B1", nome: "DELF B1", desc: "Intermediário: exigido para a nacionalidade francesa e muitos empregos." },
    { nivel: "B2", nome: "DELF B2", desc: "Independente: o mais pedido pelas universidades francesas (Campus France)." },
    { nivel: "C1", nome: "DALF C1", desc: "Avançado: dispensa teste nas universidades e vida profissional em francês." },
    { nivel: "C2", nome: "DALF C2", desc: "Proficiência: domínio do idioma em contextos acadêmicos exigentes." }
  ];
  const COMPETENCIAS = [
    { k: "reading", nome: "Compréhension des écrits", curto: "Leitura", desc: "Leitura de documentos e gramática no formato da prova.", min: 25 },
    { k: "listening", nome: "Compréhension de l'oral", curto: "Escuta", desc: "Áudios com perguntas, ditados e repetição.", min: 25 },
    { k: "writing", nome: "Production écrite", curto: "Escrita", desc: "Preparação + produção escrita corrigida pela IA.", min: 30 },
    { k: "speaking", nome: "Production orale", curto: "Fala", desc: "Fale em francês: o app ouve e corrige.", min: 25 }
  ];
  const AULAS_POR_TRILHA = 15;
  const arquivo = (nivel, skill) => `idiomas/frances/${nivel}-${skill}.json`;

  /* Teste de nivelamento adaptativo (mesma regra do inglês): 5 ou 6 questões por nível. */
  const NIVELAMENTO = {
    A1: [
      { t: "mc", q: "Bonjour ! Je ___ brésilienne et j'habite à Lyon.", op: ["suis", "ai", "es", "est"], r: 0, exp: "Nacionalidade usa o verbo être: je suis." },
      { t: "gap", q: "Nous ___ deux enfants : un garçon et une fille.", dica: "avoir", resp: ["avons"], exp: "Avoir no presente: j'ai, tu as, il a, nous avons, vous avez, ils ont." },
      { t: "order", palavras: ["Est-ce", "que", "tu", "aimes", "le", "cinéma", "?"], resp: "Est-ce que tu aimes le cinéma ?", exp: "Pergunta com est-ce que + sujeito + verbo. Gostos usam o artigo definido: le cinéma." },
      { t: "mc", q: "Je ne mange pas ___ viande, je suis végétarien.", op: ["de", "la", "du", "une"], r: 0, exp: "Depois da negação, du/de la/des/un/une viram de: pas de viande." },
      { t: "speak", modo: "repetir", q: "Leia a frase em voz alta.", frase: "Je voudrais un café et un croissant, s'il vous plaît.", exp: "'Un' é nasal (ã fechado, sem 'n'); em 's'il vous plaît' o 's' final de 'plaît' não se pronuncia." }
    ],
    A2: [
      { t: "mc", q: "Hier soir, nous ___ au cinéma avec des amis.", op: ["sommes allés", "avons allé", "allons", "allions"], r: 0, exp: "Aller forma o passé composé com être, e o particípio concorda: nous sommes allés." },
      { t: "gap", q: "Quand j'étais petit, je ___ tous les étés chez mes grands-parents.", dica: "aller", resp: ["allais"], exp: "Hábito no passado: imparfait (j'allais)." },
      { t: "mc", q: "Tu as vu Marie ? — Oui, je ___ ai vue ce matin.", op: ["l'", "la", "lui", "le"], r: 0, exp: "COD feminino (Marie) antes de vogal: l'. Lui é COI (à quelqu'un)." },
      { t: "order", palavras: ["Il", "faut", "réserver", "une", "table", "pour", "samedi"], resp: "Il faut réserver une table pour samedi", exp: "Il faut + infinitivo = é preciso." },
      { t: "speak", modo: "responder", q: "Responda falando, com uma frase completa.", frase: "Qu'est-ce que tu as fait le week-end dernier ?", modelo: "Le week-end dernier, j'ai rendu visite à mes parents et nous sommes allés au parc.", min: 6, chave: ["j'ai", "je suis", "nous avons", "nous sommes", "on a", "on est", "été", "fait", "allé", "allée", "vu", "mangé", "regardé", "visité", "joué"], exp: "Use o passé composé: j'ai fait, je suis allé(e), on a regardé…" }
    ],
    B1: [
      { t: "mc", q: "Si j'avais plus de temps, j'___ une nouvelle langue.", op: ["apprendrais", "apprendrai", "apprenais", "aurais appris"], r: 0, exp: "Si + imparfait → conditionnel présent: j'apprendrais." },
      { t: "gap", q: "Il faut que tu ___ ce dossier avant vendredi.", dica: "finir", resp: ["finisses"], exp: "Il faut que + subjonctif: que tu finisses." },
      { t: "mc", q: "C'est le livre ___ je t'ai parlé hier.", op: ["dont", "que", "qui", "où"], r: 0, exp: "Parler DE quelque chose → pronome relativo dont." },
      { t: "order", palavras: ["Je", "ne", "pense", "pas", "que", "ce", "soit", "une", "bonne", "idée"], resp: "Je ne pense pas que ce soit une bonne idée", exp: "Opinião negativa (je ne pense pas que) pede subjonctif: ce soit." },
      { t: "gap", q: "Elle a trouvé un emploi ___ sa formation en informatique.", dica: "graças a", resp: ["grâce à"], exp: "Grâce à = causa positiva; à cause de = causa negativa." },
      { t: "speak", modo: "responder", q: "Responda falando, dando sua opinião e uma justificativa.", frase: "Selon vous, est-ce que le télétravail est une bonne chose ?", modelo: "À mon avis, le télétravail est une bonne chose parce qu'on gagne du temps. Cependant, on peut se sentir isolé.", min: 12, chave: ["à mon avis", "je pense", "je trouve", "selon moi", "parce que", "car", "cependant", "mais", "pourtant"], exp: "Dê a opinião (à mon avis…) e justifique (parce que…), com uma nuance (cependant…)." }
    ],
    B2: [
      { t: "mc", q: "Bien qu'il ___ beaucoup travaillé, il n'a pas obtenu la promotion.", op: ["ait", "a", "avait", "aura"], r: 0, exp: "Bien que + subjonctif (aqui no passado: qu'il ait travaillé)." },
      { t: "gap", q: "Les mesures ___ par le gouvernement ont été critiquées.", dica: "prendre (particípio)", resp: ["prises"], exp: "Particípio usado como adjetivo concorda: les mesures (fem. pl.) prises." },
      { t: "mc", q: "Ce projet est ambitieux ; ___, son financement reste incertain.", op: ["en revanche", "par conséquent", "c'est pourquoi", "de plus"], r: 0, exp: "Oposição entre ideias: en revanche (por outro lado)." },
      { t: "gap", q: "Il m'a dit qu'il ___ le lendemain. (venir)", resp: ["viendrait"], exp: "Discurso indireto no passado: futuro vira conditionnel (il viendrait)." },
      { t: "order", palavras: ["Il", "est", "essentiel", "que", "chacun", "prenne", "ses", "responsabilités"], resp: "Il est essentiel que chacun prenne ses responsabilités", exp: "Il est essentiel que + subjonctif (prenne)." },
      { t: "speak", modo: "responder", q: "Responda falando, com pelo menos duas frases argumentadas.", frase: "Faut-il interdire les voitures dans le centre des grandes villes ?", modelo: "D'un côté, interdire les voitures réduirait la pollution et le bruit. De l'autre, il faudrait améliorer les transports en commun avant de prendre une telle mesure.", min: 18, chave: ["d'un côté", "de l'autre", "en revanche", "cependant", "il faudrait", "réduirait", "permettrait", "à mon avis", "néanmoins"], exp: "Estrutura de B2: apresente os dois lados (d'un côté… de l'autre…) e use o conditionnel para propostas." }
    ],
    C1: [
      { t: "mc", q: "___ les efforts déployés, les résultats restent décevants.", op: ["Malgré", "Bien que", "Quoique", "Pourtant"], r: 0, exp: "Malgré + substantivo; bien que/quoique + oração no subjonctif." },
      { t: "gap", q: "C'est la solution à ___ nous avions pensé dès le départ.", resp: ["laquelle"], exp: "Penser À quelque chose + pronome relativo composto feminino: à laquelle." },
      { t: "mc", q: "Le rapport ___ en évidence les failles du système.", op: ["met", "pose", "tient", "porte"], r: 0, exp: "Expressão fixa: mettre en évidence (evidenciar)." },
      { t: "gap", q: "Nul ne conteste que cette réforme ___ nécessaire. (être)", resp: ["soit"], exp: "Nul ne conteste que (negação de dúvida/contestação) + subjonctif: soit." },
      { t: "order", palavras: ["Encore", "faudrait-il", "que", "les", "moyens", "suivent"], resp: "Encore faudrait-il que les moyens suivent", exp: "Encore + inversão = 'ainda seria preciso que…', ressalva típica do registro formal." },
      { t: "speak", modo: "repetir", q: "Leia a frase em voz alta.", frase: "Force est de constater que les inégalités se sont creusées ces dernières années.", exp: "Faça a ligação 'se sont‿creusées' e não pronuncie o 's' final de 'années'." }
    ],
    C2: [
      { t: "mc", q: "Pour peu qu'on ___ les chiffres de près, l'argument s'effondre.", op: ["examine", "examinera", "examinait", "a examiné"], r: 0, exp: "Pour peu que (basta que) + subjonctif." },
      { t: "gap", q: "Quelles que ___ les difficultés, nous mènerons ce projet à terme.", resp: ["soient"], exp: "Quel(le)s que + être no subjonctif, concordando com o sujeito: quelles que soient les difficultés." },
      { t: "mc", q: "Son discours, pour le moins ___, n'a convaincu personne.", op: ["alambiqué", "limpide", "concis", "percutant"], r: 0, exp: "'Pour le moins' introduz uma crítica atenuada; alambiqué = rebuscado, confuso." },
      { t: "gap", q: "Il n'est pas exclu que le ministre ___ sa démission. (remettre, passé)", resp: ["ait remis"], exp: "Il n'est pas exclu que + subjonctif passé: qu'il ait remis." },
      { t: "speak", modo: "responder", q: "Responda falando, desenvolvendo e nuançando a sua opinião.", frase: "Dans quelle mesure l'intelligence artificielle menace-t-elle la création artistique ?", modelo: "Dans une certaine mesure, l'IA bouleverse la création, puisqu'elle produit des œuvres en quelques secondes. Toutefois, il serait réducteur d'y voir une simple menace : elle peut aussi devenir un outil au service des artistes.", min: 25, chave: ["dans une certaine mesure", "toutefois", "néanmoins", "il serait", "certes", "en revanche", "dès lors", "force est de constater", "puisque"], exp: "Use estruturas de C2: concessão (certes… toutefois…), nuance (dans une certaine mesure) e conditionnel (il serait réducteur de…)." }
    ]
  };

  window.LA_FRANCES = {
    k: "frances", nome: "Francês", bandeira: "🇫🇷", prova: "DELF/DALF", provaCurta: "DELF/DALF", lang: "fr-FR", materia: "Francês",
    metaPadrao: "B2", placeholder: "Écrivez votre texte ici…",
    aviso: "Curso no formato das provas DELF e DALF (A1 a C2). Conteúdo próprio do Logic Academy, sem vínculo com a France Éducation international nem com o Ministério da Educação da França.",
    NIVEIS, EXAME, METAS, COMPETENCIAS, NIVELAMENTO, AULAS_POR_TRILHA, arquivo
  };
  (window.LA_IDIOMAS = window.LA_IDIOMAS || {}).frances = window.LA_FRANCES;
})();
