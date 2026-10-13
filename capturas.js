// Recortes limpos do app para os carrosséis: abre o app numa página alta (sem barra de navegação,
// mini-cronômetro nem faixas) e fotografa só o pedaço que interessa (ex.: a resposta da mentora).
// Cada recorte é conferido (tamanho mínimo e sem tela de carregamento); se falhar, devolve null e o
// carrossel usa um slide só de texto no lugar.
const { prepararConta } = require("./cenas.js");
const ESCONDE = `.tabbar,.topbar,.ftimer,.faixa-teste,#crono-teste-bloq,.anuncio,.modal-bg,.toast,#toast{display:none!important}
  body{background:var(--bg)!important}#main{padding-top:12px!important}
  #mt-msgs{height:auto!important;min-height:0!important;max-height:none!important;flex:none!important;overflow:visible!important}`;

// receitas: preparar a tela e dizer qual elemento recortar
const RECEITAS = {
  mentoria: { async prep(c) { await c.E(`go("mentoria")`); await c.w(900); await c.pg.locator("[data-sug-mt]").nth(1).click(); await c.ate(`!S.mentor.ocupado&&document.querySelectorAll("#mt-msgs .msg,#mt-msgs > *").length>1`, 15000); await c.w(900); }, sel: "#mt-msgs" },
  mentoriaPlano: { async prep(c) { await c.E(`go("mentoria")`); await c.w(900); if (await c.pg.locator("#mt-limpar").count()) { await c.pg.locator("#mt-limpar").click(); await c.w(600); } await c.pg.locator("[data-sug-mt]").nth(2).click(); await c.ate(`!S.mentor.ocupado`, 15000); await c.w(900); }, sel: "#mt-msgs" },
  semana: { async prep(c) { await c.E(`go("semana")`); await c.w(1100); }, sel: ".dia-palco" },
  pomodoro: { async prep(c) { await c.E(`go("pomodoro")`); await c.w(900); }, sel: "#pomo-c" },
  estatisticas: { async prep(c) { await c.E(`go("estatisticas")`); await c.w(1300); await c.marcar(`[...document.querySelectorAll("#main .card")].find(x=>/Tempo por matéria/.test(x.textContent))`); }, sel: "[data-cap]" },
  constancia: { async prep(c) { await c.E(`go("estatisticas")`); await c.w(1300); await c.marcar(`[...document.querySelectorAll("#main .card")].find(x=>/Constância/.test(x.textContent))`); }, sel: "[data-cap]" },
  nivel: { async prep(c) { await c.E(`go("estatisticas")`); await c.w(1300); await c.marcar(`document.querySelector("#main .xp-card")`); }, sel: "[data-cap]" },
  ranking: { async prep(c) { await c.E(`go("ranking")`); await c.w(1500); await c.marcar(`[...document.querySelectorAll("#main .card")].find(x=>/Classificação/.test(x.textContent))`); }, sel: "[data-cap]" },
  grupo: { async prep(c) { await c.E(`S.grupoAberto="g_medicina";FBC.grupoTab="chat";go("grupos")`); await c.w(1600); }, sel: ".card.chat" },
  questao: { async prep(c) { await c.E(`if(S.qb){S.qb.sel=null;S.qb.mostrar=null};go("questoes")`); await c.pg.waitForSelector(".qb-item", { timeout: 12000 }); await c.w(500);
      await c.pg.locator(".qb-item").nth(2).click(); await c.w(900);
      const r = await c.E(`(()=>{const x=qbLista().find(y=>y.id===S.qb.sel);return x?x.r:0})()`); await c.pg.locator("[data-qalt]").nth(r).click(); await c.w(300);
      await c.pg.locator("#qb-resp").click(); await c.w(900); }, sel: ".qb-alts" },
  // exercício de idioma com a dica da IA aberta (montado direto, sem depender de rede)
  dicaIA: { async prep(c) { await c.E(`go("inicio")`); await c.w(500);
      await c.E(`(()=>{const d=document.createElement("div");d.className="card";d.dataset.cap="1";d.style.cssText="margin:12px;max-width:380px";document.querySelector("#main").prepend(d);
        LAComp.Exercicio.idioma("fr-FR");
        LAComp.Exercicio.render(d,{t:"mc",q:"Quel âge a Léa ?",op:["treize ans","douze ans","onze ans","dix ans"],r:2},{dica:async()=>({contexto:"Achar **informações pessoais** num texto curto, como na Compréhension des écrits do DELF A1.",caminho:["«Quel âge» = qual idade.","Procure «avoir» + número + «ans».","Cuidado: o texto fala de duas pessoas."],porque:"Em francês a idade usa **avoir**: «J'ai vingt ans»."})})})()`);
      await c.pg.locator('[data-ex="dica"]').click(); await c.ate(`!!document.querySelector(".ex-ia ol")`, 5000); await c.w(400); }, sel: "[data-cap]" },
  convite: { async prep(c) { await c.E(`go("inicio")`); await c.w(900); await c.marcar(`document.getElementById("convite")`);
      await c.E(`document.querySelectorAll("#convite input").forEach(i=>i.value="logicacademy.web.app/?ref=ana")`); }, sel: "[data-cap]" }
};

async function abrirCapturas(nav) {
  const pg = await nav.ctx.newPage(); await pg.setViewportSize({ width: 400, height: 1500 });
  await pg.goto(nav.app.url(), { waitUntil: "load" });
  const E = x => pg.evaluate(x => window.__ev(x), x), w = ms => pg.waitForTimeout(ms);
  const ate = async (cond, ms) => { for (let t = 0; t < (ms || 10000); t += 200) { if (await E(cond).catch(() => false)) return true; await w(200); } return false; };
  const c = { pg, E, w, ate, prep: async () => { await pg.addStyleTag({ content: ESCONDE }).catch(() => {}); await E(`S.tutPerguntou=true`).catch(() => {}); },
    marcar: async js => { await E(`(()=>{document.querySelectorAll("[data-cap]").forEach(x=>x.removeAttribute("data-cap"));const el=${js};if(el)el.setAttribute("data-cap","1")})()`); } };
  c.p = { locator: (...a) => pg.locator(...a), waitForSelector: (...a) => pg.waitForSelector(...a), keyboard: pg.keyboard, mouse: pg.mouse };
  await ate(`S.mode==="nuvem"`, 20000); await w(600);
  await prepararConta(c, "Ana Souza"); await c.prep();
  await E(`localStorage.setItem("la_patch_visto",APP_VERSAO);document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`).catch(() => {});
  // tira um recorte; devolve PNG em base64 ou null se não ficou bom
  c.tirar = async nome => {
    const rc = RECEITAS[nome]; if (!rc) return null;
    try {
      await rc.prep(c); await c.prep(); await E(`document.querySelectorAll(".modal-bg").forEach(m=>m.remove())`).catch(() => {});
      const el = pg.locator(rc.sel).first(); await el.waitFor({ state: "visible", timeout: 8000 }); await el.scrollIntoViewIfNeeded(); await w(400);
      const b = await el.boundingBox(); if (!b || b.width < 200 || b.height < 90) return null;
      if (await E(`!!document.querySelector("#main .spinner")&&document.querySelector("#main").innerText.length<200`)) return null;
      return (await el.screenshot({ type: "png" })).toString("base64");
    } catch (e) { console.warn("recorte", nome, "falhou:", e.message.split("\n")[0]); return null; }
  };
  c.fechar = () => pg.close();
  return c;
}
module.exports = { abrirCapturas, RECEITAS };
