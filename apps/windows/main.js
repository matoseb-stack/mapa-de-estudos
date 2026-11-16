// Programa de Windows do Logic Academy: abre o site oficial numa janela própria.
// - Fechar a janela só esconde o programa perto do relógio (chamada, tela compartilhada e cronômetro continuam).
// - Liga junto com o Windows (escondido) para os lembretes chegarem o dia todo.
// - Mini widget por cima das janelas: sequência, próximo bloco e meta do dia.
// - Lembretes agendados pelo programa (o site manda a agenda dos próximos dias).
// Para sair de vez: botão direito no ícone perto do relógio › Sair.
const { app, BrowserWindow, Tray, Menu, session, desktopCapturer, shell, nativeImage, Notification, ipcMain, screen } = require("electron");
const path = require("path"), fs = require("fs");

const SITE = "https://logicacademy.web.app/";
const ICONE = path.join(__dirname, "icone.png");
const ESCONDIDO = process.argv.includes("--escondido");
let win = null, tray = null, mini = null, saindo = false, emChamada = false, avisouBandeja = false;
let agenda = [], disparados = new Set(), dadosWidget = null;

app.setAppUserModelId("app.logicacademy.estudos");
if (!app.requestSingleInstanceLock()) app.quit();
else app.on("second-instance", () => mostrar());

// preferências simples (widget ligado, início com o Windows já configurado)
const PREF_ARQ = () => path.join(app.getPath("userData"), "preferencias.json");
let PREF = { widget: true, iniciouComWindows: false };
function lerPref() { try { PREF = Object.assign(PREF, JSON.parse(fs.readFileSync(PREF_ARQ(), "utf8"))); } catch (e) { } }
function salvarPref() { try { fs.writeFileSync(PREF_ARQ(), JSON.stringify(PREF)); } catch (e) { } }

// o login do Google recusa navegadores "embutidos": o programa se apresenta como Chrome comum
const ua = () => app.userAgentFallback.replace(/ Electron\/\S+/, "").replace(/ logic-academy\/\S+/i, "") + " LogicAcademyApp";
const permitidoDentro = u => /^https:\/\/(logicacademy\.web\.app|mapa-de-estudos-d6eca\.firebaseapp\.com|accounts\.google\.com|[a-z0-9.-]*\.google\.com|appleid\.apple\.com)\//.test(u);

function mostrar() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function criarJanela() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 520, title: "Logic Academy", icon: ICONE, autoHideMenuBar: true, show: !ESCONDIDO,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, backgroundThrottling: false }
  });
  win.webContents.setUserAgent(ua());
  win.loadURL(SITE);
  win.webContents.on("did-fail-load", (_e, _c, _d, _u, principal) => { if (principal) win.loadFile(path.join(__dirname, "offline.html")); });
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
      new Notification({ title: "O Logic Academy continua aberto", icon: ICONE,
        body: emChamada ? "A chamada continua. Clique no ícone perto do relógio para voltar." : "Ele fica perto do relógio e continua mandando lembretes. Para sair de vez: botão direito no ícone › Sair." }).show();
    }
  });
}

/* ---------- mini widget (por cima das janelas, arrastável) ---------- */
function criarMini() {
  if (mini && !mini.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  mini = new BrowserWindow({
    width: 270, height: 132, x: area.x + area.width - 290, y: area.y + area.height - 152, frame: false, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, transparent: true, show: false, focusable: true, icon: ICONE,
    webPreferences: { preload: path.join(__dirname, "preload-widget.js"), contextIsolation: true }
  });
  mini.setAlwaysOnTop(true, "floating");
  mini.loadFile(path.join(__dirname, "widget.html"));
  mini.once("ready-to-show", () => { mini.showInactive(); if (dadosWidget) mini.webContents.send("dados", dadosWidget); });
  mini.on("closed", () => { mini = null; });
}
function alternarMini(ligar) {
  PREF.widget = ligar; salvarPref();
  if (ligar) criarMini(); else if (mini && !mini.isDestroyed()) mini.close();
  montarMenu();
}
ipcMain.on("widget-abrir", () => mostrar());
ipcMain.on("widget-fechar", () => alternarMini(false));

/* ---------- lembretes agendados (chegam mesmo com a janela fechada) ---------- */
setInterval(() => {
  const agora = Date.now();
  for (const x of agenda) {
    const id = x.em + "|" + x.titulo;
    if (x.em <= agora && x.em > agora - 120000 && !disparados.has(id)) {
      disparados.add(id);
      if (!Notification.isSupported()) continue;
      const n = new Notification({ title: x.titulo, body: x.texto || "", icon: ICONE });
      n.on("click", () => { mostrar(); win.webContents.executeJavaScript(`typeof abrirPorUrl==="function"&&abrirPorUrl("./?abrir=${encodeURIComponent(x.abrir || "inicio")}")`).catch(() => { }); });
      n.show();
    }
  }
}, 20000);

/* ---------- ponte com o site ---------- */
ipcMain.on("chamada", (_e, ativa, titulo) => { emChamada = !!ativa; if (tray) tray.setToolTip(ativa ? `Logic Academy · ${titulo || "Chamada"} em andamento` : textoDica()); });
ipcMain.on("versao", e => { e.returnValue = app.getVersion(); });
ipcMain.on("abrir-link", (_e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });
ipcMain.on("agendar", (_e, lista) => { if (Array.isArray(lista)) agenda = lista.filter(x => x && typeof x.em === "number").slice(0, 80); });
ipcMain.on("widget", (_e, d) => {
  dadosWidget = d; if (tray && !emChamada) tray.setToolTip(textoDica());
  if (mini && !mini.isDestroyed()) mini.webContents.send("dados", d);
});
const textoDica = () => dadosWidget ? `Logic Academy · 🔥 ${dadosWidget.seq} dias${dadosWidget.proximo ? " · Próximo: " + dadosWidget.proximo : ""}` : "Logic Academy";

function montarMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir o Logic Academy", click: mostrar },
    { label: "Mini widget por cima das janelas", type: "checkbox", checked: !!PREF.widget, click: i => alternarMini(i.checked) },
    { label: "Ligar junto com o Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: i => app.setLoginItemSettings({ openAtLogin: i.checked, args: ["--escondido"] }) },
    { type: "separator" },
    { label: "Sair", click: () => { saindo = true; app.quit(); } }
  ]));
}

app.whenReady().then(() => {
  lerPref();
  // na primeira vez, já liga junto com o Windows (escondido) para os lembretes chegarem o dia todo
  if (app.isPackaged && !PREF.iniciouComWindows) { app.setLoginItemSettings({ openAtLogin: true, args: ["--escondido"] }); PREF.iniciouComWindows = true; salvarPref(); }
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
  tray.on("click", mostrar);
  montarMenu();
  if (PREF.widget) criarMini();
});
app.on("before-quit", () => { saindo = true; });
app.on("window-all-closed", () => { /* continua perto do relógio */ });
