import { app, BrowserWindow, shell, Tray, Menu, nativeImage, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
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

function resolveUnpackedPath(...segments: string[]) {
  if (app.isPackaged) {
    const asarDir = path.join(__dirname, '..');
    const unpackedDir = asarDir + '.unpacked';
    return path.join(unpackedDir, ...segments);
  }
  return path.join(__dirname, '..', ...segments);
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

    const apiLoaderPath = resolveUnpackedPath('api', 'server-loader.js');
    const appRoot = resolveUnpackedPath();

    console.log('[Electron] API loader path:', apiLoaderPath);
    console.log('[Electron] App root:', appRoot);
    console.log('[Electron] Loader exists:', fs.existsSync(apiLoaderPath));

    apiProcess = spawn('node', [apiLoaderPath], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        NODE_PATH: path.join(appRoot, 'node_modules'),
        DB_PROVIDER: 'sqlite', // 桌面应用默认使用 SQLite
        AUTO_REPORT_GENERATION: 'true',
      },
      stdio: 'pipe',
      cwd: appRoot,
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
