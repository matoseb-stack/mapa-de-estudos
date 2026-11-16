// Programa de Windows do Logic Academy: abre o site oficial numa janela própria.
// Fechar a janela só esconde o programa perto do relógio (a chamada, a tela compartilhada e o cronômetro continuam).
// Para sair de vez: botão direito no ícone perto do relógio › Sair.
const { app, BrowserWindow, Tray, Menu, session, desktopCapturer, shell, nativeImage, Notification, ipcMain } = require("electron");
const path = require("path");

const SITE = "https://logicacademy.web.app/";
const ICONE = path.join(__dirname, "icone.png");
let win = null, tray = null, saindo = false, emChamada = false, avisouBandeja = false;

app.setAppUserModelId("app.logicacademy.estudos");
if (!app.requestSingleInstanceLock()) app.quit();
else app.on("second-instance", () => mostrar());

// o login do Google recusa navegadores "embutidos": o programa se apresenta como Chrome comum
const ua = () => app.userAgentFallback.replace(/ Electron\/\S+/, "").replace(/ logic-academy\/\S+/i, "") + " LogicAcademyApp";
const permitidoDentro = u => /^https:\/\/(logicacademy\.web\.app|mapa-de-estudos-d6eca\.firebaseapp\.com|accounts\.google\.com|[a-z0-9.-]*\.google\.com|appleid\.apple\.com)\//.test(u);

function mostrar() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function criarJanela() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 520, title: "Logic Academy", icon: ICONE, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, backgroundThrottling: false }
  });
  win.webContents.setUserAgent(ua());
  win.loadURL(SITE);
  win.webContents.on("did-fail-load", (_e, _c, _d, _u, principal) => { if (principal) win.loadFile(path.join(__dirname, "offline.html")); });
  // janelas de login (Google/Apple) abrem dentro do programa; outros links abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (permitidoDentro(url)) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICONE } };
    shell.openExternal(url); return { action: "deny" };
  });
  win.webContents.on("did-create-window", w => w.webContents.setUserAgent(ua()));
  win.on("close", e => {
    if (saindo) return;
    e.preventDefault(); win.hide();
    if (!avisouBandeja && Notification.isSupported()) {
      avisouBandeja = true;
      new Notification({
        title: "O Logic Academy continua aberto",
        body: emChamada ? "A chamada continua. Clique no ícone perto do relógio para voltar." : "Ele fica perto do relógio. Para sair de vez: botão direito no ícone › Sair.",
        icon: ICONE
      }).show();
    }
  });
}

app.whenReady().then(() => {
  // câmera, microfone, notificações e compartilhar a tela
  session.defaultSession.setPermissionRequestHandler((_wc, perm, ok) => ok(["media", "notifications", "display-capture", "fullscreen", "clipboard-sanitized-write"].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => ["media", "notifications", "display-capture", "fullscreen"].includes(perm));
  session.defaultSession.setDisplayMediaRequestHandler((_req, responder) => {
    desktopCapturer.getSources({ types: ["screen", "window"] })
      .then(fontes => responder(fontes.length ? { video: fontes[0], audio: "loopback" } : {}))
      .catch(() => responder({}));
  }, { useSystemPicker: true });

  criarJanela();
  tray = new Tray(nativeImage.createFromPath(ICONE).resize({ width: 16, height: 16 }));
  tray.setToolTip("Logic Academy");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir o Logic Academy", click: mostrar },
    { type: "separator" },
    { label: "Sair", click: () => { saindo = true; app.quit(); } }
  ]));
  tray.on("click", mostrar);
});

// o site avisa quando a chamada começa e termina
ipcMain.on("chamada", (_e, ativa, titulo) => {
  emChamada = !!ativa;
  if (tray) tray.setToolTip(ativa ? `Logic Academy · ${titulo || "Chamada"} em andamento` : "Logic Academy");
});
app.on("before-quit", () => { saindo = true; });
app.on("window-all-closed", () => { /* continua perto do relógio */ });
