const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { app, BrowserWindow, Menu, dialog, net, shell } = require('electron');

// ---------------------------------------------------------------------------------------------------
// Frame rate. The reason this app exists: a browser holds a page to the screen's refresh rate. The
// switches have to be set before Electron is ready, so changing either setting restarts the app.
//
// On macOS, turning vsync off can starve the screen (a tester saw 600 frames drawn and about 2 shown),
// so the Mac starts uncapped with vsync on. Both can be changed from the Frame Rate menu.
// ---------------------------------------------------------------------------------------------------

const IS_MAC = process.platform === 'darwin';
const settingsFile = path.join(app.getPath('userData'), 'frame-mode.json');
const DEFAULTS = { cap: 'uncapped', vsync: IS_MAC };

function readSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    // the first 1.2.0 build saved one combined mode
    if (s.mode === 'uncapped') return { cap: 'uncapped', vsync: true };
    if (s.mode === 'uncapped-novsync') return { cap: 'uncapped', vsync: false };
    if (s.mode === 'display') return { cap: 'display', vsync: true };
    return {
      cap: s.cap === 'display' ? 'display' : 'uncapped',
      vsync: typeof s.vsync === 'boolean' ? s.vsync : DEFAULTS.vsync,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const settings = readSettings();
if (settings.cap === 'uncapped') app.commandLine.appendSwitch('disable-frame-rate-limit');
if (!settings.vsync) app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function changeSettings(patch) {
  const next = { ...settings, ...patch };
  if (next.cap === settings.cap && next.vsync === settings.vsync) return;
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(next));
  } catch {}
  app.relaunch();
  app.exit(0);
}

const settingsLabel = () => `${settings.cap === 'uncapped' ? 'Uncapped' : 'Screen refresh rate'} · VSync ${settings.vsync ? 'on' : 'off'}`;

// ---------------------------------------------------------------------------------------------------
// Updates. Without an Apple Developer account the Mac's own updater won't take the app, so it updates
// itself: it looks for a newer release on GitHub, downloads the app in the background, and swaps it
// in after it quits.
// ---------------------------------------------------------------------------------------------------

const REPO = 'PatelShrey123/kikatracker';
const TAG_PREFIX = 'aim-trainer-mac-v';
const ZIP_NAME = 'Kirka-Hub-Aim-Trainer-mac.zip';
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
// A small file the build keeps up to date. A plain download, so unlike GitHub's API it has no hourly limit.
const FEED_URL = `https://github.com/${REPO}/releases/download/aim-trainer-mac-updates/latest-mac.json`;

// The build checks the updater on GitHub's Mac: a copy that thinks it's old updates itself with no questions.
const UPDATE_TEST = process.env.KIRKAHUB_UPDATE_TEST === '1';
const currentVersion = () => (UPDATE_TEST ? '0.0.1' : app.getVersion());
const log = (...args) => {
  if (UPDATE_TEST) console.log('[update]', ...args);
};

let ready = null; // { version, newApp, tmp } once an update is downloaded
let checking = false;
let installing = false;

function request(url) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: 'follow' });
    req.setHeader('User-Agent', 'KirkaHubAimTrainer');
    req.on('response', (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.on('data', () => {});
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function findUpdate() {
  try {
    const feed = JSON.parse((await request(FEED_URL)).toString('utf8'));
    log('feed says', feed.version, 'and this is', currentVersion());
    if (feed && typeof feed.version === 'string' && typeof feed.url === 'string' && feed.url.startsWith('https://github.com/')) {
      return isNewer(feed.version, currentVersion()) ? { version: feed.version, url: feed.url } : null;
    }
  } catch (err) {
    log('feed failed, asking the API:', String((err && err.message) || err));
  }
  const releases = JSON.parse((await request(`https://api.github.com/repos/${REPO}/releases?per_page=30`)).toString('utf8'));
  let best = null;
  for (const r of releases) {
    if (r.draft || !String(r.tag_name).startsWith(TAG_PREFIX)) continue;
    const version = r.tag_name.slice(TAG_PREFIX.length);
    const zip = (r.assets || []).find((a) => a.name === ZIP_NAME);
    if (!zip || !isNewer(version, currentVersion())) continue;
    if (!best || isNewer(version, best.version)) best = { version, url: zip.browser_download_url };
  }
  return best;
}

/** The .app this is running from, or null when it can't be replaced (opened from the disk image, or
 * from Downloads under macOS's App Translocation). */
function replaceableBundle() {
  const bundle = path.resolve(path.dirname(process.execPath), '..', '..');
  if (!bundle.endsWith('.app')) return null;
  if (bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) return null;
  try {
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
  } catch {
    return null;
  }
  return bundle;
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => execFile(cmd, args, (err) => (err ? reject(err) : resolve())));

async function download(update) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kirkahub-update-'));
  const zip = path.join(tmp, ZIP_NAME);
  fs.writeFileSync(zip, await request(update.url));
  await run('/usr/bin/ditto', ['-x', '-k', zip, path.join(tmp, 'new')]);
  const newApp = path.join(tmp, 'new', 'Kirka Hub Aim Trainer.app');
  if (!fs.existsSync(path.join(newApp, 'Contents', 'MacOS'))) throw new Error('The download had no app in it');
  await run('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', newApp]).catch(() => {});
  return { version: update.version, newApp, tmp };
}

/** Swaps the new app in once this one has quit, putting the old one back if anything fails. */
function install(relaunch) {
  const bundle = replaceableBundle();
  if (!ready || !bundle || installing) return;
  installing = true;
  log('swapping', bundle);
  const script = [
    'while kill -0 "$PID" 2>/dev/null; do sleep 0.2; done',
    'rm -rf "$OLD.old"',
    'if mv "$OLD" "$OLD.old" && /usr/bin/ditto "$NEW" "$OLD"; then rm -rf "$OLD.old"; else rm -rf "$OLD"; mv "$OLD.old" "$OLD"; fi',
    'if [ "$RELAUNCH" = 1 ]; then open "$OLD"; fi',
    'rm -rf "$TMP"',
  ].join('\n');
  spawn('/bin/sh', ['-c', script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PID: String(process.pid), OLD: bundle, NEW: ready.newApp, TMP: ready.tmp, RELAUNCH: relaunch ? '1' : '0' },
  }).unref();
}

async function checkForUpdates(fromMenu) {
  if (!IS_MAC || checking) return;
  if (ready) {
    if (fromMenu) offerRestart();
    return;
  }
  checking = true;
  try {
    const update = await findUpdate();
    if (!update) {
      if (fromMenu) void dialog.showMessageBox({ message: "You're up to date", detail: `Version ${app.getVersion()} is the latest.` });
      return;
    }
    if (!replaceableBundle()) {
      if (UPDATE_TEST) throw new Error('not replaceable');
      const { response } = await dialog.showMessageBox({
        message: `Version ${update.version} is out`,
        detail: 'To update by itself, the app has to be in your Applications folder. Drag it there from the disk image, or download the new version now.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) void shell.openExternal(RELEASES_PAGE);
      return;
    }
    log('downloading', update.version, update.url);
    ready = await download(update);
    log('downloaded to', ready.newApp);
    if (UPDATE_TEST) {
      install(true);
      app.quit();
      return;
    }
    offerRestart();
  } catch (err) {
    log('failed:', String((err && err.message) || err));
    if (fromMenu) void dialog.showMessageBox({ type: 'warning', message: "Couldn't check for updates", detail: String((err && err.message) || err) });
  } finally {
    checking = false;
  }
}

async function offerRestart() {
  const { response } = await dialog.showMessageBox({
    message: `Version ${ready.version} is ready`,
    detail: 'Restart now to update? If not, it updates the next time you quit.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    install(true);
    app.quit();
  }
}

// Not restarted for it: put the update in as the app quits.
app.on('will-quit', () => install(false));

// ---------------------------------------------------------------------------------------------------

function buildMenu() {
  const frameMenu = {
    label: 'Frame Rate',
    submenu: [
      { label: 'Uncapped FPS', type: 'radio', checked: settings.cap === 'uncapped', click: () => changeSettings({ cap: 'uncapped' }) },
      { label: 'Screen refresh rate (like a browser)', type: 'radio', checked: settings.cap === 'display', click: () => changeSettings({ cap: 'display' }) },
      { type: 'separator' },
      {
        label: 'VSync',
        type: 'checkbox',
        checked: settings.vsync,
        click: () => changeSettings({ vsync: !settings.vsync }),
      },
      { label: 'VSync on: smooth, a touch more delay. Off: least delay, can stutter on Macs.', enabled: false },
      { type: 'separator' },
      { label: 'The app restarts when you change these.', enabled: false },
    ],
  };
  const appMenu = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { label: 'Check for Updates…', click: () => void checkForUpdates(true) },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };
  const template = [...(IS_MAC ? [appMenu] : []), frameMenu, { role: 'viewMenu' }, { role: 'windowMenu' }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: `Kirka Hub Aim Trainer · ${settingsLabel()}`,
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
  // keep the settings in the title bar so players can tell which they're on
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
  // a few seconds in, so it never slows the start
  setTimeout(() => void checkForUpdates(false), 5000);
});
app.on('window-all-closed', () => app.quit());
