const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';
const standalone = process.argv.includes('--standalone');

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WhatsApp Bot Manager',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, '..', 'dashboard', 'api', 'index.js');
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DASHBOARD_PORT: '3001' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server] ${data}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Server] Exited with code ${code}`);
  });
}

app.whenReady().then(async () => {
  let url = DASHBOARD_URL;

  if (standalone) {
    startServer();
    await new Promise((r) => setTimeout(r, 2000));
    url = 'http://localhost:3001';
  }

  createWindow(url);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});