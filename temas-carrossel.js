// Temas dos carrosséis do Instagram: cada dia um assunto diferente, com texto que convence
// (gancho → dor → solução → prova → como usar → chamada). Imagens do site só onde ajudam ("tela"),
// sempre um recorte limpo (capturas.js). Se o recorte falhar, o slide vira só texto ("seFalhar").
// Formato dos slides:
//   capa   { tag, titulo, sub, emoji }                     titulo/sub aceitam *destaque*
//   lista  { tag, titulo, itens: [..], marca: "✗"|"✓" }   identificação com a dor ou benefícios
//   tela   { tag, titulo, cap, nota, adesivos: [[texto, cor]], seFalhar: {lista…} }
//   passos { tag, titulo, itens: [..] }                    como usar, em 3 passos
//   numeros{ tag, titulo, itens: [[número, rótulo]] }
//   cta    { titulo, sub, chips: [..] }
const CHIPS = ["📅 Plano da semana", "⏱️ Pomodoro", "📝 +7 mil questões", "🤖 Mentoria IA", "👥 Comunidades", "🇬🇧🇫🇷 Idiomas"];
const TEMAS = [
  { id: "mentor", legenda: "Já pensou estudar com um mentor que conhece a sua rotina? 🤖\n\nNo Logic Academy a mentora com IA vê suas horas, matérias e erros e diz o que revisar hoje, monta o plano da semana e tira dúvidas. Grátis para começar.",
    slides: [
      { t: "capa", tag: "Mentoria com IA", titulo: "Já pensou estudar com um *mentor*?", sub: "Alguém que olha seus estudos e diz exatamente *o que fazer hoje*.", emoji: "🤖" },
      { t: "lista", tag: "Você se identifica?", titulo: "Sem orientação, a gente…", marca: "✗", itens: ["Abre o caderno e não sabe por onde começar", "Revisa o que já sabe e foge do que é difícil", "Erra a mesma matéria no simulado de novo", "Estuda muito e sente que não sai do lugar"] },
      { t: "tela", tag: "Mentoria com IA", titulo: "Pergunte e receba um *plano na hora*", cap: "mentoria", nota: "Ela vê suas horas, matérias e erros no app.", adesivos: [["🎯 baseado nos seus erros", "roxo"]],
        seFalhar: { t: "lista", titulo: "A mentora vê seus estudos e responde", marca: "✓", itens: ["O que revisar hoje", "Onde você mais erra", "Plano dos próximos 7 dias"] } },
      { t: "passos", tag: "Como usar", titulo: "3 perguntas para fazer *todo dia*", itens: ["“O que devo revisar hoje?”", "“Onde eu mais erro nas questões?”", "“Monte um plano para os próximos 7 dias”"] },
      { t: "tela", tag: "Tudo conectado", titulo: "O plano vai *direto para a sua semana*", cap: "semana", adesivos: [["📅 com horários", "azul"]],
        seFalhar: { t: "lista", titulo: "E o plano vira rotina", marca: "✓", itens: ["Blocos com horário", "Pomodoro em 1 toque", "Revisões programadas"] } },
      { t: "cta", titulo: "Seu *mentor de estudos* no bolso", sub: "3 perguntas grátis por dia. Sem limite no Pro." }
    ] },
  { id: "esquece", legenda: "Você estuda e esquece tudo dias depois? Não é falta de memória: é falta de revisão 🧠\n\nNo Logic Academy as revisões entram sozinhas na sua semana e as questões erradas viram caderno de erros. Grátis.",
    slides: [
      { t: "capa", tag: "Memória", titulo: "Por que você *esquece* o que estudou?", sub: "Sem revisão, boa parte do conteúdo some da cabeça em poucos dias.", emoji: "🧠" },
      { t: "lista", tag: "O problema", titulo: "O erro que quase todo mundo comete", marca: "✗", itens: ["Estudar uma vez só e seguir em frente", "Reler o resumo e achar que aprendeu", "Deixar a revisão para a véspera da prova"] },
      { t: "passos", tag: "O que funciona", titulo: "Revisão espaçada *1 · 7 · 30*", itens: ["Revise no dia seguinte (5 a 10 min)", "Revise de novo depois de 1 semana", "Faça questões do tema depois de 1 mês"] },
      { t: "tela", tag: "No app", titulo: "As revisões entram *sozinhas* na semana", cap: "semana", adesivos: [["🔁 revisão automática", "roxo"]],
        seFalhar: { t: "lista", titulo: "O app lembra por você", marca: "✓", itens: ["Revisões no dia certo", "Flashcards", "Caderno de erros"] } },
      { t: "tela", tag: "Na prática", titulo: "Errou? A questão vai pro *caderno de erros*", cap: "questao", adesivos: [["✅ com gabarito", "azul"]],
        seFalhar: { t: "lista", titulo: "Questões oficiais com gabarito", marca: "✓", itens: ["ENEM, EsPCEx, PISM e PAS", "Selo de resolvida", "Caderno de erros"] } },
      { t: "cta", titulo: "Estude *uma vez*, lembre na prova", sub: "Plano, revisões e questões num só lugar. Grátis." }
    ] },
  { id: "sozinho", legenda: "Estudar sozinho cansa. Estudar com amigos vicia 👥\n\nGrupos de estudo, chat, chamada de vídeo e ranking no Logic Academy. Chama quem estuda com você!",
    slides: [
      { t: "capa", tag: "Comunidade", titulo: "Estudar sozinho *cansa*. Com amigos, *vicia*.", sub: "Com companhia, fica bem mais fácil manter o ritmo.", emoji: "👥" },
      { t: "lista", tag: "Você se identifica?", titulo: "Estudando sozinho, é comum…", marca: "✗", itens: ["Perder o ritmo depois da primeira semana", "Não ter com quem tirar uma dúvida", "Não saber se está estudando o suficiente"] },
      { t: "tela", tag: "Grupos de estudo", titulo: "Um grupo para *cada objetivo*", cap: "grupo", adesivos: [["💬 chat do grupo", "rosa"]],
        seFalhar: { t: "lista", titulo: "Grupos de estudo", marca: "✓", itens: ["Chat e chamada de vídeo", "Arquivos compartilhados", "Ranking do grupo"] } },
      { t: "tela", tag: "Ranking", titulo: "Uma *disputa saudável* todo dia", cap: "ranking", adesivos: [["🏅 top do dia", "amar"]],
        seFalhar: { t: "lista", titulo: "Ranking e desafios", marca: "✓", itens: ["Quem estudou mais hoje", "Desafios com XP", "Molduras para o perfil"] } },
      { t: "passos", tag: "Como começar", titulo: "Monte seu grupo em *1 minuto*", itens: ["Crie o grupo com o seu objetivo", "Mande o link para os amigos", "Combinem uma meta por dia"] },
      { t: "cta", titulo: "Chama quem estuda *com você*", sub: "Grupos, chat, chamadas e ranking. Grátis." }
    ] },
  { id: "procrastina", legenda: "Procrastina pra começar a estudar? Teste o método dos 25 minutos ⏱️\n\nPomodoro integrado, metas e XP no Logic Academy. Grátis.",
    slides: [
      { t: "capa", tag: "Foco", titulo: "Procrastina? Teste *25 minutos*.", sub: "O truque mais simples para começar a estudar *agora*.", emoji: "⏱️" },
      { t: "lista", tag: "Por que é difícil começar", titulo: "A cabeça trava quando…", marca: "✗", itens: ["A tarefa parece grande demais", "O celular está do lado", "Não existe hora certa para parar"] },
      { t: "passos", tag: "Técnica Pomodoro", titulo: "Como funciona", itens: ["Escolha UMA tarefa pequena", "25 minutos de foco total, sem celular (ou o tempo que funcionar para você)", "5 minutos de pausa. Repita 4 vezes"] },
      { t: "tela", tag: "No app", titulo: "O pomodoro já está *pronto*", cap: "pomodoro", nota: "Você escolhe o tempo: 25, 45 ou 50 minutos.", adesivos: [["🍅 1 toque", "rosa"]],
        seFalhar: { t: "lista", titulo: "Pomodoro integrado", marca: "✓", itens: ["Alarme e pausas", "Conta no ranking", "Vale XP"] } },
      { t: "tela", tag: "Recompensa", titulo: "Cada foco vira *XP e nível*", cap: "nivel", adesivos: [["🏆 suba de nível", "amar"]],
        seFalhar: { t: "numeros", titulo: "Seu progresso", itens: [["XP", "a cada sessão"], ["🔥", "sequência de dias"], ["🏅", "ranking diário"]] } },
      { t: "cta", titulo: "Comece com *um* pomodoro hoje", sub: "Depois do primeiro, o segundo é fácil." }
    ] },
  { id: "plano", legenda: "Estudar sem plano é andar em círculos 📅\n\nResponda 4 perguntas e receba sua semana de estudos pronta, com horários, pomodoro e revisões. Grátis no Logic Academy.",
    slides: [
      { t: "capa", tag: "Organização", titulo: "Pare de estudar *sem plano*", sub: "Sua semana de estudos pronta em *1 minuto*.", emoji: "📅" },
      { t: "lista", tag: "Sem plano…", titulo: "O que acontece", marca: "✗", itens: ["Você estuda o que gosta e foge do que precisa", "Matérias pesadas ficam para depois", "Chega perto da prova sem ter visto tudo"] },
      { t: "passos", tag: "Como funciona", titulo: "Em 4 perguntas", itens: ["Qual prova e quando", "Quais matérias e dificuldade", "Quanto tempo você tem por dia → *semana pronta*"] },
      { t: "tela", tag: "Resultado", titulo: "Cada dia com *o que* e *a que horas*", cap: "semana", adesivos: [["⚡ automático", "azul"]],
        seFalhar: { t: "lista", titulo: "Sua semana pronta", marca: "✓", itens: ["Blocos com horário", "Teoria + exercícios", "Revisões no dia certo"] } },
      { t: "tela", tag: "Acompanhe", titulo: "Veja *quanto* estudou de cada matéria", cap: "estatisticas", adesivos: [["📊 por matéria", "roxo"]],
        seFalhar: { t: "lista", titulo: "Estatísticas", marca: "✓", itens: ["Horas por matéria", "Constância", "Acertos em questões"] } },
      { t: "cta", titulo: "Monte sua semana *agora*", sub: "Leva 1 minuto. É grátis." }
    ] },
  { id: "idiomas", legenda: "Quer passar no Cambridge, no DELF ou no DALF? 🇬🇧🇫🇷\n\n720 aulas do A1 ao C2 no formato das provas, nivelamento, correção da IA e dica da IA quando você trava. No Logic Academy.",
    slides: [
      { t: "capa", tag: "Idiomas", titulo: "Inglês e francês *até a certificação*", sub: "Cambridge, DELF e DALF. Do A1 ao C2.", emoji: "🌍" },
      { t: "numeros", tag: "O curso", titulo: "Tudo no formato da prova", itens: [["720", "aulas de inglês e francês"], ["4", "habilidades: ler, ouvir, escrever, falar"], ["A1→C2", "com simulado em cada trilha"]] },
      { t: "tela", tag: "Travou?", titulo: "A IA dá *o caminho*, não a resposta", cap: "dicaIA", adesivos: [["💡 dica da IA", "roxo"]],
        seFalhar: { t: "lista", titulo: "Dica da IA", marca: "✓", itens: ["O que você está estudando", "Como chegar na resposta", "Por que é assim"] } },
      { t: "lista", tag: "Também tem", titulo: "Treino completo", marca: "✓", itens: ["Fale e o app corrige a pronúncia", "Redação corrigida pelos critérios da prova", "Teste de nível que sobe a cada acerto"] },
      { t: "passos", tag: "Como começar", titulo: "Em 3 passos", itens: ["Escolha o idioma e a prova", "Faça o nivelamento", "Siga a trilha até o simulado"] },
      { t: "cta", titulo: "Comece seu *idioma* hoje", sub: "Nivelamento e aula 1 de cada trilha grátis." }
    ] },
  { id: "questoes", legenda: "Mais de 7 mil questões oficiais com gabarito, de graça 📝\n\nENEM, EsPCEx, PISM e PAS, com selo de resolvida e caderno de erros. No Logic Academy.",
    slides: [
      { t: "capa", tag: "Banco de questões", titulo: "*+7 mil* questões oficiais. *Grátis*.", sub: "ENEM, EsPCEx, PISM e PAS com gabarito.", emoji: "📝" },
      { t: "lista", tag: "Verdade", titulo: "Quem passa faz *muita* questão", marca: "✓", itens: ["Questão mostra o que você realmente sabe", "Treina o tempo de prova", "Ensina o jeito que a banca pergunta"] },
      { t: "tela", tag: "No app", titulo: "Respondeu? Já vê se *acertou*", cap: "questao", adesivos: [["✅ gabarito na hora", "azul"]],
        seFalhar: { t: "lista", titulo: "Banco de questões", marca: "✓", itens: ["Filtros por prova e ano", "Gabarito na hora", "Selo de resolvida"] } },
      { t: "passos", tag: "Método", titulo: "Como estudar por questões", itens: ["Faça um bloco de 10 a 20 questões", "Marque as que errou", "Refaça os erros depois de 1 semana"] },
      { t: "tela", tag: "Estude junto", titulo: "Mande a questão *pro grupo*", cap: "grupo", adesivos: [["📤 1 toque", "rosa"]],
        seFalhar: { t: "lista", titulo: "Estude em grupo", marca: "✓", itens: ["Envie questões no chat", "Discutam a resolução", "Ranking do grupo"] } },
      { t: "cta", titulo: "Resolva sua *primeira* questão hoje", sub: "Grátis, com gabarito." }
    ] },
  { id: "convite", legenda: "Estudar com um amigo ajuda a manter a constância 🤝\n\nChame alguém pelo seu link do Logic Academy: vocês ganham XP e uma moldura especial.",
    slides: [
      { t: "capa", tag: "Com amigos", titulo: "Seu amigo é seu *melhor* método de estudo", sub: "Combinar uma meta com alguém faz você cumprir.", emoji: "🤝" },
      { t: "lista", tag: "Por quê", titulo: "Estudar em dupla ajuda a…", marca: "✓", itens: ["Não faltar ao combinado", "Explicar a matéria (e aprender de verdade)", "Dividir resumos e questões"] },
      { t: "tela", tag: "Convite", titulo: "Convide e ganhe *+150 XP*", cap: "convite", adesivos: [["🎁 moldura especial", "amar"]],
        seFalhar: { t: "lista", titulo: "Convide amigos", marca: "✓", itens: ["+150 XP por amigo", "Moldura especial no perfil", "Estudem juntos no app"] } },
      { t: "passos", tag: "Como fazer", titulo: "Em 3 passos", itens: ["Copie seu link na tela inicial", "Mande para quem estuda com você", "Combinem a meta do dia"] },
      { t: "cta", titulo: "Chama alguém *hoje*", sub: "Estudar junto é mais leve." }
    ] }
];
module.exports = { TEMAS, CHIPS };
