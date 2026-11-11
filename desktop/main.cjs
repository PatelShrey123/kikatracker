const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

// The reason this app exists: a browser holds a page to the screen's refresh rate. These have to be
// set before Electron is ready. It stays on Electron 11: on macOS, newer Electron draws uncapped frames
// but hardly shows any of them (Kirka's own client is on Electron 10 for the same reason).
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Kirka Hub Aim Trainer',
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
