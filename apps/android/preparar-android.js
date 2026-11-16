// Ajusta o projeto Android gerado pelo Capacitor: permissões, serviço da chamada, código nativo e ícone.
// Rodado pelo GitHub Actions depois de "npx cap add android".
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "android", "app", "src", "main");
const PACOTE = path.join(RAIZ, "java", "app", "logicacademy", "estudos");

// 1) código nativo (atividade principal, serviço e ponte da chamada)
fs.mkdirSync(PACOTE, { recursive: true });
for (const f of ["MainActivity.java", "ChamadaService.java", "ChamadaPlugin.java"]) {
  fs.copyFileSync(path.join(__dirname, "nativo", f), path.join(PACOTE, f));
}

// 2) permissões e serviço no AndroidManifest
const mf = path.join(RAIZ, "AndroidManifest.xml");
let m = fs.readFileSync(mf, "utf8");
const perms = ["android.permission.INTERNET", "android.permission.CAMERA", "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.POST_NOTIFICATIONS", "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"];
for (const p of perms) {
  if (!m.includes(`"${p}"`)) m = m.replace("</manifest>", `    <uses-permission android:name="${p}" />\n</manifest>`);
}
if (!m.includes("ChamadaService")) {
  m = m.replace("</application>",
    `        <service android:name=".ChamadaService" android:exported="false" android:foregroundServiceType="microphone|mediaPlayback" />\n    </application>`);
}
fs.writeFileSync(mf, m);

// 3) ícone oficial (preto) em todas as densidades
const res = path.join(RAIZ, "res");
const icone = path.join(__dirname, "..", "..", "icones-oficial", "icone-512.png");
for (const d of fs.readdirSync(res).filter(d => d.startsWith("mipmap-"))) {
  const dir = path.join(res, d);
  if (d.includes("anydpi")) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
  for (const nome of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    if (fs.existsSync(path.join(dir, nome))) fs.copyFileSync(icone, path.join(dir, nome));
  }
}
console.log("Projeto Android preparado.");
