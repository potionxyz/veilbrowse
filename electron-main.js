const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const child_process = require('child_process');

app.commandLine.appendSwitch('--no-sandbox');

let serverProcess;
let mainWindow = null;

app.whenReady().then(() => {
  const serverEnv = {
    ...process.env,
    VEILBROWSE_USER_DATA: app.getPath('userData'),
  };
  // Use system Node.js binary for the server fork in development.
  // Electron's process.execPath points to the Electron binary, whose ABI is
  // incompatible with native .node addons compiled for Node.js (sqlite3,
  // playwright). Forking from Electron causes an immediate SIGSEGV on module load.
  // In the packaged AppImage, electron-builder rebuilds native deps for Electron,
  // so we can use the default Electron execPath.
  const nodeBinary = app.isPackaged ? undefined : (process.env.npm_node_execpath || process.env.NODE || 'node');
  serverProcess = child_process.fork(path.join(__dirname, 'server', 'index.js'), [], {
    env: serverEnv,
    execPath: nodeBinary,
    silent: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('[SERVER]', data.toString().trim());
  });
  serverProcess.stderr.on('data', (data) => {
    console.error('[SERVER ERR]', data.toString().trim());
  });
  serverProcess.on('error', (err) => {
    console.error('[SERVER ERROR] Fork failed:', err);
  });
  serverProcess.on('exit', (code, signal) => {
    console.error(`[SERVER EXIT] code=${code} signal=${signal}`);
  });

  serverProcess.on('message', (msg) => {
    if (msg === 'ready' && !mainWindow) createWindow();
  });

  setTimeout(() => {
    if (!mainWindow) {
      console.warn('[MAIN] Server did not send ready in 3s, creating window anyway');
      createWindow();
    }
  }, 3000);
});

function createWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 600,
    title: 'VeilBrowse',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:8888');
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});
