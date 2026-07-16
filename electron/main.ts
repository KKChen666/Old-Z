import { app, BrowserWindow, shell, Tray, Menu, nativeImage, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const API_PORT = 3001;
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+O';

function getOrCreateLocalJwtSecret(): string {
  const secretPath = path.join(app.getPath('userData'), 'local-jwt-secret');
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {}

  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

function getAppIcon(): Electron.NativeImage {
  // 尝试多个路径查找图标
  const candidates = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../public/favicon.svg'),
    path.join(__dirname, '../../public/icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return nativeImage.createFromPath(candidate);
    }
  }
  // 创建一个简单的 16x16 图标作为回退
  return nativeImage.createEmpty();
}

function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    const apiEntryPath = path.join(__dirname, '../dist-api/server.js');
    const appRoot = path.join(__dirname, '..');
    const userDataDir = app.getPath('userData');
    const dataDir = path.join(userDataDir, 'data');

    console.log('[Electron] API entry path:', apiEntryPath);
    console.log('[Electron] App root:', appRoot);
    console.log('[Electron] API entry exists:', fs.existsSync(apiEntryPath));

    if (!fs.existsSync(apiEntryPath)) {
      reject(new Error(`Packaged API entry not found: ${apiEntryPath}`));
      return;
    }

    apiProcess = spawn(process.execPath, [apiEntryPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        HOST: '127.0.0.1',
        DB_PROVIDER: 'sqlite', // 桌面应用默认使用 SQLite
        AUTO_REPORT_GENERATION: 'true',
        OLDZ_DATA_DIR: dataDir,
        JWT_SECRET: process.env.JWT_SECRET || getOrCreateLocalJwtSecret(),
        CORS_ORIGINS: process.env.CORS_ORIGINS || 'null,file://',
      },
      stdio: 'pipe',
      cwd: userDataDir,
    });

    let resolved = false;

    apiProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log(`[API] ${msg}`);
      if (msg.includes('Server ready') && !resolved) {
        resolved = true;
        resolve();
      }
    });

    apiProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[API Error] ${data.toString()}`);
    });

    apiProcess.on('error', (err) => {
      console.error('Failed to start API server:', err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    apiProcess.on('exit', (code, signal) => {
      console.error(`[Electron] API process exited (code=${code}, signal=${signal})`);
      if (!resolved) {
        resolved = true;
        reject(new Error(`API process exited before becoming ready (code=${code})`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[Electron] API server startup timed out after 8s');
        resolve();
      }
    }, 8000);
  });
}

function createTray(): void {
  const icon = getAppIcon();
  // 为托盘缩放图标
  const trayIcon = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Old Z');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏 Old Z',
      click: () => toggleWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    toggleWindow();
  });
}

function toggleWindow(): void {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function registerGlobalShortcut(): void {
  // 读取保存的快捷键（如果有），默认 Ctrl+Shift+O
  const shortcut = DEFAULT_SHORTCUT;

  const registered = globalShortcut.register(shortcut, () => {
    toggleWindow();
  });

  if (registered) {
    console.log(`[Electron] Global shortcut registered: ${shortcut}`);
  } else {
    console.warn(`[Electron] Failed to register global shortcut: ${shortcut}`);
  }
}

function setupIPC(): void {
  // 设置开机自启
  ipcMain.handle('set-auto-start', (_event, enabled: boolean) => {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('enabled must be a boolean');
    }
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
    return app.getLoginItemSettings().openAtLogin;
  });

  // 获取开机自启状态
  ipcMain.handle('get-auto-start', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  // 设置全局快捷键
  ipcMain.handle('set-global-shortcut', (_event, shortcut: string | null) => {
    globalShortcut.unregisterAll();
    if (shortcut) {
      const ok = globalShortcut.register(shortcut, () => toggleWindow());
      return ok;
    }
    return false;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Old Z',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch {
      // Invalid URL, ignore
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 最小化到托盘：关闭窗口时隐藏而非退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startApiServer();
  } catch (err) {
    console.error('API server failed to start:', err);
  }

  setupIPC();
  createWindow();
  createTray();
  registerGlobalShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;

  // 注销所有快捷键
  globalShortcut.unregisterAll();

  if (apiProcess) {
    apiProcess.kill();
    setTimeout(() => {
      if (apiProcess) {
        apiProcess.kill('SIGKILL');
        apiProcess = null;
      }
    }, 2000);
    apiProcess.on('exit', () => {
      apiProcess = null;
    });
  }

  // 清理托盘
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
