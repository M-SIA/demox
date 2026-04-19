import { ipcMain, shell, type BrowserWindow } from 'electron'
import { TEMPLATES } from '../shared/templates.js'
import type { AppSettings, CreateProjectInput, LogEvent, RunAgentInput, SecretKey } from '../shared/types.js'
import { getProject, listProjects } from './store.js'
import { createProject, deleteProject } from './projects.js'
import * as devServer from './devServer.js'
import * as deploy from './deploy/index.js'
import * as secrets from './secrets.js'
import { whoami } from './deploy/vercel.js'
import * as commentStore from './commentStore.js'
import * as commentServer from './commentServer.js'
import * as agent from './agent/index.js'
import * as settings from './settings.js'

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

  ipcMain.handle('deploy:start', async (_e, id: string) => {
    const p = await getProject(id)
    if (!p) throw new Error('Project not found')
    return deploy.deploy(p, win)
  })
  ipcMain.handle('deploy:cancel', (_e, deploymentId: string) => deploy.cancel(deploymentId))
  ipcMain.handle('deploy:list', (_e, projectId: string) => deploy.listForProject(projectId))

  ipcMain.handle('secrets:list', () => secrets.listTokens())
  ipcMain.handle('secrets:set', async (_e, provider: SecretKey, token: string) => {
    if (provider === 'vercel') {
      const ok = await whoami(token)
      if (!ok) throw new Error('Token rejected by Vercel')
    }
    await secrets.setToken(provider, token)
  })
  ipcMain.handle('secrets:clear', (_e, provider: SecretKey) => secrets.clearToken(provider))

  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => settings.update(patch))

  ipcMain.handle('agent:run', (_e, input: RunAgentInput) => agent.run(input, win))
  ipcMain.handle('agent:cancel', (_e, runId: string) => agent.cancel(runId))

  ipcMain.handle('comments:port', () => commentServer.getPort())
  ipcMain.handle('comments:list', (_e, projectId: string) => commentStore.listForProject(projectId))
  ipcMain.handle('comments:update', (_e, id: string, patch: { status?: 'open' | 'resolved'; body?: string }) =>
    commentStore.update(id, patch)
  )
  ipcMain.handle('comments:remove', (_e, id: string) => commentStore.remove(id))
}

export async function disposeIpc(): Promise<void> {
  await devServer.stopAll()
  await agent.shutdownServer()
}
