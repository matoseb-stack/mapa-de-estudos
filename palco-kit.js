// Kit de gravação para o palco (palco.html): o app roda no iframe dentro do celular e as legendas,
// números de capítulo, adesivos e cartões aparecem no palco. Tem a mesma interface do kit de gravador.js
// (cap, full, tap, digitar, rolar, existe, ate, gravar, parar, montar, p, E), então as cenas de cenas.js
// funcionam sem mudança. Também tira fotos limpas da tela do app (sem legendas) para o carrossel.
const path = require("path"), { kit } = require("./gravador.js");
const PALCO = { arquivo: path.join(__dirname, "palco.html"), viewport: { width: 540, height: 960 }, dsf: 2 };

// "Texto com <em>destaque</em>" → "Texto com *destaque*" (formato dos títulos do palco)
const paraTitulo = h => String(h || "").replace(/<em>(.*?)<\/em>/g, (_, x) => "*" + x.replace(/<[^>]+>/g, "") + "*").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
// cartões do gravador antigo (#ad-full) → cartões do palco
const paraCartao = h => String(h || "").replace(/<h1>/g, "<h2>").replace(/<\/h1>/g, "</h2>").replace(/class="tags"/g, 'class="chips"');

function criar(nav) {
  const base = kit(nav), { p, app, E } = nav, w = base.w;
  const P = (fn, ...a) => p.evaluate(([fn, a]) => window.P[fn](...a), [fn, a]);
  // "p" das cenas: localizadores dentro do app; teclado e mouse da página
  const pa = { locator: (...a) => app.locator(...a), waitForSelector: (...a) => app.waitForSelector(...a), evaluate: (...a) => app.evaluate(...a), keyboard: p.keyboard, mouse: p.mouse };
  const k = {
    ...base, E, P, p: pa, pagina: p, app, tag: "", ultimaCap: "",
    prep: async () => { await app.addStyleTag({ content: ".faixa-teste,#crono-teste-bloq,.ad-slot,.la-ad,.anuncio{display:none!important}" }).catch(() => {}); await E(`S.tutPerguntou=true`).catch(() => {}); },
    existe: async sel => (await app.locator(sel).count()) > 0,
    tap: async (sel, o) => { o = o || {}; const el = typeof sel === "string" ? app.locator(sel).first() : sel; await el.waitFor({ state: "visible", timeout: o.timeout || 9000 });
      await el.scrollIntoViewIfNeeded().catch(() => {}); await w(160); const bx = await el.boundingBox(); if (!bx) throw new Error("não achei " + sel);
      await P("toque", bx.x + bx.width / 2, bx.y + bx.height / 2); await w(170); await el.click(); await w(o.depois == null ? 350 : o.depois); },
    digitar: async (sel, txt, atraso) => { await k.tap(sel, { depois: 120 }); await p.keyboard.type(txt, { delay: atraso || 70 }); },
    rolar: async (px, ms) => { await p.mouse.move(270, 600); const n = Math.max(1, Math.round((ms || 900) / 16)); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, px / n); await w(16); } },
    topo: () => E(`scrollTo(0,0)`),
    // legenda das cenas → título do palco (o rótulo pequeno é o nome do capítulo atual)
    cap: async html => { if (!html) return; k.ultimaCap = paraTitulo(html); await P("titulo", k.tag, k.ultimaCap); },
    full: async html => { await P("cartao", html ? paraCartao(html) : null); },
    // foto limpa da tela do app (PNG em base64) para o carrossel
    foto: async () => (await p.locator("#celular iframe").screenshot({ type: "png" })).toString("base64")
  };
  return k;
}
module.exports = { criar, PALCO, paraTitulo };
