import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateProjectInput,
  DeployProgress,
  DeployProvider,
  Deployment,
  DevServerState,
  LogEvent,
  Project,
  ProviderTokens,
  TemplateInfo
} from '../shared/types.js'

const api = {
  templates: {
    list: (): Promise<TemplateInfo[]> => ipcRenderer.invoke('templates:list')
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    get: (id: string): Promise<Project | undefined> => ipcRenderer.invoke('projects:get', id),
    create: (input: CreateProjectInput): Promise<Project> => ipcRenderer.invoke('projects:create', input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id),
    reveal: (id: string): Promise<void> => ipcRenderer.invoke('projects:reveal', id),
    onCreateProgress: (cb: (p: { id: string; step: string; message: string }) => void): (() => void) => {
      const fn = (_: unknown, payload: { id: string; step: string; message: string }) => cb(payload)
      ipcRenderer.on('project:create-progress', fn)
      return () => { ipcRenderer.off('project:create-progress', fn) }
    }
  },
  dev: {
    start: (id: string): Promise<DevServerState> => ipcRenderer.invoke('dev:start', id),
    stop: (id: string): Promise<void> => ipcRenderer.invoke('dev:stop', id),
    state: (id: string): Promise<DevServerState> => ipcRenderer.invoke('dev:state', id),
    onState: (cb: (s: DevServerState) => void): (() => void) => {
      const fn = (_: unknown, s: DevServerState) => cb(s)
      ipcRenderer.on('dev:state', fn)
      return () => { ipcRenderer.off('dev:state', fn) }
    },
    onLog: (cb: (e: LogEvent) => void): (() => void) => {
      const fn = (_: unknown, e: LogEvent) => cb(e)
      ipcRenderer.on('dev:log', fn)
      return () => { ipcRenderer.off('dev:log', fn) }
    }
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  },
  deploy: {
    start: (id: string): Promise<Deployment> => ipcRenderer.invoke('deploy:start', id),
    cancel: (deploymentId: string): Promise<void> => ipcRenderer.invoke('deploy:cancel', deploymentId),
    list: (projectId: string): Promise<Deployment[]> => ipcRenderer.invoke('deploy:list', projectId),
    onProgress: (cb: (p: DeployProgress) => void): (() => void) => {
      const fn = (_: unknown, p: DeployProgress) => cb(p)
      ipcRenderer.on('deploy:progress', fn)
      return () => { ipcRenderer.off('deploy:progress', fn) }
    }
  },
  secrets: {
    list: (): Promise<ProviderTokens> => ipcRenderer.invoke('secrets:list'),
    set: (provider: DeployProvider, token: string): Promise<void> => ipcRenderer.invoke('secrets:set', provider, token),
    clear: (provider: DeployProvider): Promise<void> => ipcRenderer.invoke('secrets:clear', provider)
  }
}

export type DemoxApi = typeof api

contextBridge.exposeInMainWorld('demox', api)
