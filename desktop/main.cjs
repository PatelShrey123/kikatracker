const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');

// The reason this app exists: a browser holds a page to the screen's refresh rate. These switches have
// to be set before Electron is ready, so changing the mode restarts the app.
//
// On macOS, turning the GPU's vsync off as well can starve the screen: the trainer draws 600 frames a
// second but the Mac shows only a couple. So the Mac starts with vsync left on, and the player can try
// the other modes from the Frame Rate menu.
const MODES = {
  uncapped: {
    label: 'Uncapped',
    hint: 'No frame limit, screen sync on',
    switches: ['disable-frame-rate-limit'],
  },
  'uncapped-novsync': {
    label: 'Uncapped, no vsync',
    hint: 'Lowest delay; can stutter on some Macs',
    switches: ['disable-frame-rate-limit', 'disable-gpu-vsync'],
  },
  display: {
    label: 'Screen refresh rate',
    hint: 'Capped like a browser, never throttled',
    switches: [],
  },
};
const DEFAULT_MODE = process.platform === 'darwin' ? 'uncapped' : 'uncapped-novsync';
const settingsFile = path.join(app.getPath('userData'), 'frame-mode.json');

function readMode() {
  try {
    const { mode } = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    if (MODES[mode]) return mode;
  } catch {}
  return DEFAULT_MODE;
}

const mode = readMode();
for (const s of MODES[mode].switches) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function switchMode(next) {
  if (next === mode) return;
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({ mode: next }));
  } catch {}
  app.relaunch();
  app.exit(0);
}

function buildMenu() {
  const frameMenu = {
    label: 'Frame Rate',
    submenu: Object.entries(MODES).map(([id, m]) => ({
      label: `${m.label}  (${m.hint})${id === DEFAULT_MODE ? ', default' : ''}`,
      type: 'radio',
      checked: id === mode,
      click: () => switchMode(id),
    })),
  };
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    frameMenu,
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: `Kirka Hub Aim Trainer (${MODES[mode].label})`,
    backgroundColor: '#171925',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  // keep the mode in the title bar so players can tell which one they're on
  win.on('page-title-updated', (event) => event.preventDefault());

  // Only the trainer runs in here; any link goes to the player's own browser.
  const openOutside = (url) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
  };
  if (win.webContents.setWindowOpenHandler) {
    win.webContents.setWindowOpenHandler(({ url }) => {
      openOutside(url);
      return { action: 'deny' };
    });
  } else {
    win.webContents.on('new-window', (event, url) => {
      event.preventDefault();
      openOutside(url);
    });
  }
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    openOutside(url);
  });

  void win.loadFile(path.join(__dirname, 'app', 'aim.html'));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
