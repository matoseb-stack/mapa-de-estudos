// Biblioteca de cenas. Cada cena recebe o kit (k) e o sorteador (r) e dura ~6–10 s.
// "comunidade: true" marca as cenas com interação entre usuários (fictícios, só no vídeo).
const um=(r,l)=>l[Math.floor(r()*l.length)];
const EU="demo_eu",cidCom=o=>[EU,o].sort().join("_");

// conta já pronta (sem passar pelo cadastro): perfil, plano e alguns dias de estudo para as telas não ficarem vazias
async function prepararConta(k,nome){
  await k.ate(`S.mode==="nuvem"&&!!S.draft||!!S.plano`,15000);
  await k.E(`(()=>{const d=S.draft||perfilPadrao(${JSON.stringify(nome)});d.nome=${JSON.stringify(nome)};d.categoria="vestibular";d.detalhe="Medicina";d.temProva=true;d.nomeProva="ENEM";
    d.dataProva=new Date(Date.now()+48*864e5).toISOString().slice(0,10);
    d.materias=[["Matemática",4,"alta"],["Biologia",3,"alta"],["Química",4,"media"],["Física",3,"media"],["Redação",2,"alta"],["História",2,"baixa"]].map(([n,dif,prio],i)=>({id:"m"+i,nome:n,dif,prio}));
    S.perfil=d;S.plano=planoLocal(d);S.plano.geradoPor="local";S.plano.criadoEm=new Date().toISOString();
    const L={dias:{},sessoes:0,hist:[]},mats=d.materias.map(m=>m.nome);
    for(let i=1;i<12;i++){const iso=diasAtras(i),m={};let t=0;mats.forEach((n,j)=>{if((i+j)%3===0){const v=25+((i*7+j*11)%40);m[n]=v;t+=v}});L.dias[iso]={min:t,mat:m,q:6+i%9,acertos:4+i%6};L.sessoes+=3}
    L.dias[dataISO()]={min:75,mat:{"Matemática":50,"Biologia":25},q:12,acertos:9};
    S.pomoLog=garantirTotais(L);["perfil","plano","pomo"].forEach(x=>gravar(x,{perfil:S.perfil,plano:S.plano,pomo:S.pomoLog}[x],true));
    S.tutPerguntou=true;S.view="inicio";renderShell()})()`);
  await k.w(900);await k.prep()}

const CENAS={
  // ---------- estudo ----------
  cadastro:{inicio:true,async run(k,r,o){
    await k.cap(um(r,["Responde <em>4 perguntinhas</em>…","Conta o que você estuda <em>em segundos</em>"]));await k.w(400);
    await k.digitar("#q-nome",o.nome.split(" ")[0],100);await k.tap('[data-cat="vestibular"]');
    if(await k.existe("#q-det"))await k.digitar("#q-det",um(r,["Medicina","Direito","Engenharia","Psicologia"]),60);
    await k.tap("#q-next",{depois:500});await k.topo();
    await k.cap("Escolhe <em>suas matérias</em> 📚");await k.w(300);
    for(let i=0;i<5;i++){const s=k.p.locator("[data-sug]").first();if(!await s.count())break;await k.tap(s,{depois:240})}
    await k.tap("#q-next",{depois:400});await k.topo();await k.w(500);await k.tap("#q-next",{depois:400});await k.topo();await k.w(400);await k.tap("#q-next",{depois:200});
    await k.cap(um(r,["…e recebe o <em>plano da semana</em> pronto ✨","Pronto: <em>plano da semana</em> montado ✨"]));
    await k.ate(`S.view==="semana"&&!!S.plano`,12000);await k.prep();await k.w(1100);await k.rolar(600,1000);await k.w(400)}},
  plano:{async run(k,r){await k.E(`go("semana")`);await k.prep();
    await k.cap(um(r,["Seu <em>plano da semana</em> montado sozinho 📅","Cada dia com o que estudar e <em>a que horas</em> 📅"]));await k.w(1300);await k.rolar(650,1100);await k.w(500)}},
  pomodoro:{async run(k,r){await k.E(`go("pomodoro")`);await k.prep();
    await k.cap(um(r,["<em>Pomodoro</em> pra focar de verdade ⏱️","25 min de foco, 5 de pausa: <em>pomodoro</em> ⏱️"]));await k.w(600);
    if(await k.existe("#pomo-play"))await k.tap("#pomo-play");await k.w(2200)}},
  questao:{async run(k,r){
    const n=await k.E("QB_TOTAL");
    await k.cap(um(r,[`<em>+${n.toLocaleString("pt-BR")} questões</em> do ENEM, EsPCEx e mais`,`Questões oficiais <em>com gabarito</em> 📝`]));
    await k.E(`if(S.qb){S.qb.sel=null;S.qb.mostrar=null}`);await k.tap('.tabbar [data-go="questoes"]');await k.prep();await k.p.waitForSelector(".qb-item",{timeout:12000});await k.w(500);await k.rolar(350,600);
    await k.tap(k.p.locator(".qb-item").nth(1+Math.floor(r()*4)),{depois:400});await k.topo();await k.w(900);
    await k.cap("Responde e já vê se <em>acertou</em> ✅");const alts=k.p.locator("[data-qalt]");await alts.first().scrollIntoViewIfNeeded();await k.rolar(250,500);
    const certa=await k.E(`(()=>{const x=qbLista().find(y=>y.id===S.qb.sel);return x?x.r:0})()`);
    await k.tap(alts.nth(certa));await k.tap("#qb-resp",{depois:500});
    await k.cap("Selo de <em>✓ Resolvida</em> e caderno de erros 👆",true);await k.w(250);await k.E(`scrollTo({top:0,behavior:"smooth"})`);await k.w(1900)}},
  mentoria:{async run(k,r){await k.E(`go("mentoria")`);await k.prep();
    await k.cap(um(r,["Tem uma <em>mentora com IA</em> que vê seus estudos 🤖","Pergunta pra <em>mentoria com IA</em> o que revisar 🤖"]));await k.w(700);
    await k.tap(k.p.locator("[data-sug-mt]").nth(Math.floor(r()*3)),{depois:300});
    await k.ate(`!S.mentor.ocupado`,15000);await k.w(1600)}},
  molduras:{async run(k,r){await k.E(`S.desTab="colecao";go("desafios")`);await k.prep();
    await k.cap(um(r,["Desafios dão <em>XP</em> e <em>molduras</em> pro perfil 🏆","Sobe de nível e ganha <em>molduras</em> 🏆"]));await k.w(800);
    await k.rolar(380,700);const b=k.p.locator('[data-equipar^="moldura:"]').first();if(await b.count())await k.tap(b,{depois:600});await k.w(900)}},
  estatisticas:{async run(k,r){await k.E(`go("estatisticas")`);await k.prep();
    await k.cap(um(r,["Vê <em>quanto estudou</em> de cada matéria 📊","Suas horas e acertos em <em>gráficos</em> 📊"]));await k.w(1100);await k.rolar(700,1300);await k.w(500)}},
  convite:{async run(k,r){
    await k.E(`DEMO.set("indicacoes/u_davi",{por:"${EU}",em:DEMO.ts()})`);await k.E(`go("inicio")`);await k.prep();await k.w(500);
    await k.E(`document.getElementById("convite").scrollIntoView({block:"center",behavior:"smooth"})`);
    await k.cap(um(r,["Convida um amigo e ganha <em>XP + moldura especial</em> 🎁","Amigo entrou pelo seu link? <em>Moldura exclusiva</em> 🎁"]),true);await k.w(1200);
    await k.tap(k.p.locator("[data-cv-mold]").nth(Math.floor(r()*3)),{depois:300});await k.w(2600);
    if(await k.existe('[data-c="ok"]'))await k.tap('[data-c="ok"]',{depois:300})}},
  // ---------- comunidade (usuários fictícios, só no vídeo) ----------
  chatAoVivo:{comunidade:true,async run(k,r){await k.E(`go("chat")`);await k.prep();
    await k.cap(um(r,["<em>Chat</em> com estudantes do Brasil todo 💬","Ninguém estuda sozinho aqui 💬"]));await k.w(900);
    const falas=um(r,[[["u_lucas","Alguém aí estudando agora? 👀"],["u_gabi","Eu! Pomodoro 3 de hoje 🍅"]],[["u_joao","Simulado concluído: 38 acertos 🔥"],["u_bia","Monstro!! Bora pra 40 amanhã"]],[["u_mari","Quem topa uma chamada pra estudar Química?"],["u_rafa","Tô dentro! 20h?"]]]);
    for(const [a,t] of falas){await k.E(`DEMO.add("chat",{autor:"${a}",texto:${JSON.stringify(t)},em:Date.now()})`);await k.w(1100)}
    await k.digitar('[data-composer="chatg"] input[type=text]',um(r,["Eu também! Bora 🚀","Contem comigo 💪","Partiu estudar!"]),70);
    await k.p.keyboard.press("Enter");await k.w(1300)}},
  enviarQuestao:{comunidade:true,async run(k,r){
    await k.cap(um(r,["Achou uma questão difícil? <em>Manda pros amigos</em> 📤","Manda a questão <em>direto no grupo</em> 📤"]));
    await k.E(`if(S.qb){S.qb.sel=null;S.qb.mostrar=null}`);await k.tap('.tabbar [data-go="questoes"]');await k.prep();await k.p.waitForSelector(".qb-item",{timeout:12000});await k.w(400);
    await k.tap(k.p.locator(".qb-item").nth(Math.floor(r()*5)),{depois:400});await k.topo();await k.w(700);
    await k.tap("#qb-enviar",{depois:500});await k.tap('[data-qdest="g:g_medicina"]',{depois:900});await k.tap('[data-qe="x"]',{depois:300});
    await k.E(`S.grupoAberto="g_medicina";FBC.grupoTab="chat";go("grupos")`);await k.prep();
    await k.cap("Todo mundo <em>responde ali mesmo</em> ✅");await k.w(1400);
    await k.E(`DEMO.add("grupos/g_medicina/mensagens",{autor:"u_lucas",texto:${JSON.stringify(um(r,["Acertei de primeira 😎","Essa é pegadinha! Errei 😅","Letra C, certeza!"]))},em:Date.now()})`);
    await k.w(1300);await k.E(`DEMO.add("grupos/g_medicina/mensagens",{autor:"u_bia",texto:"Mais uma! Manda outra 🔥",em:Date.now()})`);await k.w(1400)}},
  chamada:{comunidade:true,async run(k,r){await k.E(`go("amigos")`);await k.prep();
    await k.cap(um(r,["Vê quem está <em>online</em> agora 🟢","Seus amigos <em>estudando agora</em> 🟢"]));await k.w(1300);
    await k.cap("E faz <em>chamada de vídeo</em> pra estudar junto 📹");
    await k.E(`DEMO.set("chamadas/${EU}",{de:"u_lucas",nome:"Lucas Ferreira",canal:"dm_${cidCom("u_lucas")}",em:Date.now(),video:true})`);await k.w(2600);
    if(await k.existe('[data-ch="nao"]'))await k.tap('[data-ch="nao"]',{depois:500})}},
  conversa:{comunidade:true,async run(k,r){await k.E(`FBC.dm=null;go("mensagens")`);await k.prep();
    await k.cap(um(r,["<em>Mensagens privadas</em> com os amigos ✉️","Combina os estudos <em>no privado</em> ✉️"]));await k.w(700);
    await k.tap('[data-conv="u_lucas"]',{depois:700});
    await k.digitar('[data-composer="dm"] input[type=text]',um(r,["Bora revisar Genética às 19h?","Fiz 30 questões hoje! E você?","Me ajuda com essa de Física?"]),60);
    await k.p.keyboard.press("Enter");await k.w(1100);
    const resp=um(r,["Bora!! Te chamo no vídeo 📹","Fiz 25, amanhã te alcanço 😂","Claro! Manda aí"]);
    await k.E(`(()=>{const c="conversas/${cidCom("u_lucas")}";DEMO.add(c+"/mensagens",{autor:"u_lucas",texto:${JSON.stringify(resp)},em:Date.now()});DEMO.merge(c,{atualizado:Date.now(),ultima:${JSON.stringify(resp)},ultimaDe:"u_lucas"})})()`);
    await k.w(1700)}},
  ranking:{comunidade:true,async run(k,r){await k.E(`go("ranking")`);await k.prep();
    await k.cap(um(r,["<em>Ranking</em> de quem mais estudou hoje 🏅","Disputa saudável no <em>ranking</em> 🏅"]));await k.w(1300);await k.rolar(550,1100);await k.w(700)}},
  grupo:{comunidade:true,async run(k,r){await k.E(`S.grupoAberto=null;go("grupos")`);await k.prep();
    await k.cap(um(r,["<em>Comunidades</em> pra cada objetivo 👥","Entra em <em>grupos de estudo</em> 👥"]));await k.w(1000);
    await k.tap('[data-abrir="g_medicina"]',{depois:900});
    await k.E(`DEMO.add("grupos/g_medicina/mensagens",{autor:"u_gabi",texto:"Meta batida: 40 questões de Bio ✅",em:Date.now()})`);await k.w(1200);
    await k.tap('[data-gtab="ranking"]',{depois:600});await k.cap("Com <em>ranking</em> só do grupo 🏆");await k.w(1600)}},
};
// respostas da mentoria de demonstração
function iaDemo(q){q=String(q||"").toLowerCase();
  if(/semana/.test(q))return "**Sua semana foi boa! 💪**\n\n- Você estudou **6h40** em 5 dias\n- Matemática foi a matéria com mais tempo\n- Faltou um pouco de **História**\n\n**Para a próxima semana:** 2 blocos de História e 20 questões de Química.";
  if(/revisar|hoje/.test(q))return "**Para hoje, sugiro:**\n\n1. 25 min revisando **Genética** (você errou 3 questões ontem)\n2. 20 questões de **Funções** no banco\n3. 1 redação curta sobre o tema da semana\n\nVocê consegue! 🚀";
  if(/plano|7 dias|dias/.test(q))return "**Plano dos próximos 7 dias:**\n\n- Seg: Matemática + Biologia\n- Ter: Química + Redação\n- Qua: Física + questões\n- Qui: Biologia + revisão\n- Sex: simulado curto\n\nDescanse no domingo 😉";
  return "**Onde você mais erra:**\n\n- **Química orgânica** (55% de acerto)\n- **Física: eletricidade** (60%)\n\nResolva 10 questões de cada tema hoje e revise os erros no caderno de erros. 📚"}
module.exports={CENAS,prepararConta,iaDemo};
