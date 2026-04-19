import { ipcMain, shell, type BrowserWindow } from 'electron'
import { TEMPLATES } from '../shared/templates.js'
import type { CreateProjectInput, LogEvent } from '../shared/types.js'
import { getProject, listProjects } from './store.js'
import { createProject, deleteProject } from './projects.js'
import * as devServer from './devServer.js'

export function registerIpc(win: BrowserWindow): void {
  const sysLog = (projectId: string) => (line: string) => {
    const ev: LogEvent = { projectId, stream: 'system', line, ts: Date.now() }
    win.webContents.send('dev:log', ev)
  }

  ipcMain.handle('templates:list', () => TEMPLATES)
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:get', (_e, id: string) => getProject(id))

  ipcMain.handle('projects:create', async (_e, input: CreateProjectInput) => {
    const tempId = 'pending'
    return createProject(input, win, sysLog(tempId))
  })

  ipcMain.handle('projects:delete', async (_e, id: string) => {
    const p = await getProject(id)
    if (!p) return
    await devServer.stop(id)
    await deleteProject(id, p.path)
  })

  ipcMain.handle('projects:reveal', async (_e, id: string) => {
    const p = await getProject(id)
    if (p) shell.openPath(p.path)
  })

  ipcMain.handle('dev:start', async (_e, id: string) => {
    const p = await getProject(id)
    if (!p) throw new Error('Project not found')
    return devServer.start(p, win)
  })
  ipcMain.handle('dev:stop', (_e, id: string) => devServer.stop(id))
  ipcMain.handle('dev:state', (_e, id: string) => devServer.getState(id))

  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
}

export function disposeIpc(): Promise<void> {
  return devServer.stopAll()
}
