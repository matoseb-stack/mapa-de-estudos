#!/usr/bin/env node
// Vídeo especial de lançamento (9:16, MP4): curso de Inglês, nivelamento, aulas com fala,
// cronômetro com meta e mini-janela, Logic Academy Pro por R$ 5 e teste grátis de 3 dias.
// uso: node novidades.js --repo /caminho/do/site [--saida ./videos] [--tema light|dark]
// Tudo roda com o Firebase e a IA de demonstração (nada vai para o Firebase real).
// O reconhecimento de voz também é simulado: a "fala" do vídeo é a própria frase do exercício.
const fs = require("fs"), path = require("path");
const { abrir } = require("./base.js"), { kit } = require("./gravador.js"), { prepararConta, iaDemo } = require("./cenas.js");
const arg = n => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const REPO = path.resolve(arg("repo") || ".."), SAIDA = path.resolve(arg("saida") || path.join(__dirname, "videos"));
const TEMA = arg("tema") || "dark", NOME = "Júlia Martins", DATA = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// voz simulada para a gravação: "ouve" a frase que está na tela, palavra por palavra
const VOZ_DEMO = `window.SpeechRecognition=class{start(){const a=((document.querySelector(".ex-alvo")||{}).textContent||"I study every day").replace(/[“”"]/g,"").trim(),ws=a.split(/\\s+/);let i=0;
  const t=()=>{i=Math.min(ws.length,i+2);const fim=i>=ws.length;this.onresult&&this.onresult({results:[Object.assign([{transcript:ws.slice(0,i).join(" ")}],{isFinal:fim})]});
    if(!fim)setTimeout(t,170);else setTimeout(()=>this.onend&&this.onend(),300)};setTimeout(t,450)}stop(){}abort(){}};window.webkitSpeechRecognition=window.SpeechRecognition;`;

(async () => {
  const nome = `logic-academy-novidades-${DATA}`; fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await abrir({ repo: REPO, tema: TEMA, ia: iaDemo, eu: { uid: "demo_eu", nome: NOME }, init: [VOZ_DEMO] });
  const k = kit(nav), { p, E } = k;
  // responde o exercício que está na tela (certo), como um aluno faria
  async function responder(ex) {
    if (ex.t === "mc") { await k.tap(`.ex-op[data-op="${ex.r}"]`, { depois: 700 }); }
    else if (ex.t === "gap") { await k.digitar("input.ex-gap", ex.resp[0], 90); await k.w(250); await k.tap('[data-ex="verificar"]', { depois: 700 }); }
    else if (ex.t === "order") {
      for (const w of ex.palavras) { const c = p.locator("[data-chips] .ex-chip", { hasText: new RegExp("^" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }).first(); await k.tap(c, { depois: 160 }); }
      await k.tap('[data-ex="verificar"]', { depois: 700 });
    } else if (ex.t === "speak") { await k.tap('[data-ex="mic"]', { depois: 200 }); await k.ate(`!!document.querySelector(".ex-fb.ok,.ex-fb.no")`, 8000); await k.w(900); }
    await k.tap('[data-ex="continuar"]', { depois: 350 });
  }
  try {
    await k.ate(`S.mode==="nuvem"`, 20000); await k.w(800);
    await prepararConta(k, NOME);
    if (TEMA === "dark") await E(`mudarUI("modo","escuro")`).catch(() => {});
    await E(`localStorage.setItem("la_patch_visto",APP_VERSAO);document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`);
    await k.prep(); await k.topo(); await k.w(400);
    await k.gravar();

    // 1) abertura
    await k.full(`<div class="lg">L</div><h1>O Logic Academy <em>ficou enorme</em> 🚀</h1><p>Curso de Inglês completo, teste de nível que te escuta falar e Pro por <b>R$ 5</b>.</p>`);
    await k.w(2600); await k.full(null); await k.w(300);

    // 2) escolha do idioma e da prova
    await E(`go("idiomas")`); await k.prep(); await k.w(500);
    await k.cap("Escolhe o <em>idioma</em> 🇬🇧…"); await k.w(700);
    await k.tap('[data-lingua="ingles"]', { depois: 500 });
    await k.cap("…e a <em>prova</em> que quer passar 🎯"); await k.w(600);
    await k.tap('[data-meta="B2"]', { depois: 900 });

    // 3) nivelamento: marcar, escrever, montar e falar
    await k.cap("Teste de nível que <em>sobe de dificuldade</em> 📈", true);
    await k.tap('[data-idm="sim"]', { depois: 600 });
    const niv = await E(`LA_INGLES.NIVELAMENTO.A1`);
    for (const [i, ex] of niv.entries()) {
      if (i === 1) await k.cap("Você <em>escreve</em> ✍️", true);
      if (i === 2) await k.cap("Monta <em>frases</em> 🧩", true);
      if (i === 4) await k.cap("E até <em>fala em inglês</em>: o app te escuta 🎙️", true);
      await responder(ex);
    }
    await k.cap("Passou? Vem o <em>próximo nível</em> 🔥"); await k.w(1300);
    await k.tap('[data-cbt="seguir"]', { depois: 500 });
    await k.tap('[data-cbt="sair"]', { depois: 900 });

    // 4) painel com as trilhas
    await k.prep(); await k.topo(); await k.cap("<em>360 aulas</em> do A1 ao C2 🇬🇧"); await k.w(1400);
    await k.rolar(520, 1100); await k.w(400);
    await k.cap("Trilhas até a prova <em>Cambridge</em> 🎓"); await k.tap('[data-lista-trilha="reading"]', { depois: 1100 }); await k.rolar(380, 900); await k.w(700);

    // 5) uma aula de verdade
    await k.topo(); await k.tap('[data-aula="reading:1"]', { depois: 700 });
    await k.cap("Cada aula alterna <em>marcar, escrever e falar</em>"); await k.w(900);
    await k.tap('[data-a="comecar"]', { depois: 600 });
    const aula = await p.evaluate(() => fetch("idiomas/ingles/A1-reading.json").then(r => r.json()).then(d => d.aulas[0].exercicios));
    for (const [i, ex] of aula.slice(0, 5).entries()) {
      if (i === 2) await k.cap("Fala a frase e <em>o app corrige</em> 🎙️✅", true);
      if (i === 4) await k.cap("Fica mais difícil a cada <em>exercício</em> 💪", true);
      await responder(ex);
    }
    await k.cap(null); await E(`go("inicio")`); await k.prep(); await k.topo();

    // 6) cronômetro com meta + mini-janela
    await E(`go("cronometro")`); await k.prep(); await k.w(400);
    await k.cap("Cronômetro com <em>meta e alarme</em> ⏰");
    await p.selectOption("#crono-meta", "25").catch(() => {}); await k.w(500);
    await k.tap("#crono-play", { depois: 1300 });
    await k.cap("Mudou de tela? O tempo <em>continua com você</em> 👀");
    await E(`go("inicio")`); await k.prep(); await k.w(2200);

    // 7) Pro por R$ 5 e teste grátis
    await E(`go("pro")`); await k.prep(); await k.topo(); await k.w(300);
    await k.cap("Pro por só <em>R$ 5/mês</em> 💸"); await k.w(1200); await k.rolar(520, 1000); await k.w(800); await k.topo(); await k.w(300);
    await k.cap("Ou testa <em>3 dias grátis</em>, sem cartão 🎁", true);
    await k.tap("[data-pro-teste]", { depois: 500 });
    await k.digitar("#tt-cel", "11 99734-2851", 70); await k.w(200);
    await k.tap("#tt-ok", { depois: 300 }); await k.tap("#tt-enviar", { depois: 1400 });
    await k.cap("Pronto: <em>Pro liberado</em> na hora ✅"); await k.w(1500);
    await E(`document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`).catch(() => {});

    // 8) encerramento
    await k.cap(null);
    await k.full(`<div class="lg">L</div><h1>Logic <em>Academy</em></h1><p>Organize os estudos, aprenda Inglês e estude com os amigos.</p>
      <div class="tags"><b>🇬🇧 Curso de Inglês A1–C2</b><b>🎙️ Fale e seja corrigido</b><b>⏰ Cronômetro com meta</b><b>🤖 Mentoria IA</b><b>📝 +7 mil questões</b><b>🎁 3 dias grátis</b></div>
      <div class="url">logicacademy.web.app</div><p style="font-size:16px">Pro por R$ 5/mês · link na bio</p><p class="nota">Imagens ilustrativas · usuários fictícios</p>`);
    await k.w(3500); await k.parar();
    const res = k.montar(SAIDA, nome);
    const legenda = `O Logic Academy ficou ENORME 🚀\n\n🇬🇧 Curso de Inglês completo do A1 ao C2 (360 aulas no formato Cambridge)\n🎙️ Você fala em inglês e o app corrige\n📈 Teste de nível que sobe de dificuldade\n⏰ Cronômetro com meta, alarme e mini-janela\n💸 Pro por só R$ 5/mês — e 3 dias grátis sem cartão\n\nlogicacademy.web.app (link na bio)\n\n#ingles #cambridge #enem #estudos #studytok #aprenderingles #dicasdeestudo #vestibular #englishtips #foco\n`;
    fs.writeFileSync(path.join(SAIDA, nome + "-legenda.txt"), legenda);
    console.log(`OK ${res.mp4} · ${res.dur.toFixed(1)} s · ${res.quadros} quadros\nconferência: ${res.folha}`);
    if (nav.erros.length) console.log("Erros na página:", nav.erros.slice(0, 5));
  } finally { await nav.fechar(); }
})().catch(e => { console.error("FALHOU:", e); process.exit(1); });
