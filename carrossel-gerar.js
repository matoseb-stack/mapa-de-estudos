#!/usr/bin/env node
// Gera só o carrossel do Instagram (sem vídeo). uso: node carrossel-gerar.js --repo ../site [--saida ./videos] [--tema mentor|todos] [--data AAAA-MM-DD]
const fs=require("fs"),path=require("path");
const {abrir}=require("./base.js"),{iaDemo}=require("./cenas.js"),{PALCO}=require("./palco-kit.js"),{abrirCapturas}=require("./capturas.js");
const {montarCarrossel,recortesDoTema}=require("./carrossel.js"),{TEMAS}=require("./temas-carrossel.js");
const arg=n=>{const i=process.argv.indexOf("--"+n);return i>0?process.argv[i+1]:null};
const REPO=path.resolve(arg("repo")||".."),SAIDA=path.resolve(arg("saida")||path.join(__dirname,"videos")),DATA=arg("data")||new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
const nDia=Math.floor(Date.parse(DATA+"T12:00:00Z")/864e5);
const escolha=arg("tema")==="todos"?TEMAS:[TEMAS.find(t=>t.id===arg("tema"))||TEMAS[nDia%TEMAS.length]];
(async()=>{fs.mkdirSync(SAIDA,{recursive:true});
  const nav=await abrir({repo:REPO,ia:iaDemo,eu:{uid:"demo_eu",nome:"Ana Souza"},palco:PALCO});
  try{const c=await abrirCapturas(nav),cache={};
    for(const tema of escolha){const rec={};for(const nm of recortesDoTema(tema)){if(!(nm in cache))cache[nm]=await c.tirar(nm);if(cache[nm])rec[nm]=cache[nm]}
      const nome=`carrossel-${DATA}-${tema.id}`,arqs=await montarCarrossel({ctx:nav.ctx,saida:SAIDA,nome,tema,recortes:rec});
      fs.writeFileSync(path.join(SAIDA,nome+"-legenda.txt"),`${tema.legenda}\n\nlogicacademy.web.app (link na bio) · salva e manda pra quem estuda com você 📚\n\n#enem #enem2026 #estudos #vestibular #medicina #studygram #dicasdeestudo #concurso #foco #organizacao\n`);
      console.log(`OK ${tema.id}: ${arqs.length} imagens · recortes ${Object.keys(rec).join(",")||"nenhum"}`)}
    await c.fechar()}finally{await nav.fechar()}})().catch(e=>{console.error("FALHOU:",e);process.exit(1)});
