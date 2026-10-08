/* Conteúdo de Inglês no formato das provas Cambridge (KEY/A2, PET/B1, FCE/B2, CAE/C1, CPE/C2).
   Faixas: "A" (A1–A2), "B1", "B2", "C" (C1–C2). Cada faixa tem um módulo por competência.
   FIREBASE REAL: este conteúdo pode vir de uma coleção "idiomas/ingles/modulos" para crescer sem novo deploy. */
(function () {
  "use strict";
  const NIVEIS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const FAIXA = { A1: "A", A2: "A", B1: "B1", B2: "B2", C1: "C", C2: "C" };
  const EXAME = { A1: "Pre A1–A1 Movers/Flyers", A2: "A2 Key (KET)", B1: "B1 Preliminary (PET)", B2: "B2 First (FCE)", C1: "C1 Advanced (CAE)", C2: "C2 Proficiency (CPE)" };

  // Teste de nivelamento: 3 itens por nível, do mais fácil ao mais difícil
  const NIVELAMENTO = [
    { n: "A1", q: "I ___ a student.", op: ["am", "is", "are", "be"], r: 0 },
    { n: "A1", q: "There ___ two books on the table.", op: ["is", "are", "be", "am"], r: 1 },
    { n: "A1", q: "She ___ to school every day.", op: ["go", "goes", "going", "gone"], r: 1 },
    { n: "A2", q: "I ___ to the cinema last night.", op: ["go", "have gone", "went", "was go"], r: 2 },
    { n: "A2", q: "This is ___ book I have ever read.", op: ["the more interesting", "the most interesting", "most interesting", "the interestingest"], r: 1 },
    { n: "A2", q: "We ___ dinner when the phone rang.", op: ["had", "were having", "have", "are having"], r: 1 },
    { n: "B1", q: "If I ___ more time, I would learn Japanese.", op: ["have", "had", "will have", "would have"], r: 1 },
    { n: "B1", q: "She has lived here ___ 2015.", op: ["for", "since", "during", "from"], r: 1 },
    { n: "B1", q: "The film was ___ boring that we left early.", op: ["such", "too", "so", "very"], r: 2 },
    { n: "B2", q: "By the time we arrived, the train ___.", op: ["left", "has left", "had left", "was leaving"], r: 2 },
    { n: "B2", q: "I'm not used to ___ up so early.", op: ["get", "getting", "got", "have got"], r: 1 },
    { n: "B2", q: "He denied ___ the window.", op: ["to break", "breaking", "break", "broke"], r: 1 },
    { n: "C1", q: "No sooner ___ sat down than the phone rang.", op: ["I had", "had I", "I have", "have I"], r: 1 },
    { n: "C1", q: "The proposal was turned ___ by the committee.", op: ["off", "down", "over", "out"], r: 1 },
    { n: "C1", q: "Everyone expects her to win: she is ___ to get the award.", op: ["bound", "due", "about", "apt"], r: 0 },
    { n: "C2", q: "His remarks were ___ to cause offence.", op: ["calculated", "considered", "estimated", "reckoned"], r: 0 },
    { n: "C2", q: "Little ___ that his life was about to change.", op: ["he knew", "did he know", "knew he", "he did know"], r: 1 },
    { n: "C2", q: "She took the criticism in her ___ and carried on working.", op: ["stride", "step", "pace", "walk"], r: 0 }
  ];
  // pontuação → nível (0–3 A1, 4–6 A2, 7–9 B1, 10–12 B2, 13–15 C1, 16–18 C2)
  function nivelPorPontos(p) { return NIVEIS[Math.min(5, Math.floor(Math.max(0, p - 1) / 3))]; }

  const MODULOS = {
    A: {
      reading: { titulo: "A message from Tom", texto: "Hi Sara,\n\nI'm at my grandmother's house this week. She lives in a small village near the sea. Every morning we walk to the beach with her dog, Max. In the afternoon I help her in the garden. The weather is sunny, but the water is very cold! I'm coming home on Saturday by train. Can you meet me at the station at 4 o'clock?\n\nTom",
        perguntas: [
          { q: "Where is Tom this week?", op: ["At the station", "At his grandmother's house", "At school", "In a big city"], r: 1 },
          { q: "What do they do every morning?", op: ["Work in the garden", "Swim in the sea", "Walk to the beach", "Take the train"], r: 2 },
          { q: "How is the water?", op: ["Warm", "Very cold", "Dirty", "Sunny"], r: 1 },
          { q: "What does Tom ask Sara?", op: ["To call his grandmother", "To visit the village", "To meet him at the station", "To look after Max"], r: 2 }] },
      uso: { titulo: "Use of English — complete the text", itens: [
          { q: "My brother ___ football every Saturday.", op: ["play", "plays", "playing", "is play"], r: 1 },
          { q: "We didn't go out ___ it was raining.", op: ["but", "so", "because", "or"], r: 2 },
          { q: "Can you give ___ the salt, please?", op: ["I", "my", "me", "mine"], r: 2 },
          { q: "There isn't ___ milk in the fridge.", op: ["some", "any", "many", "a"], r: 1 }] },
      listening: { titulo: "At the café", transcricao: "Woman: Good morning! What would you like?\nMan: Can I have a large coffee and a cheese sandwich, please?\nWoman: Of course. That's six pounds fifty.\nMan: Here you are. Oh, and a bottle of water too.\nWoman: Then it's seven pounds twenty, please.",
        perguntas: [
          { q: "What size coffee does the man order?", op: ["Small", "Medium", "Large", "He doesn't order coffee"], r: 2 },
          { q: "What kind of sandwich does he want?", op: ["Chicken", "Cheese", "Egg", "Tuna"], r: 1 }],
        lacunas: [{ frase: "In the end, the man pays ___ pounds twenty.", resp: ["seven", "7"] }] },
      writing: { prompt: "Write an email to your friend Alex (25–35 words). Say:\n• where you want to go on Saturday\n• what you want to do there\n• what time you can meet", min: 25, max: 40, genero: "e-mail curto (KET Part 6)" },
      speaking: { prompt: "Talk about your daily routine. What time do you get up? What do you do in the morning, afternoon and evening? What is your favourite day of the week, and why?", dicas: ["Use: first, then, after that, finally", "Present simple: I get up, I have breakfast…"], segundos: 60 }
    },
    B1: {
      reading: { titulo: "Learning to cook at 16", texto: "When Lucas started secondary school, he could hardly make toast. Two years later, he cooks dinner for his family twice a week. 'It started during the holidays,' he explains. 'My parents were working and I was tired of eating instant noodles, so I watched some videos online and tried an easy pasta recipe.' The first attempt was a disaster: the pasta was too soft and the sauce too salty. But Lucas didn't give up. He now keeps a notebook with recipes he has tested, and he plans to take a cooking course next year. 'Cooking is like science,' he says. 'If something goes wrong, you change one thing and try again.'",
        perguntas: [
          { q: "Why did Lucas start cooking?", op: ["His school offered a course", "He was bored of eating the same easy food", "His parents asked him to", "He wanted to become a chef"], r: 1 },
          { q: "What happened the first time he cooked pasta?", op: ["It was perfect", "He burned the sauce", "The result was bad", "He didn't finish it"], r: 2 },
          { q: "What does Lucas do with recipes now?", op: ["He writes down the ones he has tried", "He sells them online", "He only uses videos", "He invents them all himself"], r: 0 },
          { q: "Why does Lucas compare cooking to science?", op: ["Both need expensive equipment", "You learn by testing and adjusting", "Both are difficult subjects at school", "He prefers science to cooking"], r: 1 }] },
      uso: { titulo: "Use of English — multiple-choice cloze", itens: [
          { q: "I'm really looking forward ___ you next week.", op: ["to see", "seeing", "to seeing", "see"], r: 2 },
          { q: "She asked me where ___.", op: ["did I live", "I lived", "do I live", "I am living"], r: 1 },
          { q: "You ___ wear a uniform at my school; it's the rule.", op: ["mustn't", "have to", "don't have to", "could"], r: 1 },
          { q: "The museum, ___ opened in 1990, is very popular.", op: ["who", "which", "what", "where"], r: 1 }] },
      listening: { titulo: "A school trip announcement", transcricao: "Good morning, everyone. Just a few details about next Friday's trip to the science museum. The coach will leave from the school car park at eight fifteen, so please arrive by eight o'clock. Bring a packed lunch and a bottle of water, because the museum café will be closed for repairs. We'll be back at school at about four thirty. And don't forget to bring the permission form signed by your parents — you can give it to Mrs Clarke in room twelve.",
        perguntas: [
          { q: "Where are the students going?", op: ["To an art gallery", "To the science museum", "To a theatre", "To the zoo"], r: 1 },
          { q: "Why must students bring lunch?", op: ["The café is too expensive", "The café will be closed", "Lunch isn't included in the price", "They will eat on the coach"], r: 1 }],
        lacunas: [{ frase: "Students should arrive by ___ o'clock.", resp: ["eight", "8"] }, { frase: "The permission form goes to Mrs Clarke in room ___.", resp: ["twelve", "12"] }] },
      writing: { prompt: "You see this announcement on an English-language website:\n\n'Articles wanted! The best place in my town. Where is it? What can people do there? Why do you like it?'\n\nWrite your article in about 100 words.", min: 90, max: 120, genero: "article (PET Writing Part 2)" },
      speaking: { prompt: "Some people prefer to study alone; others prefer studying with friends. Which do you prefer, and why? Give examples from your own experience.", dicas: ["Give your opinion: In my opinion… / I prefer… because…", "Add an example: For example, last week…"], segundos: 90 }
    },
    B2: {
      reading: { titulo: "The four-day school week", texto: "In recent years, a growing number of rural school districts in the United States have adopted a four-day week. Supporters argue that the change saves money on transport and heating, and that it helps schools attract teachers who value a longer weekend. Some families also welcome the extra day for medical appointments or part-time work. Critics, however, point out that the remaining days become longer and more tiring, particularly for younger children. Moreover, working parents may struggle to find childcare for the fifth day. Research on academic results is mixed: some studies found no significant difference, while others reported a small decline in maths scores over time. What seems clear is that the success of the model depends heavily on how the extra day is used.",
        perguntas: [
          { q: "According to supporters, one advantage of the four-day week is that it", op: ["improves exam results", "makes recruiting teachers easier", "shortens the school day", "reduces homework"], r: 1 },
          { q: "What problem do critics mention?", op: ["Teachers' salaries rise", "Transport becomes more expensive", "Longer days can exhaust young pupils", "Students lose interest in sport"], r: 2 },
          { q: "What does research show about academic results?", op: ["They clearly improve", "They clearly get worse", "The evidence is not conclusive", "No studies have been done"], r: 2 },
          { q: "The writer's conclusion is that the model", op: ["should be banned", "works only in cities", "depends on how the free day is used", "is already a success everywhere"], r: 2 }] },
      uso: { titulo: "Use of English — Part 1 & 4 style", itens: [
          { q: "The concert was cancelled ___ the heavy rain.", op: ["because", "due to", "despite", "although"], r: 1 },
          { q: "I wish I ___ harder for the exam last month.", op: ["studied", "had studied", "would study", "have studied"], r: 1 },
          { q: "It's high time we ___ a decision.", op: ["make", "made", "will make", "are making"], r: 1 },
          { q: "She succeeded ___ passing the test on her first attempt.", op: ["to", "on", "in", "at"], r: 2 }] },
      listening: { titulo: "Interview with a marine biologist", transcricao: "Interviewer: What first got you interested in the ocean?\nDr Silva: Honestly, it was a holiday when I was nine. I went snorkelling and saw a sea turtle, and I couldn't stop thinking about it. Years later I studied biology, but at university I almost switched to medicine because the job market looked better.\nInterviewer: What made you stay?\nDr Silva: A professor invited me on a research trip to monitor coral reefs. Seeing how quickly the reefs were changing convinced me that this work mattered. These days I spend about three months a year at sea, and the rest of the time analysing data in the lab — which, to be honest, is less glamorous than people imagine.",
        perguntas: [
          { q: "What first made Dr Silva interested in the ocean?", op: ["A documentary", "A childhood holiday experience", "A university course", "Her parents' jobs"], r: 1 },
          { q: "Why did she nearly change course at university?", op: ["Biology was too difficult", "She thought medicine offered better job prospects", "She failed an exam", "Her professor advised her to"], r: 1 },
          { q: "How does she describe her lab work?", op: ["Exciting and glamorous", "Less glamorous than people think", "The best part of her job", "Something she rarely does"], r: 1 }],
        lacunas: [{ frase: "She spends about ___ months a year at sea.", resp: ["three", "3"] }] },
      writing: { prompt: "In your English class you have been discussing technology and education. Now your teacher has asked you to write an essay (140–190 words).\n\n'Should mobile phones be allowed in classrooms?'\n\nNotes — write about: 1. learning  2. distraction  3. your own idea", min: 140, max: 190, genero: "essay (FCE Writing Part 1)" },
      speaking: { prompt: "Compare two ways of spending free time: playing sports outdoors and playing video games. What are the advantages of each? Which do you think is better for teenagers, and why?", dicas: ["Compare: whereas…, on the other hand…", "Speculate: it might be…, I'd say that…"], segundos: 60 }
    },
    C: {
      reading: { titulo: "The paradox of choice", texto: "Conventional wisdom holds that more choice inevitably leads to greater satisfaction. Yet a substantial body of research suggests otherwise. When confronted with an overwhelming array of options, consumers are often less likely to make a purchase at all, and those who do decide frequently report lower satisfaction with their selection. The explanation lies partly in opportunity cost: the more alternatives we reject, the more we are haunted by the nagging suspicion that one of them might have been superior. Critics of this view contend that the effect has been overstated, noting that several attempts to replicate the original experiments yielded inconsistent results. Even so, few would dispute that the sheer volume of decisions modern life demands carries a cognitive toll, and that deliberately limiting one's options can, paradoxically, be liberating.",
        perguntas: [
          { q: "The writer suggests that 'conventional wisdom' about choice is", op: ["fully supported by research", "called into question by evidence", "irrelevant to consumers", "based on opportunity cost"], r: 1 },
          { q: "What does 'opportunity cost' refer to in the text?", op: ["The price of a product", "Regret about the options not chosen", "The time spent shopping", "The cost of replicating studies"], r: 1 },
          { q: "What point do critics make?", op: ["Choice always increases happiness", "The original findings were not consistently replicated", "Consumers never regret their decisions", "Limiting options is harmful"], r: 1 },
          { q: "The writer's final position is best described as", op: ["dismissive", "cautiously persuaded", "strongly opposed", "entirely neutral"], r: 1 }] },
      uso: { titulo: "Use of English — advanced collocations & structures", itens: [
          { q: "Not only ___ late, but he also forgot the documents.", op: ["he arrived", "did he arrive", "he did arrive", "arrived he"], r: 1 },
          { q: "The new policy has come in ___ heavy criticism.", op: ["for", "to", "with", "at"], r: 0 },
          { q: "Were it not ___ her help, we would never have finished.", op: ["of", "for", "with", "by"], r: 1 },
          { q: "His explanation didn't hold ___ under scrutiny.", op: ["on", "up", "out", "back"], r: 1 }] },
      listening: { titulo: "A talk on remote work", transcricao: "When remote work became widespread, many predicted the end of the traditional office. That prediction now seems premature. Productivity studies paint a nuanced picture: focused individual tasks often benefit from working at home, whereas creative collaboration tends to suffer without spontaneous, face-to-face interaction. Consequently, most organisations have settled on hybrid arrangements. The real challenge, I'd argue, is not where people work but how deliberately teams design the time they spend together. Meetings that could have been emails remain the most persistent drain on everyone's attention.",
        perguntas: [
          { q: "What does the speaker say about predictions of the end of the office?", op: ["They were accurate", "They were made too early", "They were ignored", "They came from studies"], r: 1 },
          { q: "According to the speaker, what suffers in remote work?", op: ["Individual focus", "Creative collaboration", "Salaries", "Email communication"], r: 1 },
          { q: "What does the speaker consider the real challenge?", op: ["Choosing an office location", "Designing team time deliberately", "Cutting costs", "Hiring more staff"], r: 1 }],
        lacunas: [{ frase: "Most organisations have settled on ___ arrangements.", resp: ["hybrid"] }] },
      writing: { prompt: "Your class has watched a discussion about the role of social media in politics. Write an essay (220–260 words) discussing two of the following effects, explaining which you think is more significant and giving reasons:\n• access to information\n• polarisation of opinions\n• political participation of young people", min: 220, max: 260, genero: "essay (CAE Writing Part 1)" },
      speaking: { prompt: "'Success is more about persistence than talent.' To what extent do you agree? Develop your answer with examples and consider the opposite point of view.", dicas: ["Hedge and nuance: to a certain extent…, it could be argued that…", "Concede and counter: admittedly…, nevertheless…"], segundos: 120 }
    }
  };
  const COMPETENCIAS = [
    { k: "reading", nome: "Reading & Use of English", desc: "Textos e questões de múltipla escolha, como na prova.", min: 30 },
    { k: "writing", nome: "Writing", desc: "Redação no formato Cambridge, enviada ao mentor.", min: 40 },
    { k: "listening", nome: "Listening", desc: "Áudio com perguntas de múltipla escolha e lacunas.", min: 25 },
    { k: "speaking", nome: "Speaking", desc: "Grave sua resposta em áudio e envie ao mentor.", min: 20 }
  ];
  window.LA_INGLES = { NIVEIS, FAIXA, EXAME, NIVELAMENTO, nivelPorPontos, MODULOS, COMPETENCIAS };
})();
