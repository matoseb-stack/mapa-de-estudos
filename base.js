// Prepara o site para gravar: cópia local do index.html (com um gancho para os roteiros),
// Firebase e IA de demonstração no lugar dos verdadeiros e o navegador no formato de celular.
const fs=require("fs"),path=require("path"),http=require("http"),os=require("os");
const {execFile}=require("child_process");
function achaPlaywright(){for(const p of [process.env.PLAYWRIGHT_MODULE,"playwright","/opt/node22/lib/node_modules/playwright"]){if(!p)continue;try{return require(p)}catch(e){}}throw new Error("playwright não encontrado")}
function achaChrome(){for(const p of [process.env.CHROME_PATH,"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"]){if(p&&fs.existsSync(p))return p}
  const base="/opt/pw-browsers";if(fs.existsSync(base)){const d=fs.readdirSync(base).filter(x=>/^chromium-\d+/.test(x)).sort().pop();if(d)return path.join(base,d,"chrome-linux/chrome")}return undefined}
const AQUI=__dirname;

// copia o site (repo) para uma pasta temporária e expõe as funções internas do app aos roteiros
function montarSite(repo){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"la-site-"));
  let s=fs.readFileSync(path.join(repo,"index.html"),"utf8");
  const i=s.indexOf("<script>\n(function(){"),j=s.indexOf("</script>",i),k=s.lastIndexOf("})();",j);
  if(i<0||k<i)throw new Error("estrutura do index.html mudou: não achei o bloco principal");
  s=s.slice(0,k)+"window.__ev=c=>eval(c);\n"+s.slice(k);
  fs.writeFileSync(path.join(dir,"index.html"),s);
  for(const n of ["questoes","icones","icones-oficial","firebase-config.js","manifest.webmanifest"])if(fs.existsSync(path.join(repo,n)))fs.symlinkSync(path.join(repo,n),path.join(dir,n));
  return dir}
function servir(dir){const tipos={".html":"text/html",".js":"application/javascript",".json":"application/json",".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".jpg":"image/jpeg"};
  return new Promise(ok=>{const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p.endsWith("/"))p+="index.html";const f=path.join(dir,p);
    if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
    r.writeHead(200,{"content-type":tipos[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
    srv.listen(0,"127.0.0.1",()=>ok({srv,url:`http://127.0.0.1:${srv.address().port}/`}))})}
// arquivos de fora (fontes, figuras do ENEM) passam pelo curl, que já confia no proxy deste ambiente
const cache={};
function baixar(url){if(cache[url])return cache[url];return cache[url]=new Promise(res=>{const f=path.join(os.tmpdir(),"la-dl-"+Object.keys(cache).length);
  execFile("curl",["-sS","-L","--max-time","25","-o",f,"-w","%{http_code} %{content_type}",url],(e,out)=>{const [st,...ct]=String(out||"").split(" ");
    res({status:+st||502,ct:ct.join(" ")||"application/octet-stream",body:fs.existsSync(f)?fs.readFileSync(f):Buffer.alloc(0)})})})}

async function abrir(o){
  o=Object.assign({tema:"light",eu:{uid:"demo_eu",nome:"Ana Souza"}},o||{});
  const dir=montarSite(o.repo),{srv,url}=await servir(dir);
  const {chromium}=achaPlaywright();
  const b=await chromium.launch({executablePath:achaChrome(),args:["--autoplay-policy=no-user-gesture-required"]});
  const ctx=await b.newContext({viewport:{width:432,height:768},deviceScaleFactor:2.5,isMobile:true,hasTouch:true,locale:"pt-BR",timezoneId:"America/Sao_Paulo",colorScheme:o.tema,
    userAgent:"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36"});
  await ctx.addInitScript(`window.DEMO_EU=${JSON.stringify(o.eu)};`);
  await ctx.addInitScript({path:path.join(AQUI,"mock-firebase.js")});
  await ctx.addInitScript({path:path.join(AQUI,"demo-dados.js")});
  if(o.ia)await ctx.addInitScript(`window.DEMO_IA=${o.ia.toString()};`);
  const iaMod=fs.readFileSync(path.join(AQUI,"mock-ai.mjs"));
  await ctx.route(/^https:\/\//,async r=>{const u=r.request().url();
    if(/gstatic\.com\/firebasejs\/[^/]+\/firebase-[a-z-]+-compat\.js/.test(u))return r.fulfill({status:200,contentType:"application/javascript",body:"/* demo: firebase simulado */"});
    if(/gstatic\.com\/firebasejs\/[^/]+\/firebase-(app|ai|app-check)\.js/.test(u))return r.fulfill({status:200,contentType:"application/javascript",body:iaMod,headers:{"access-control-allow-origin":"*"}});
    if(/googleapis\.com\/(?!css)|firebaseio|identitytoolkit|recaptcha|googletagmanager|google-analytics|firebasevertexai/.test(u)&&!/fonts\.googleapis/.test(u))return r.abort();
    const x=await baixar(u);r.fulfill({status:x.status,contentType:x.ct,body:x.body,headers:{"access-control-allow-origin":"*"}})});
  const p=await ctx.newPage();const erros=[];p.on("pageerror",e=>erros.push(e.message));
  await p.goto(url,{waitUntil:"load"});
  const E=c=>p.evaluate(c=>window.__ev(c),c);
  const fechar=async()=>{await b.close().catch(()=>{});srv.close();fs.rmSync(dir,{recursive:true,force:true})};
  return {b,ctx,p,E,erros,fechar}}
module.exports={abrir};
