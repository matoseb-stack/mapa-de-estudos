// Carrossel do Instagram (4:5, 1080×1350 PNG) na estética do palco: fundo escuro com luzes, títulos com
// degradê, cartões de vidro e adesivos. O texto é que convence; imagens do site só nos slides "tela",
// como recortes limpos (capturas.js). Temas em temas-carrossel.js.
// uso: await montarCarrossel({ ctx, saida, nome, tema, recortes: { mentoria: "<png base64>", ... } })
const path = require("path"), { CHIPS } = require("./temas-carrossel.js");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tit = t => esc(t).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const CSS = `*{box-sizing:border-box}html,body{margin:0;width:540px;height:675px;overflow:hidden;background:#05060d;color:#fff;font-family:Geist,system-ui,sans-serif}
.f{position:absolute;inset:0;overflow:hidden}.m{position:absolute;border-radius:50%;filter:blur(60px);opacity:.75}
.m1{width:380px;height:380px;background:#2a5bd7;left:-140px;top:-60px}.m2{width:340px;height:340px;background:#a855f7;right:-150px;top:260px}.m3{width:300px;height:300px;background:#ef4135;left:80px;bottom:-200px;opacity:.5}
.g{position:absolute;inset:0;background-image:linear-gradient(#ffffff0b 1px,transparent 1px),linear-gradient(90deg,#ffffff0b 1px,transparent 1px);background-size:28px 28px;-webkit-mask-image:radial-gradient(circle at 50% 40%,#000 25%,transparent 72%)}
.topo{position:absolute;top:20px;left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:15px;z-index:3}
.marca{display:flex;align-items:center;gap:9px}.lg{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:900;color:#04131a;background:linear-gradient(135deg,#7dd3fc,#3b82f6)}
.cont{font-size:12px;font-weight:700;letter-spacing:.1em;padding:6px 10px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff2c}
.tag{display:inline-block;font-weight:700;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;padding:6px 11px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff2c;margin-bottom:12px}
h1{margin:0;font-size:31px;line-height:1.08;font-weight:900;letter-spacing:-.035em;text-wrap:balance}
em{font-style:normal;background:linear-gradient(95deg,#7dd3fc,#c4b5fd 45%,#fda4af);-webkit-background-clip:text;background-clip:text;color:transparent}
.cx{position:absolute;top:72px;left:30px;right:30px;bottom:64px;display:flex;flex-direction:column;z-index:3}.cx .tag{align-self:flex-start}.capa .tag,.fim .tag{align-self:center}
.cx.meio{justify-content:center}
.vidro{background:#ffffff10;border:1px solid #ffffff26;border-radius:18px;backdrop-filter:blur(10px)}
.itens{display:flex;flex-direction:column;gap:10px;margin-top:20px}
.it{display:flex;gap:12px;align-items:center;padding:14px 16px;font-size:16.5px;font-weight:600;line-height:1.3}
.it i{flex:0 0 30px;height:30px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:15px}
.it i.x{background:#f43f5e33;color:#fda4af;border:1px solid #f43f5e66}.it i.v{background:#22c55e33;color:#86efac;border:1px solid #22c55e66}
.it i.n{background:linear-gradient(135deg,#7dd3fc,#3b82f6);color:#04131a}
.capa{justify-content:center;text-align:center;align-items:center}.capa h1{font-size:44px;line-height:1.02}.capa .sub{margin-top:16px;font-size:18px;opacity:.88;line-height:1.35;max-width:430px}
.emoji{font-size:64px;margin-bottom:14px;filter:drop-shadow(0 10px 30px #0008)}
.tela .img{position:relative;flex:1;display:flex;align-items:center;justify-content:center;margin-top:16px;min-height:0}
.tela .img img{max-width:100%;max-height:100%;border-radius:18px;box-shadow:0 0 0 1px #ffffff30,0 24px 60px #000c,0 0 70px #3b82f640;transform:rotate(-1.5deg)}
.nota{font-size:13.5px;opacity:.8;margin-top:10px}
.ad{position:absolute;z-index:4;padding:9px 13px;border-radius:15px;font-weight:800;font-size:14.5px;white-space:nowrap;color:#0b0c12;background:#fff;box-shadow:0 12px 30px #000a}
.ad.azul{background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff}.ad.roxo{background:linear-gradient(135deg,#c084fc,#7c3aed);color:#fff}.ad.rosa{background:linear-gradient(135deg,#fb7185,#e11d48);color:#fff}.ad.amar{background:linear-gradient(135deg,#fde047,#f59e0b)}
.nums{display:grid;gap:12px;margin-top:22px}.num{padding:16px 18px;display:flex;align-items:center;gap:16px}.num b{font-size:34px;font-weight:900;letter-spacing:-.03em;min-width:110px;background:linear-gradient(95deg,#7dd3fc,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}.num span{font-size:15.5px;font-weight:600;opacity:.9}
.fim{justify-content:center;align-items:center;text-align:center;gap:16px}
.fim .lgg{width:70px;height:70px;border-radius:20px;display:grid;place-items:center;font-size:36px;font-weight:900;color:#04131a;background:linear-gradient(135deg,#7dd3fc,#3b82f6);box-shadow:0 12px 40px #3b82f677}
.fim h1{font-size:38px}.fim p{margin:0;font-size:16px;opacity:.88;line-height:1.4}.chips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;max-width:470px}
.chips b{font-size:12.5px;font-weight:700;padding:7px 11px;border-radius:999px;background:#ffffff16;border:1px solid #ffffff30}
.url{font-weight:800;font-size:19px;background:#fff;color:#05060d;padding:11px 20px;border-radius:999px;box-shadow:0 10px 40px #7dd3fc55}
.arr{position:absolute;right:22px;bottom:18px;z-index:5;font-weight:800;font-size:13px;padding:8px 13px;border-radius:999px;background:#fff;color:#05060d}
.aviso{position:absolute;left:24px;bottom:22px;z-index:5;font-size:9.5px;opacity:.55}`;
function pagina(corpo, i, n, ultimo, temTela) {
  return `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head>
<body><div class="f"><div class="m m1"></div><div class="m m2"></div><div class="m m3"></div><div class="g"></div></div>
<div class="topo"><span class="marca"><span class="lg">L</span>Logic Academy</span><span class="cont">${i}/${n}</span></div>${corpo}
${ultimo ? "" : `<span class="arr">Arraste →</span>`}${temTela ? `<span class="aviso">Imagem ilustrativa · usuários fictícios</span>` : ""}</body></html>`;
}
const POS = [["right:-8px;top:-14px", 6], ["left:-8px;bottom:-12px", -5]];
function slideHtml(s, img) {
  const tag = s.tag ? `<span class="tag">${esc(s.tag)}</span>` : "";
  if (s.t === "capa") return `<div class="cx capa">${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ""}${tag}<h1>${tit(s.titulo)}</h1><p class="sub">${tit(s.sub || "")}</p></div>`;
  if (s.t === "lista" || s.t === "passos") return `<div class="cx meio">${tag}<h1>${tit(s.titulo)}</h1><div class="itens">${s.itens.map((x, k) =>
    `<div class="it vidro"><i class="${s.t === "passos" ? "n" : s.marca === "✗" ? "x" : "v"}">${s.t === "passos" ? k + 1 : s.marca === "✗" ? "✕" : "✓"}</i><span>${tit(x)}</span></div>`).join("")}</div></div>`;
  if (s.t === "numeros") return `<div class="cx meio">${tag}<h1>${tit(s.titulo)}</h1><div class="nums">${s.itens.map(([a, b]) => `<div class="num vidro"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div></div>`;
  if (s.t === "tela") return `<div class="cx tela">${tag}<h1>${tit(s.titulo)}</h1>${s.nota ? `<p class="nota">${esc(s.nota)}</p>` : ""}
    <div class="img"><img src="data:image/png;base64,${img}">${(s.adesivos || []).slice(0, 2).map(([t, c], k) => `<span class="ad ${c || ""}" style="${POS[k][0]};transform:rotate(${POS[k][1]}deg)">${esc(t)}</span>`).join("")}</div></div>`;
  return `<div class="cx fim"><span class="lgg">L</span><h1>${tit(s.titulo)}</h1><p>${tit(s.sub || "")}</p><div class="chips">${(s.chips || CHIPS).map(c => `<b>${esc(c)}</b>`).join("")}</div>
    <span class="url">logicacademy.web.app</span><p style="font-size:13px">Grátis para começar · link na bio</p></div>`;
}
async function montarCarrossel({ ctx, saida, nome, tema, recortes }) {
  // slides "tela" sem recorte bom viram o slide de texto de reserva
  const slides = tema.slides.map(s => s.t === "tela" && !(recortes || {})[s.cap] ? { ...(s.seFalhar || { t: "lista", titulo: s.titulo, itens: [], marca: "✓" }), tag: s.tag } : s);
  const pg = await ctx.newPage(); await pg.setViewportSize({ width: 540, height: 675 });
  const arquivos = [], n = slides.length;
  for (const [i, s] of slides.entries()) {
    const h = pagina(slideHtml(s, s.t === "tela" ? recortes[s.cap] : null), i + 1, n, i === n - 1, s.t === "tela");
    await pg.setContent(h, { waitUntil: "networkidle" }).catch(() => {}); await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}); await pg.waitForTimeout(250);
    const f = path.join(saida, `${nome}-carrossel-${i + 1}.png`); await pg.screenshot({ path: f }); arquivos.push(f);
  }
  await pg.close(); return arquivos;
}
// recortes que um tema precisa
const recortesDoTema = tema => [...new Set(tema.slides.filter(s => s.t === "tela").map(s => s.cap))];
module.exports = { montarCarrossel, recortesDoTema };
