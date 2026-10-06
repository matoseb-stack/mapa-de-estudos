// Usuários e conversas FICTÍCIOS para os vídeos. Ficam só na memória do navegador da gravação.
(function(){
  "use strict";
  const D=window.DEMO,EU=D.eu.uid,agora=Date.now(),min=60000,hora=60*min;
  const iso=ms=>new Date(ms-3*hora).toISOString().slice(0,10);           // dia no horário de Brasília
  const diaBR=Math.floor((agora-3*hora)/864e5),semana=Math.floor((diaBR+3)/7),dt=new Date(agora-3*hora),mes=dt.getUTCFullYear()*12+dt.getUTCMonth()+1;
  const PESSOAS=[
    ["u_lucas","Lucas Ferreira","Medicina UFMG 🩺 | 3º ano","ENEM / vestibular · Medicina","diamante","lenda",12,[110,95,140,80,160,120,150]],
    ["u_bia","Beatriz Lima","Foco total no ENEM ✨","ENEM / vestibular · Direito","arcoiris","semana_perfeita",9,[90,120,60,100,130,75,95]],
    ["u_joao","João Pedro","EsPCEx 2026 🎖️","Concurso · EsPCEx","ouro","imparavel",8,[150,180,140,170,200,160,175]],
    ["u_mari","Mariana Costa","Engenharia é o sonho","ENEM / vestibular · Engenharia","convite","focado",6,[60,45,80,70,55,90,65]],
    ["u_gabi","Gabriela Rocha","PISM módulo III 📚","Vestibular · PISM UFJF","sakura","constante",7,[80,70,95,60,85,100,70]],
    ["u_rafa","Rafael Alves","Exatas > humanas 😅","ENEM / vestibular · Computação","neon","maratonista",5,[40,70,50,90,30,60,85]],
    ["u_clara","Clara Mendes","Rumo à federal","ENEM / vestibular · Psicologia","esmeralda","dedicado",4,[30,50,40,65,45,55,35]],
    ["u_davi","Davi Santos","1 questão por vez","ENEM / vestibular · Odontologia","rubi","iniciante",3,[20,35,25,40,30,45,25]]];
  const xpDe=n=>50*n*(n-1)+30;
  const amigos=PESSOAS.slice(0,6).map(p=>p[0]);
  // você
  D.set("perfis/"+EU,{nome:D.eu.nome,bio:"Rumo à Medicina 💙",foto:"",objetivo:"ENEM / vestibular · Medicina",desde:agora-40*864e5,nivel:4,moldura:"neon",titulo:"dedicado",amigos,usuario:"anasouza"});
  D.set("conquistas/"+EU,{xp:xpDe(4)+60,n:7,nivel:4,ultimo:"",itens:{"moldura:neon":true,"moldura:bronze":true,"titulo:dedicado":true,"titulo:iniciante":true,"emblema:primeira":true,"emblema:h10":true}});
  // estudantes
  PESSOAS.forEach(([id,nome,bio,obj,mold,tit,nivel,dias],i)=>{
    D.set("perfis/"+id,{nome,bio,foto:"",objetivo:obj,desde:agora-(60+i*9)*864e5,nivel,moldura:mold,titulo:tit,amigos:[EU],usuario:nome.split(" ")[0].toLowerCase()+(i+3)});
    D.set("conquistas/"+id,{xp:xpDe(nivel),n:10+i,nivel,ultimo:"",itens:{["moldura:"+mold]:true,["titulo:"+tit]:true}});
    const d={};dias.forEach((m,k)=>d[iso(agora-k*864e5)]=m);const total=dias.reduce((a,b)=>a+b,0)+3000-i*300;
    D.set("ranking/"+id,{dias:d,total,hojeData:iso(agora),hojeMin:dias[0],dia:diaBR,semana,mes,diaBase:total-dias[0],semanaBase:total-dias.slice(0,4).reduce((a,b)=>a+b,0),mesBase:total-900,
      atualizado:D.ts(agora-(i+1)*7*min),...(i<3?{agora:{desde:agora-(25+i*12)*min,materia:["Biologia","Matemática","Física"][i],modo:"pomodoro"}}:{})});
    D.set("presenca/"+id,{visto:agora-(i<5?20000:2*hora),ativo:i<5});
  });
  // comunidades
  const G=[["g_medicina","Rumo à Medicina 2026","Grupo de estudos para quem sonha com Medicina. Metas diárias e simulados aos domingos.","u_lucas",["u_bia","u_mari","u_gabi","u_clara","u_davi"],"aurora"],
    ["g_exatas","ENEM Exatas","Matemática, Física e Química sem medo. Tirem dúvidas aqui!","u_joao",["u_rafa","u_mari","u_lucas"],"quadriculado"],
    ["g_redacao","Redação Nota 1000","Temas, repertórios e correção entre amigos.","u_bia",["u_clara","u_gabi"],"caderno"]];
  G.forEach(([gid,nome,desc,dono,membros,fundo],i)=>{
    D.set("grupos/"+gid,{nome,desc,dono,criadoEm:agora-(30+i*5)*864e5,fundo,admins:[],publico:true});
    [dono,EU,...membros].forEach(u=>D.set(`grupos/${gid}/membros/${u}`,{em:agora-20*864e5,nome:u===EU?D.eu.nome:(PESSOAS.find(p=>p[0]===u)||[])[1]||""}));
  });
  D.set(`data/users/${EU}/social`,{grupos:{g_medicina:true,g_exatas:true,g_redacao:true},vistos:{}});
  const msg=(col,autor,texto,minAtras,extra)=>D.add(col,{autor,texto,em:agora-minAtras*min,...(extra||{})});
  [["u_joao","Bom dia, galera! Quem vai fazer o simulado de hoje? 💪",95],["u_bia","Eu! Bora fazer junto às 14h",90],["u_rafa","Alguém tem resumo de termoquímica?",60],
   ["u_gabi","Tem no grupo de Exatas, o João mandou ontem",57],["u_davi","Bati minha meta de 3h hoje 🎉",22],["u_mari","Boa, Davi!! 👏👏",20]].forEach(([a,t,m])=>msg("chat",a,t,m));
  [["u_lucas","Pessoal, meta de hoje: 40 questões de Biologia 🧬",180],["u_bia","Fechado! Já fiz 15",150],["u_gabi","Quem quer fazer chamada pra estudar junto à noite?",80],["u_clara","Eu topo! 20h?",75],["u_mari","Combinado 😄",70]]
    .forEach(([a,t,m])=>msg("grupos/g_medicina/mensagens",a,t,m));
  [["u_joao","Questão de função do 2º grau que caiu no ENEM, olhem que linda",200],["u_rafa","Errei essa no simulado 😭",190],["u_mari","Dica: sempre olhem o vértice primeiro",185]]
    .forEach(([a,t,m])=>msg("grupos/g_exatas/mensagens",a,t,m));
  [["u_bia","Tema da semana: desafios da saúde mental dos jovens no Brasil",300],["u_clara","Já comecei a introdução!",280]].forEach(([a,t,m])=>msg("grupos/g_redacao/mensagens",a,t,m));
  // conversa privada com o Lucas
  const cid=[EU,"u_lucas"].sort().join("_");
  D.set("conversas/"+cid,{participantes:[EU,"u_lucas"].sort(),atualizado:agora-12*min,ultima:"Valeu! Amanhã a gente revisa juntos",ultimaDe:"u_lucas"});
  [["u_lucas","Oi Ana! Vi que você subiu pro nível 4 🔥",40],[EU,"Simmm! Graças aos desafios da semana kkk",38],["u_lucas","Bora estudar Genética amanhã?",15],[EU,"Bora! Me manda aquela questão de heredograma",13],["u_lucas","Valeu! Amanhã a gente revisa juntos",12]]
    .forEach(([a,t,m])=>msg(`conversas/${cid}/mensagens`,a,t,m));
  const cid2=[EU,"u_bia"].sort().join("_");
  D.set("conversas/"+cid2,{participantes:[EU,"u_bia"].sort(),atualizado:agora-3*hora,ultima:"Te mandei o resumo de Redação!",ultimaDe:"u_bia"});
  msg(`conversas/${cid2}/mensagens`,"u_bia","Te mandei o resumo de Redação!",180);
  window.DEMO_PESSOAS=PESSOAS;
})();
