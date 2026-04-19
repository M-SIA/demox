import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { disposeIpc, registerIpc } from './ipc.js'
import * as commentServer from './commentServer.js'
import * as tunnel from './tunnel.js'
import * as settings from './settings.js'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIpc(mainWindow)
  void commentServer.start(mainWindow).then(async ({ port }) => {
    const s = await settings.get()
    if (s.remoteSharing) {
      await tunnel.startTunnel(port).catch(() => { /* surfaced via diagnostics */ })
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.demox.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await disposeIpc()
  await tunnel.stopTunnel()
  await commentServer.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await disposeIpc()
  await tunnel.stopTunnel()
  await commentServer.stop()
})
