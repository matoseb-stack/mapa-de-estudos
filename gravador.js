// Ferramentas de gravação: legendas, telas cheias, toques na tela, rolagem, digitação e montagem do MP4.
const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const CSS=`#ad-cap{position:fixed;left:50%;top:11.5%;transform:translateX(-50%);width:88%;z-index:2147483646;pointer-events:none;text-align:center;
  font:800 27px/1.18 Geist,system-ui,sans-serif;letter-spacing:-.02em;color:#fff;transition:opacity .25s,transform .25s}
#ad-cap span{display:block;background:#0b0b10f0;padding:.42em .6em .46em;border-radius:.55em;box-shadow:0 10px 30px #0006;border:1px solid #ffffff22}
#ad-cap em{font-style:normal;color:#22d3ee}#ad-cap.baixo{top:auto;bottom:17%}
#ad-cap.off{opacity:0;transform:translateX(-50%) translateY(-10px)}
.ad-tap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:2147483647;pointer-events:none;background:#ffffff66;border:3px solid #fff;box-shadow:0 0 0 2px #0006,0 6px 18px #0005;animation:adTap .55s ease-out forwards}
@keyframes adTap{0%{transform:scale(.4);opacity:1}70%{transform:scale(1);opacity:.9}100%{transform:scale(1.35);opacity:0}}
#ad-full{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:34px;text-align:center;color:#fff;
  background:radial-gradient(circle at 30% 20%,#22d3ee55,transparent 55%),radial-gradient(circle at 80% 80%,#a855f755,transparent 55%),#07070cf2;backdrop-filter:blur(6px);font-family:Geist,system-ui,sans-serif;transition:opacity .35s}
#ad-full .lg{width:86px;height:86px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,#22d3ee,#3b82f6);font:800 44px Geist;color:#04131a;box-shadow:0 10px 40px #22d3ee66}
#ad-full h1{font-size:38px;line-height:1.08;margin:0;font-weight:800;letter-spacing:-.03em}#ad-full h1 em{font-style:normal;color:#22d3ee}
#ad-full p{margin:0;font-size:19px;opacity:.85;line-height:1.35}#ad-full .url{font:700 22px Geist;background:#fff;color:#07070c;padding:12px 22px;border-radius:999px}
#ad-full .tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}#ad-full .tags b{font-size:15px;font-weight:600;background:#ffffff1f;border:1px solid #ffffff33;padding:7px 12px;border-radius:999px}
#ad-full .nota{font-size:12px;opacity:.55}#ad-full.off{opacity:0}
.faixa-teste{display:none!important}`;
function kit({p,E,ctx}){
  const w=ms=>p.waitForTimeout(ms);
  const prep=async()=>{await p.addStyleTag({content:CSS}).catch(()=>{});await E(`S.tutPerguntou=true`).catch(()=>{})};
  const cap=async(html,baixo)=>{await p.evaluate(([h,baixo])=>{let c=document.getElementById("ad-cap");if(!c){c=document.createElement("div");c.id="ad-cap";document.body.appendChild(c)}
    if(!h){c.classList.add("off");return}c.classList.add("off");setTimeout(()=>{c.innerHTML="<span>"+h+"</span>";c.classList.toggle("baixo",!!baixo);c.classList.remove("off")},180)},[html,baixo])};
  const full=async html=>{await p.evaluate(h=>{let c=document.getElementById("ad-full");if(!h){if(c){c.classList.add("off");setTimeout(()=>c.remove(),400)}return}
    if(!c){c=document.createElement("div");c.id="ad-full";document.body.appendChild(c)}c.innerHTML=h;c.classList.remove("off")},html)};
  const toque=async(x,y)=>p.evaluate(([x,y])=>{const d=document.createElement("div");d.className="ad-tap";d.style.left=x+"px";d.style.top=y+"px";document.body.appendChild(d);setTimeout(()=>d.remove(),600)},[x,y]);
  const tap=async(sel,o)=>{o=o||{};const el=typeof sel==="string"?p.locator(sel).first():sel;await el.waitFor({state:"visible",timeout:o.timeout||8000});
    await el.scrollIntoViewIfNeeded().catch(()=>{});await w(140);const bx=await el.boundingBox();if(!bx)throw new Error("não achei "+sel);
    await toque(bx.x+bx.width/2,bx.y+bx.height/2);await w(170);await el.click();await w(o.depois==null?350:o.depois)};
  const existe=async sel=>(await p.locator(sel).count())>0;
  const rolar=async(px,ms)=>{const n=Math.max(1,Math.round((ms||900)/16));for(let i=0;i<n;i++){await p.mouse.wheel(0,px/n);await w(16)}};
  const topo=()=>E(`scrollTo(0,0)`);
  const digitar=async(sel,txt,atraso)=>{await tap(sel,{depois:120});await p.keyboard.type(txt,{delay:atraso||65})};
  const ate=async(cond,ms)=>{for(let t=0;t<(ms||10000);t+=200){if(await E(cond).catch(()=>false))return true;await w(200)}return false};
  // gravação pelo screencast do Chrome: só guarda quadros quando a tela muda
  let cdp=null;const quadros=[];
  const gravar=async()=>{cdp=await ctx.newCDPSession(p);cdp.on("Page.screencastFrame",f=>{quadros.push({d:f.data,t:f.metadata.timestamp});cdp.send("Page.screencastFrameAck",{sessionId:f.sessionId}).catch(()=>{})});
    await cdp.send("Page.startScreencast",{format:"jpeg",quality:92,maxWidth:1080,maxHeight:1920,everyNthFrame:1})};
  const parar=async()=>{await cdp.send("Page.stopScreencast");await w(200)};
  const montar=(saida,nome)=>{const dir=path.join(saida,nome+"-quadros");fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
    let lista="";quadros.forEach((f,i)=>{const n=path.join(dir,String(i).padStart(5,"0")+".jpg");fs.writeFileSync(n,Buffer.from(f.d,"base64"));
      lista+=`file '${n}'\nduration ${(i<quadros.length-1?Math.max(.001,quadros[i+1].t-f.t):1.2).toFixed(4)}\n`});
    lista+=`file '${path.join(dir,String(quadros.length-1).padStart(5,"0")+".jpg")}'\n`;fs.writeFileSync(path.join(dir,"lista.txt"),lista);
    const mp4=path.join(saida,nome+".mp4"),folha=path.join(saida,nome+"-conferencia.jpg");
    execFileSync("ffmpeg",["-y","-loglevel","error","-f","concat","-safe","0","-i",path.join(dir,"lista.txt"),"-vf","scale=1080:1920:flags=lanczos,fps=30,format=yuv420p","-c:v","libx264","-preset","slow","-crf","18","-profile:v","high","-movflags","+faststart",mp4]);
    const dur=quadros.at(-1).t-quadros[0].t+1.2;
    execFileSync("ffmpeg",["-y","-loglevel","error","-i",mp4,"-vf",`fps=1/${Math.max(1,dur/24).toFixed(2)},scale=270:480,tile=6x4`,"-frames:v","1",folha]);
    fs.rmSync(dir,{recursive:true,force:true});return {mp4,folha,dur,quadros:quadros.length}};
  return {w,prep,cap,full,tap,existe,rolar,topo,digitar,ate,gravar,parar,montar,p,E}}
module.exports={kit};
