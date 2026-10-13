// Carrossel do Instagram (4:5, 1080×1350 PNG) na mesma estética do palco dos vídeos:
// fundo escuro com manchas de luz, títulos com degradê, o app dentro de um celular, adesivos e "arraste".
// As telas do app são fotos limpas tiradas durante a gravação (sem legendas por cima).
// uso: await montarCarrossel({ ctx, saida, nome, capa, telas: [{ tag, titulo, foto, adesivo }], fim })
const fs = require("fs"), path = require("path");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// "*destaque*" → degradê
const titulo = t => esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const CSS = `*{box-sizing:border-box}html,body{margin:0;width:540px;height:675px;overflow:hidden;background:#05060d;color:#fff;font-family:Geist,system-ui,sans-serif}
.f{position:absolute;inset:0;overflow:hidden}.m{position:absolute;border-radius:50%;filter:blur(60px);opacity:.75}
.m1{width:380px;height:380px;background:#2a5bd7;left:-140px;top:-60px}.m2{width:340px;height:340px;background:#a855f7;right:-150px;top:260px}.m3{width:300px;height:300px;background:#ef4135;left:80px;bottom:-200px;opacity:.5}
.g{position:absolute;inset:0;background-image:linear-gradient(#ffffff0b 1px,transparent 1px),linear-gradient(90deg,#ffffff0b 1px,transparent 1px);background-size:28px 28px;-webkit-mask-image:radial-gradient(circle at 50% 40%,#000 25%,transparent 72%)}
.topo{position:absolute;top:20px;left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:15px;z-index:3}
.marca{display:flex;align-items:center;gap:9px}.lg{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:900;color:#04131a;background:linear-gradient(135deg,#7dd3fc,#3b82f6)}
.cont{font-size:12px;font-weight:700;letter-spacing:.1em;padding:6px 10px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff2c}
.tag{display:inline-block;font-weight:700;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;padding:6px 11px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff2c;margin-bottom:10px}
h1{margin:0;font-size:31px;line-height:1.07;font-weight:900;letter-spacing:-.035em;text-wrap:balance}
em{font-style:normal;background:linear-gradient(95deg,#7dd3fc,#c4b5fd 45%,#fda4af);-webkit-background-clip:text;background-clip:text;color:transparent}
.txt{position:absolute;top:70px;left:28px;right:28px;z-index:3}
.cel{position:absolute;left:50%;bottom:-155px;width:300px;height:600px;margin-left:-150px;border-radius:44px;padding:10px;background:linear-gradient(145deg,#2a2e3a,#0c0d13 40%,#1b1e28);
  box-shadow:0 0 0 1.5px #4b5160,0 30px 70px #000c,0 0 90px #3b82f650;z-index:2}
.cel img{width:280px;height:544px;object-fit:cover;object-position:top;border-radius:35px;display:block}
.ad{position:absolute;z-index:4;padding:9px 13px;border-radius:15px;font-weight:800;font-size:14.5px;white-space:nowrap;color:#0b0c12;background:#fff;box-shadow:0 12px 30px #000a}
.ad.azul{background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff}.ad.roxo{background:linear-gradient(135deg,#c084fc,#7c3aed);color:#fff}.ad.rosa{background:linear-gradient(135deg,#fb7185,#e11d48);color:#fff}.ad.amar{background:linear-gradient(135deg,#fde047,#f59e0b)}
.arr{position:absolute;right:22px;bottom:18px;z-index:5;font-weight:800;font-size:13px;padding:8px 13px;border-radius:999px;background:#fff;color:#05060d}
.nota{position:absolute;left:24px;bottom:22px;z-index:5;font-size:9.5px;opacity:.55}
.capa .txt{top:120px;text-align:center}.capa h1{font-size:42px}.capa .sub{margin-top:14px;font-size:15.5px;opacity:.85;line-height:1.35}
.capa .cel{transform:rotate(-7deg);left:66%;bottom:-260px;width:250px;height:500px;margin-left:-125px}.capa .cel img{width:230px;height:480px}
.capa .cel2{transform:rotate(8deg);left:30%}
.fim{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:30px}
.fim .lgg{width:70px;height:70px;border-radius:20px;display:grid;place-items:center;font-size:36px;font-weight:900;color:#04131a;background:linear-gradient(135deg,#7dd3fc,#3b82f6);box-shadow:0 12px 40px #3b82f677}
.fim h1{font-size:38px}.fim p{margin:0;font-size:15px;opacity:.85;line-height:1.4}.chips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;max-width:470px}
.chips b{font-size:12.5px;font-weight:700;padding:7px 11px;border-radius:999px;background:#ffffff16;border:1px solid #ffffff30}
.url{font-weight:800;font-size:19px;background:#fff;color:#05060d;padding:11px 20px;border-radius:999px;box-shadow:0 10px 40px #7dd3fc55}`;
const POS = [[18, 300, -6], [-18, 280, 6], [22, 440, 5], [-20, 420, -5]];
function pagina(corpo, i, n, ultimo) {
  return `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head>
<body><div class="f"><div class="m m1"></div><div class="m m2"></div><div class="m m3"></div><div class="g"></div></div>
<div class="topo"><span class="marca"><span class="lg">L</span>Logic Academy</span><span class="cont">${i}/${n}</span></div>${corpo}
${ultimo ? "" : `<span class="arr">Arraste →</span>`}<span class="nota">Imagens ilustrativas · usuários fictícios</span></body></html>`;
}
async function montarCarrossel({ ctx, saida, nome, capa, telas, fim }) {
  const pg = await ctx.newPage(); await pg.setViewportSize({ width: 540, height: 675 });
  const n = telas.length + 2, arquivos = [], img = b64 => `data:image/png;base64,${b64}`;
  const slides = [
    pagina(`<div class="capa" style="position:absolute;inset:0"><div class="txt"><span class="tag">${esc(capa.tag || "Logic Academy")}</span><h1>${titulo(capa.titulo)}</h1><p class="sub">${esc(capa.sub || "")}</p></div>
      ${telas[1] ? `<div class="cel cel2"><img src="${img(telas[1].foto)}"></div>` : ""}<div class="cel"><img src="${img(telas[0].foto)}"></div></div>`, 1, n),
    ...telas.map((t, i) => { const [x, y, r] = POS[i % POS.length];
      return pagina(`<div class="txt"><span class="tag">${esc(t.tag)}</span><h1>${titulo(t.titulo)}</h1></div><div class="cel"><img src="${img(t.foto)}"></div>
        ${t.adesivo ? `<span class="ad ${t.adesivo[1] || ""}" style="${x < 0 ? `right:${-x}px` : `left:${x}px`};top:${y}px;transform:rotate(${r}deg)">${t.adesivo[0]}</span>` : ""}`, i + 2, n); }),
    pagina(`<div class="fim" style="position:absolute;inset:0"><span class="lgg">L</span><h1>${titulo(fim.titulo)}</h1><p>${esc(fim.sub)}</p>
      <div class="chips">${fim.chips.map(c => `<b>${esc(c)}</b>`).join("")}</div><span class="url">logicacademy.web.app</span><p style="font-size:13px">${esc(fim.rodape || "Grátis · link na bio")}</p></div>`, n, n, true)
  ];
  for (const [i, h] of slides.entries()) {
    await pg.setContent(h, { waitUntil: "networkidle" }).catch(() => {}); await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}); await pg.waitForTimeout(250);
    const f = path.join(saida, `${nome}-carrossel-${i + 1}.png`); await pg.screenshot({ path: f }); arquivos.push(f);
  }
  await pg.close(); return arquivos;
}
module.exports = { montarCarrossel };
