import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';

// Point model cache to bundled models in app resources (fully offline)
process.env.TRANSFORMERS_CACHE = path.join(process.resourcesPath, 'models');
process.env.USER_DATA_DIR = app.getPath('userData');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    title: 'Budget',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      mainWindow?.webContents.openDevTools();
    });
  } else {
    // Start embedded backend before loading frontend
    try {
      const backend = await (new Function('specifier', 'return import(specifier)')(
        path.join(app.getAppPath(), 'backend', 'dist', 'server.js')
      )) as { startServer: () => Promise<number> };
      const port = await backend.startServer();
      process.env.BACKEND_PORT = String(port);
    } catch (err: any) {
      dialog.showErrorBox(
        'Budget — Failed to Start',
        `The backend server could not start.\n\n${err.message}\n\nThe app will now quit.`
      );
      app.quit();
      return;
    }

    mainWindow.loadFile(path.join(app.getAppPath(), 'frontend', 'dist', 'index.html'));
    mainWindow.once('ready-to-show', () => mainWindow?.show());
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
