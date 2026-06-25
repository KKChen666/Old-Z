import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let apiProcess: ChildProcess | null = null

const API_PORT = 3001

function resolveUnpackedPath(...segments: string[]) {
  // In packaged app, __dirname is inside app.asar
  // Unpacked files are in app.asar.unpacked/ at the same level
  if (app.isPackaged) {
    // __dirname = <app>/resources/app.asar/dist-electron
    const asarDir = path.join(__dirname, '..')  // <app>/resources/app.asar
    const unpackedDir = asarDir + '.unpacked'     // <app>/resources/app.asar.unpacked
    return path.join(unpackedDir, ...segments)
  }
  // Dev mode: files are at project root
  return path.join(__dirname, '..', ...segments)
}

function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve()
      return
    }

    const apiLoaderPath = resolveUnpackedPath('api', 'server-loader.js')
    const appRoot = resolveUnpackedPath()

    console.log('[Electron] API loader path:', apiLoaderPath)
    console.log('[Electron] App root:', appRoot)
    console.log('[Electron] Loader exists:', fs.existsSync(apiLoaderPath))

    apiProcess = spawn('node', [apiLoaderPath], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        NODE_PATH: path.join(appRoot, 'node_modules'),
      },
      stdio: 'pipe',
      cwd: appRoot,
    })

    let resolved = false

    apiProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString()
      console.log(`[API] ${msg}`)
      if (msg.includes('Server ready') && !resolved) {
        resolved = true
        resolve()
      }
    })

    apiProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[API Error] ${data.toString()}`)
    })

    apiProcess.on('error', (err) => {
      console.error('Failed to start API server:', err)
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.warn('[Electron] API server startup timed out after 8s')
        resolve() // Still proceed, but warn
      }
    }, 8000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Old Z',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow http/https URLs to be opened externally
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // Invalid URL, ignore
    }
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await startApiServer()
  } catch (err) {
    console.error('API server failed to start:', err)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill()
    // Wait briefly for process to exit, then force cleanup
    setTimeout(() => {
      if (apiProcess) {
        apiProcess.kill('SIGKILL')
        apiProcess = null
      }
    }, 2000)
    apiProcess.on('exit', () => {
      apiProcess = null
    })
  }
})
