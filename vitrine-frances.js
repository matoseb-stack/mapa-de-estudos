#!/usr/bin/env node
// Vídeo "vitrine" (9:16, MP4) do curso de Francês: o app aparece dentro de um celular num palco animado
// (palco.html), com barra de capítulos, títulos que entram palavra por palavra, adesivos e cartões.
// uso: node vitrine-frances.js --repo /caminho/do/site [--saida ./videos] [--tema light|dark] [--velocidade 1.3]
// Tudo roda com o Firebase e a IA de demonstração (nada vai para o Firebase real); a fala é simulada.
const fs = require("fs"), path = require("path");
const { abrir } = require("./base.js"), { kit } = require("./gravador.js"), { prepararConta } = require("./cenas.js");
const arg = n => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const REPO = path.resolve(arg("repo") || ".."), SAIDA = path.resolve(arg("saida") || path.join(__dirname, "videos"));
const TEMA = arg("tema") || "light", NOME = "Camila Rocha", DATA = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// voz simulada: "ouve" a frase que está na tela, palavra por palavra
const VOZ_DEMO = `window.SpeechRecognition=class{start(){const a=((document.querySelector(".ex-alvo")||{}).textContent||"Bonjour").replace(/[“”"]/g,"").trim(),ws=a.split(/\\s+/);let i=0;
  const t=()=>{i=Math.min(ws.length,i+2);const fim=i>=ws.length;this.onresult&&this.onresult({results:[Object.assign([{transcript:ws.slice(0,i).join(" ")}],{isFinal:fim})]});
    if(!fim)setTimeout(t,170);else setTimeout(()=>this.onend&&this.onend(),300)};setTimeout(t,450)}stop(){}abort(){}};window.webkitSpeechRecognition=window.SpeechRecognition;`;
// IA de demonstração para a "Dica da IA" (resposta em JSON)
const IA_JSON = `window.DEMO_IA_JSON=function(t){
  if(/NÃO respondeu/.test(t))return {contexto:"Você está treinando achar **informações pessoais** num texto curto. Isso cai na Compréhension des écrits do DELF A1.",
    caminho:["Veja o que a pergunta pede: «Quel âge» = qual idade.","Procure no texto o verbo «avoir» + número + «ans».","Cuidado: o texto fala de mais de uma pessoa. Confira de quem é cada idade."],
    porque:"Em francês a idade usa **avoir**, não «être»: «J'ai vingt ans» = tenho vinte anos. No DELF, as alternativas erradas costumam ser números que também aparecem no texto."};
  return {contexto:"Leitura de informações pessoais (DELF A1).",caminho:["A pergunta é sobre a idade da Léa.","O texto diz «J'ai onze ans» na fala dela.","«Douze ans» é a idade do Karim: é a pegadinha."],porque:"A idade vem sempre com «avoir» + número + «ans»."}};`;

(async () => {
  const nome = `logic-academy-frances-${DATA}`; fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await abrir({ repo: REPO, tema: TEMA, eu: { uid: "demo_eu", nome: NOME }, init: [VOZ_DEMO, IA_JSON],
    palco: { arquivo: path.join(__dirname, "palco.html"), viewport: { width: 540, height: 960 }, dsf: 2 } });
  const base = kit(nav), { p, app, E } = nav, w = base.w;
  const P = (fn, ...a) => p.evaluate(([fn, a]) => window.P[fn](...a), [fn, a]);
  // o app está no iframe: toques, digitação e rolagem são feitos lá, e o círculo do toque aparece no palco
  const k = {
    ...base, E,
    prep: async () => { await app.addStyleTag({ content: ".faixa-teste,#crono-teste-bloq,.ad-slot,.la-ad{display:none!important}" }).catch(() => {}); await E(`S.tutPerguntou=true`).catch(() => {}); },
    existe: async sel => (await app.locator(sel).count()) > 0,
    tap: async (sel, o) => { o = o || {}; const el = typeof sel === "string" ? app.locator(sel).first() : sel; await el.waitFor({ state: "visible", timeout: o.timeout || 9000 });
      await el.scrollIntoViewIfNeeded().catch(() => {}); await w(160); const bx = await el.boundingBox(); if (!bx) throw new Error("não achei " + sel);
      await P("toque", bx.x + bx.width / 2, bx.y + bx.height / 2); await w(170); await el.click(); await w(o.depois == null ? 350 : o.depois); },
    digitar: async (sel, txt, atraso) => { await k.tap(sel, { depois: 120 }); await p.keyboard.type(txt, { delay: atraso || 70 }); },
    rolar: async (px, ms) => { await p.mouse.move(270, 600); const n = Math.max(1, Math.round((ms || 900) / 16)); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, px / n); await w(16); } },
    topo: () => E(`scrollTo(0,0)`)
  };
  async function responder(ex) {
    if (ex.t === "mc") await k.tap(`.ex-op[data-op="${ex.r}"]`, { depois: 700 });
    else if (ex.t === "gap") { await k.digitar("input.ex-gap", ex.resp[0], 85); await w(250); await k.tap('[data-ex="verificar"]', { depois: 700 }); }
    else if (ex.t === "order") {
      for (const pal of ex.palavras) { const c = app.locator("[data-chips] .ex-chip", { hasText: new RegExp("^" + pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }).first(); await k.tap(c, { depois: 150 }); }
      await k.tap('[data-ex="verificar"]', { depois: 700 });
    } else if (ex.t === "speak") { await k.tap('[data-ex="mic"]', { depois: 200 }); await k.ate(`!!document.querySelector(".ex-fb.ok,.ex-fb.no")`, 9000); await w(900); }
  }
  const continuar = () => k.tap('[data-ex="continuar"]', { depois: 380 });
  try {
    await k.ate(`S.mode==="nuvem"`, 20000); await w(800);
    await prepararConta(k, NOME);
    if (TEMA === "dark") await E(`mudarUI("modo","escuro")`).catch(() => {});
    await E(`localStorage.setItem("la_patch_visto",APP_VERSAO);document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`);
    // a conta já estuda inglês (nível B1, meta B2 First): o vídeo mostra o francês sendo acrescentado
    await E(`LAService.saveUserLevel(S.uid,"ingles",{nivel:"B1",pontos:14,total:20}).then(()=>LAService.savePrefs(S.uid,{idioma:"ingles",metas:{ingles:"B2"}}))`);
    await E(`go("idiomas")`); await k.ate(`!!document.querySelector('[data-trocar-lingua="frances"]')`, 12000);
    await k.prep(); await k.topo(); await P("barras", 6);
    await P("cartao", `<div class="bandeira"><i></i><i></i><i></i></div><span class="carimbo">NOVIDADE</span>
      <h2>O Logic Academy agora<br>fala <em>francês</em></h2><p>Curso completo até o DELF e o DALF,<br>com IA que te ensina o caminho.</p>`);
    await w(600);
    await k.gravar();

    // abertura
    await w(2300); await P("cartao", null); await w(250);

    // 1) idioma e meta
    await P("numero", "01", "Escolha o idioma"); await w(700);
    await P("capitulo", 0, 6200); await P("titulo", "Novo idioma", "Escolha *Francês* e a prova que você quer passar");
    await w(700);
    await P("adesivo", "fr", "🇫🇷 Francês", 18, 300, { cor: "azul", r: -8, balanca: true });
    await k.tap('[data-trocar-lingua="frances"]', { depois: 900 });
    await P("adesivo", "delf", "<small>certificação</small>DELF · DALF", 370, 470, { cor: "rosa", r: 7 });
    await w(500); await k.tap('[data-meta="B2"]', { depois: 1100 });
    await P("limpa");

    // 2) nivelamento
    await P("numero", "02", "Teste de nível"); await w(700);
    await P("capitulo", 1, 7000); await P("titulo", "Nivelamento", "Um teste que *sobe de nível* a cada acerto");
    await k.tap('[data-idm="sim"]', { depois: 700 });
    const niv = await E(`LA_FRANCES.NIVELAMENTO.A1`);
    const rot = { mc: "☑ marcar", gap: "✍️ escrever", order: "🧩 montar frases", speak: "🎙️ falar" };
    for (const [i, ex] of niv.slice(0, 3).entries()) {
      await P("adesivo", "tipo", rot[ex.t], i % 2 ? 360 : 16, 330 + i * 70, { cor: ["amar", "roxo", "azul", "rosa"][i], r: i % 2 ? 6 : -6 });
      await responder(ex); await continuar();
    }
    await P("tira", "tipo"); await k.tap('[data-cbt="sair"]', { depois: 1200 });

    // 3) o curso
    await P("numero", "03", "O curso"); await w(700);
    await P("capitulo", 2, 4500); await P("titulo", "A1 → C2", "*360 aulas* no formato da prova oficial");
    await k.topo(); await k.prep(); await w(500);
    await P("adesivo", "n", `<small>aulas</small><span class="contador" id="cnt" style="font-size:44px">0</span>`, 14, 300, { cor: "vidro", r: -5 });
    await P("conta", "#cnt", 360, 1400);
    await P("adesivo", "skills", "📖 Leitura · 🎧 Escuta<br>✍️ Escrita · 🗣️ Fala", 300, 640, { cor: "amar", r: 5 });
    await k.rolar(430, 1100); await w(700);
    await P("limpa"); await k.topo(); await w(300);

    // 4) dica da IA
    await P("numero", "04", "Travou?"); await w(700);
    await P("capitulo", 3, 13000); await P("titulo", "Dica da IA", "Peça uma *dica à IA* sem ganhar a resposta");
    await k.tap('[data-aula="reading:1"]', { depois: 900 });
    await k.tap('[data-a="comecar"]', { depois: 700 });
    await k.rolar(260, 600); await w(300);
    await P("adesivo", "ia", "💡 Contexto + caminho + porquê", 120, 860, { cor: "roxo", r: -3, balanca: true });
    await k.tap('[data-ex="dica"]', { depois: 300 });
    await k.ate(`!!document.querySelector(".ex-ia ol")`, 8000); await w(300);
    await app.locator(".ex-ia").scrollIntoViewIfNeeded().catch(() => {}); await w(2800);
    const aula = await app.evaluate(() => fetch("idiomas/frances/A1-reading.json").then(r => r.json()).then(d => d.aulas[0].exercicios));
    await P("tira", "ia"); await responder(aula[0]);
    await P("adesivo", "ok", "✓ +5 XP", 360, 520, { cor: "azul", r: 8 }); await w(900);
    await P("titulo", "Dica da IA", "Depois, ela explica *por que* é a certa");
    await k.tap('[data-ex="dica"]', { depois: 300 }); await k.ate(`document.querySelectorAll(".ex-ia ol").length&&document.querySelector('.ex-ia').innerText.includes("Explicação")`, 8000);
    await E(`document.querySelector(".ex-ia").scrollIntoView({behavior:"smooth",block:"center"})`); await w(2600); await P("limpa"); await continuar();

    // 5) falar francês
    await P("numero", "05", "Fale francês"); await w(700);
    await P("capitulo", 4, 7000); await P("titulo", "Production orale", "Você *fala em francês* e o app corrige 🎙️");
    let feitos = 1;
    for (const ex of aula.slice(1)) { feitos++; if (ex.t === "speak") { await P("adesivo", "mic", "🎙️ reconhecimento de voz", 20, 860, { cor: "rosa", r: -4, balanca: true }); await responder(ex); await w(1200); break; } await responder(ex); await continuar(); if (feitos > 4) break; }
    await P("limpa");

    // 6) inglês + francês e Pro
    await P("numero", "06", "Tudo num app só"); await w(700);
    await P("capitulo", 5, 8000); await P("titulo", "Inglês + Francês", "*720 aulas* e IA sem limite por *R$ 5/mês*");
    await k.tap('[data-a="voltar"]', { depois: 1500 }); await k.prep(); await k.topo(); await w(400);
    await k.tap('[data-trocar-lingua="ingles"]', { depois: 1600 });
    await P("adesivo", "en", "🇬🇧 Cambridge", 16, 330, { cor: "azul", r: -7 });
    await k.tap('[data-trocar-lingua="frances"]', { depois: 1400 });
    await P("adesivo", "fr2", "🇫🇷 DELF/DALF", 380, 330, { cor: "rosa", r: 7 });
    await E(`go("pro")`); await k.prep(); await k.topo(); await w(700);
    await P("adesivo", "gratis", "<small>sem cartão</small>🎁 3 dias grátis", 300, 760, { cor: "amar", r: 6, balanca: true });
    await k.rolar(380, 1000); await w(1200);

    // fim
    await P("limpa"); await P("titulo", "", "");
    await P("cartao", `<div class="lg">L</div><h2>Logic <em>Academy</em></h2><p>Estude para o DELF, o DALF e o Cambridge<br>com uma IA que te ensina o caminho.</p>
      <div class="chips"><b>🇫🇷 360 aulas de Francês</b><b>🇬🇧 360 de Inglês</b><b>💡 Dica da IA</b><b>🎙️ Fale e seja corrigido</b><b>📈 Nivelamento</b><b>🎁 3 dias grátis</b></div>
      <div class="url">logicacademy.web.app</div><p style="font-size:15px">Pro por R$ 5/mês · link na bio</p><p class="nota">Imagens ilustrativas · usuários fictícios</p>`);
    await w(3800); await k.parar();
    const res = k.montar(SAIDA, nome);
    // acelera o vídeo (padrão 1,3×) para caber em ~1 min no TikTok
    const vel = +(arg("velocidade") || 1.3);
    if (vel !== 1) { const tmp = res.mp4.replace(/\.mp4$/, "-tmp.mp4"); fs.renameSync(res.mp4, tmp);
      require("child_process").execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-filter:v", `setpts=PTS/${vel},fps=30`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", res.mp4]);
      fs.rmSync(tmp); res.dur /= vel; }
    const legenda = `Agora o Logic Academy fala FRANCÊS 🇫🇷\n\n📚 360 aulas do A1 ao C2 no formato DELF e DALF\n📈 Teste de nível que sobe a cada acerto\n💡 Travou? A IA te dá o caminho, sem entregar a resposta\n🎙️ Você fala em francês e o app corrige\n🇬🇧 E o curso de Inglês (Cambridge) no mesmo app\n💸 Pro por R$ 5/mês — 3 dias grátis sem cartão\n\nlogicacademy.web.app (link na bio)\n\n#frances #delf #dalf #aprenderfrances #francesonline #intercambio #campusfrance #estudos #studytok #idiomas\n`;
    fs.writeFileSync(path.join(SAIDA, nome + "-legenda.txt"), legenda);
    console.log(`OK ${res.mp4} · ${res.dur.toFixed(1)} s · ${res.quadros} quadros\nconferência: ${res.folha}`);
    if (nav.erros.length) console.log("Erros na página:", nav.erros.slice(0, 5));
  } finally { await nav.fechar(); }
})().catch(e => { console.error("FALHOU:", e); process.exit(1); });
