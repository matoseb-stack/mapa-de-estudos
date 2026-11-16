// Ajusta o projeto Android gerado pelo Capacitor: permissões, serviço da chamada, lembretes, widget, código nativo,
// versão e ícone. Rodado pelo GitHub Actions depois de "npx cap add android".
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "android", "app");
const RAIZ = path.join(APP, "src", "main");
const PACOTE = path.join(RAIZ, "java", "app", "logicacademy", "estudos");
const VERSAO = (process.env.APP_VERSAO && /^\d+\.\d+$/.test(process.env.APP_VERSAO) ? process.env.APP_VERSAO + ".0" : process.env.APP_VERSAO) || require("./package.json").version;   // segue a versão do site (ex.: 3.27 → 3.27.0)

// 1) código nativo
fs.mkdirSync(PACOTE, { recursive: true });
for (const f of fs.readdirSync(path.join(__dirname, "nativo")).filter(f => f.endsWith(".java"))) {
  fs.copyFileSync(path.join(__dirname, "nativo", f), path.join(PACOTE, f));
}
// 2) recursos do widget (layout, fundo, configuração)
const copiarPasta = (de, para) => { fs.mkdirSync(para, { recursive: true }); for (const f of fs.readdirSync(de)) {
  const a = path.join(de, f), b = path.join(para, f); if (fs.statSync(a).isDirectory()) copiarPasta(a, b); else fs.copyFileSync(a, b); } };
copiarPasta(path.join(__dirname, "nativo", "res"), path.join(RAIZ, "res"));

// 3) AndroidManifest: permissões, serviço da chamada, lembretes (e religar o celular) e widget
const mf = path.join(RAIZ, "AndroidManifest.xml");
let m = fs.readFileSync(mf, "utf8");
const perms = ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.CAMERA", "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.POST_NOTIFICATIONS", "android.permission.WAKE_LOCK",
  "android.permission.RECEIVE_BOOT_COMPLETED", "android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK", "android.permission.REQUEST_INSTALL_PACKAGES"];
for (const p of perms) if (!m.includes(`"${p}"`)) m = m.replace("</manifest>", `    <uses-permission android:name="${p}" />\n</manifest>`);
if (!m.includes("ChamadaService")) m = m.replace("</application>", `
        <service android:name=".ChamadaService" android:exported="false" android:foregroundServiceType="microphone|mediaPlayback" />
        <receiver android:name=".Lembretes" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
        <receiver android:name=".SequenciaWidget" android:exported="true" android:label="Logic Academy">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_sequencia_info" />
        </receiver>
    </application>`);
fs.writeFileSync(mf, m);

// 4) versão do app (o site compara com versao.json e avisa quando houver um app novo)
const gradle = path.join(APP, "build.gradle");
let g = fs.readFileSync(gradle, "utf8");
const [a, b, c] = VERSAO.split(".").map(Number);
g = g.replace(/versionCode\s+\d+/, `versionCode ${a * 10000 + b * 100 + c}`).replace(/versionName\s+"[^"]*"/, `versionName "${VERSAO}"`);
// app de testes: outro nome no Android ("app.logicacademy.estudos.teste"), para nunca brigar com o oficial
if (process.env.APP_CANAL === "teste") {
  g = g.replace(/applicationId\s+"app\.logicacademy\.estudos"/, 'applicationId "app.logicacademy.estudos.teste"');
  const str = path.join(RAIZ, "res", "values", "strings.xml");
  fs.writeFileSync(str, fs.readFileSync(str, "utf8").replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Logic Academy (testes)</string>')
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Logic Academy (testes)</string>'));
}
// assinatura fixa (criada uma vez pelo GitHub): sem ela o Android recusa instalar a versão nova por cima
if (process.env.ASSINATURA_ARQ && fs.existsSync(process.env.ASSINATURA_ARQ)) {
  const arq = process.env.ASSINATURA_ARQ.replace(/\\/g, "/");
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        fixa {
            storeFile file("${arq}")
            storePassword "android"
            keyAlias "logicacademy"
            keyPassword "android"
        }
    }`);
  g = g.replace(/buildTypes\s*\{/, `buildTypes {
        debug {
            signingConfig signingConfigs.fixa
        }`);
  console.log("Assinatura fixa configurada.");
}
fs.writeFileSync(gradle, g);

// 5) ícone oficial (preto) em todas as densidades
const res = path.join(RAIZ, "res");
const icone = path.join(__dirname, "..", "..", "icones-oficial", "icone-512.png");
for (const d of fs.readdirSync(res).filter(d => d.startsWith("mipmap-"))) {
  const dir = path.join(res, d);
  if (d.includes("anydpi")) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
  for (const nome of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    if (fs.existsSync(path.join(dir, nome))) fs.copyFileSync(icone, path.join(dir, nome));
  }
}
console.log("Projeto Android preparado, versão " + VERSAO);
