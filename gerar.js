#!/usr/bin/env node
// Gera o vídeo do dia para o TikTok (9:16, 1080x1920, MP4) e o carrossel do Instagram (6 imagens 1080x1350),
// os dois na estética do palco (palco.html): app dentro de um celular, fundo de luzes, capítulos, títulos e adesivos.
// uso: node gerar.js --repo /caminho/do/site [--data 2026-10-07] [--saida ./videos] [--cenas chatAoVivo,questao,...] [--tema light|dark] [--velocidade 1.15]
// A mistura de cenas, a frase de abertura, o tema e o nome mudam conforme a data (o mesmo dia gera sempre o mesmo roteiro).
const fs=require("fs"),path=require("path");
const {abrir}=require("./base.js"),{CENAS,prepararConta,iaDemo}=require("./cenas.js"),{criar,PALCO,paraTitulo}=require("./palco-kit.js"),{montarCarrossel}=require("./carrossel.js");
const {execFileSync}=require("child_process");
// rótulo do capítulo e adesivo de cada cena (o adesivo aparece no vídeo e no carrossel)
const INFO={cadastro:["Comece em 1 minuto",["⚡ 4 perguntas","amar"]],plano:["Plano da semana",["📅 automático","azul"]],pomodoro:["Foco",["🍅 25 min de foco","rosa"]],
  questao:["Questões oficiais",["✅ com gabarito","azul"]],mentoria:["Mentoria com IA",["🤖 responde na hora","roxo"]],molduras:["Desafios",["🏆 XP e molduras","amar"]],
  estatisticas:["Estatísticas",["📊 por matéria","azul"]],convite:["Convide amigos",["🎁 +150 XP","amar"]],chatAoVivo:["Chat ao vivo",["💬 ao vivo","rosa"]],
  enviarQuestao:["Estude em grupo",["📤 manda pro grupo","roxo"]],chamada:["Chamada de vídeo",["📹 estude junto","rosa"]],conversa:["Mensagens",["✉️ no privado","azul"]],
  ranking:["Ranking",["🏅 top do dia","amar"]],grupo:["Comunidades",["👥 grupos de estudo","roxo"]]};
const POS=[[16,320],[-16,300],[20,480],[-20,470]];
const arg=n=>{const i=process.argv.indexOf("--"+n);return i>0?process.argv[i+1]:null};
const REPO=path.resolve(arg("repo")||".."),DATA=arg("data")||new Date(Date.now()-3*3600e3).toISOString().slice(0,10),SAIDA=path.resolve(arg("saida")||path.join(__dirname,"videos"));
let h=0;for(const c of "logic"+DATA)h=Math.imul(h^c.charCodeAt(0),2654435761)>>>0;
const r=(()=>{let a=h;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}})();
const um=l=>l[Math.floor(r()*l.length)];
const embaralha=l=>{const a=l.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const nDia=Math.floor(Date.parse(DATA+"T12:00:00Z")/864e5);
const TEMA=arg("tema")||(nDia%2?"dark":"light");
const NOME=um(["Ana Souza","Júlia Martins","Pedro Henrique","Larissa Oliveira","Matheus Carvalho","Sofia Ribeiro","Gustavo Nunes","Isabela Freitas"]);
const GANCHOS=[
  "Seus estudos pro <em>ENEM</em> organizados em <em>1 minuto</em>","POV: você achou o app que faz você <em>estudar todo dia</em>",
  "Estudar sozinho é difícil. <em>Com amigos</em> fica fácil","Pare de estudar <em>sem plano</em>","O app que transformou meus estudos num <em>jogo</em> 🎮",
  "Quer passar em <em>Medicina</em>? Começa por aqui","+7 mil questões oficiais <em>de graça</em>?! 😳","Como eu estudo <em>3h por dia</em> sem procrastinar",
  "Seu grupo de estudos <em>no celular</em> 👥","Ranking, desafios e <em>amigos</em>: estudar ficou viciante","Organização + foco + comunidade = <em>aprovação</em>",
  "Esse app é o <em>Duolingo do ENEM</em>? 👀"];
(async()=>{
  // escolha das cenas: 2 de comunidade + 2 de estudo (às vezes começando pelo cadastro)
  let nomes=(arg("cenas")||"").split(",").filter(Boolean);
  if(!nomes.length){const com=embaralha(Object.keys(CENAS).filter(c=>CENAS[c].comunidade)).slice(0,2),est=embaralha(Object.keys(CENAS).filter(c=>!CENAS[c].comunidade)).slice(0,2);
    nomes=embaralha([...com,...est]);const ic=nomes.indexOf("cadastro");if(ic>0){nomes.splice(ic,1);nomes.unshift("cadastro")}}
  const nome=`logic-academy-${DATA}`;fs.mkdirSync(SAIDA,{recursive:true});
  console.log(`Dia ${DATA} · tema ${TEMA} · ${NOME} · cenas: ${nomes.join(", ")}`);
  const nav=await abrir({repo:REPO,tema:TEMA,ia:iaDemo,eu:{uid:"demo_eu",nome:NOME},palco:PALCO});const k=criar(nav),P=k.P;
  const gancho=um(GANCHOS),fotos=[];
  try{
    await k.ate(`S.mode==="nuvem"`,20000);await k.w(800);
    if(TEMA==="dark")await k.E(`mudarUI("modo","escuro")`).catch(()=>{});
    if(nomes[0]==="cadastro"){await k.ate(`!!document.querySelector("#q-nome")`,15000);await k.prep()}else await prepararConta(k,NOME);
    if(TEMA==="dark")await k.E(`mudarUI("modo","escuro")`).catch(()=>{});
    await k.prep();await k.topo();await k.w(400);
    const n=await k.E("QB_TOTAL");
    await P("barras",nomes.length);
    await k.full(`<div class="lg">L</div><span class="carimbo">GRÁTIS</span><h1>${gancho}</h1><p>Plano da semana, pomodoro, +${n.toLocaleString("pt-BR")} questões e comunidade.</p>`);
    await k.w(500);await k.gravar();
    await k.w(2300);await k.full(null);await k.w(300);
    for(const [i,c] of nomes.entries()){if(!CENAS[c])throw new Error("cena desconhecida: "+c);
      const [tag,ad]=INFO[c]||[c,null];k.tag=tag;k.ultimaCap="";
      await k.E(`document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`).catch(()=>{});
      await P("numero",String(i+1).padStart(2,"0"),tag);await k.w(650);await P("capitulo",i,7500);
      if(ad){const [x,y]=POS[i%POS.length];await P("adesivo","cena",ad[0],x,y,{cor:ad[1],r:x<0?6:-6,balanca:true})}
      try{await CENAS[c].run(k,r,{nome:NOME});await k.prep()}catch(e){console.warn("cena",c,"falhou:",e.message);await k.E(`document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`).catch(()=>{})}
      // foto limpa da tela para o carrossel (sem adesivos nem toques por cima)
      await P("limpa");await k.w(700);
      try{fotos.push({tag,titulo:k.ultimaCap||tag,foto:await k.foto(),adesivo:ad})}catch(e){}}
    await P("titulo","","");
    await k.full(`<div class="lg">L</div><h1>Logic <em>Academy</em></h1><p>${um(["Organize seus estudos, resolva questões e estude com os amigos.","Plano, foco, questões e comunidade num só lugar.","Estude todo dia. Com amigos, fica mais fácil."])}</p>
      <div class="tags"><b>📅 Plano da semana</b><b>⏱️ Pomodoro</b><b>📝 Questões</b><b>👥 Comunidades</b><b>📹 Chamadas</b><b>🤖 Mentoria IA</b></div>
      <div class="url">logicacademy.web.app</div><p style="font-size:16px">Grátis · link na bio</p><p class="nota">Imagens ilustrativas · usuários e conversas fictícios</p>`);
    await k.w(3300);await k.parar();
    const res=k.montar(SAIDA,nome);
    // acelera um pouco (padrão 1,15×) para o ritmo do TikTok
    const vel=+(arg("velocidade")||1.15);
    if(vel!==1){const tmp=res.mp4.replace(/\.mp4$/,"-tmp.mp4");fs.renameSync(res.mp4,tmp);
      execFileSync("ffmpeg",["-y","-loglevel","error","-i",tmp,"-filter:v",`setpts=PTS/${vel},fps=30`,"-c:v","libx264","-preset","slow","-crf","18","-profile:v","high","-pix_fmt","yuv420p","-movflags","+faststart","-an",res.mp4]);
      fs.rmSync(tmp);res.dur/=vel}
    // carrossel do Instagram na mesma estética
    let carrossel=[];
    if(fotos.length>=2)try{carrossel=await montarCarrossel({ctx:nav.ctx,saida:SAIDA,nome,
      capa:{tag:"Logic Academy",titulo:paraTitulo(gancho),sub:`Plano da semana, pomodoro, +${n.toLocaleString("pt-BR")} questões e comunidade. Grátis.`},
      telas:fotos.slice(0,4),
      fim:{titulo:"Comece *hoje*, de graça",sub:"Organize seus estudos, resolva questões e estude com os amigos.",chips:["📅 Plano da semana","⏱️ Pomodoro","📝 Questões","👥 Comunidades","🤖 Mentoria IA","🇬🇧🇫🇷 Idiomas"]}})}
      catch(e){console.warn("carrossel falhou:",e.message)}
    const tags="#enem #enem2026 #estudos #vestibular #medicina #studytok #dicasdeestudo #pomodoro #concurso #foco";
    const legenda=`${um(["Seu próximo ano de estudos começa aqui 📚","Estudar com amigos muda tudo 👥","Bora bater a meta de hoje? 🚀","Organização é metade da aprovação ✅"])}\n\nPlano da semana, pomodoro, +${n.toLocaleString("pt-BR")} questões oficiais, comunidades e mentoria com IA. Grátis em logicacademy.web.app (link na bio).\n\n${tags}\n`;
    fs.writeFileSync(path.join(SAIDA,nome+"-legenda.txt"),legenda);
    if(carrossel.length)fs.writeFileSync(path.join(SAIDA,nome+"-carrossel-legenda.txt"),`${paraTitulo(gancho).replace(/\*/g,"")} 👇\n\nArrasta pro lado e vê como funciona: ${fotos.slice(0,4).map(f=>f.tag.toLowerCase()).join(", ")}. Grátis em logicacademy.web.app (link na bio).\n\nSalva esse post e manda pra quem estuda com você 📚\n\n#enem #enem2026 #estudos #vestibular #medicina #studygram #dicasdeestudo #pomodoro #concurso #foco\n`);
    fs.writeFileSync(path.join(SAIDA,nome+"-roteiro.json"),JSON.stringify({data:DATA,tema:TEMA,nome:NOME,cenas:nomes,duracao:+res.dur.toFixed(1),carrossel:carrossel.map(f=>path.basename(f)),erros:nav.erros},null,1));
    console.log(`OK ${res.mp4} · ${res.dur.toFixed(1)} s · ${res.quadros} quadros\nconferência: ${res.folha}\ncarrossel: ${carrossel.length} imagens`);
    if(nav.erros.length)console.log("Erros na página:",nav.erros.slice(0,5));
  }finally{await nav.fechar()}
})().catch(e=>{console.error("FALHOU:",e);process.exit(1)});
