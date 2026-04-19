import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentDiagnostics,
  AgentProgress,
  AppSettings,
  Comment,
  CreateProjectInput,
  DeployProgress,
  Deployment,
  DevServerState,
  FileDiffEntry,
  LogEvent,
  Project,
  ProviderTokens,
  RunAgentInput,
  SecretKey,
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
    set: (provider: SecretKey, token: string): Promise<void> => ipcRenderer.invoke('secrets:set', provider, token),
    clear: (provider: SecretKey): Promise<void> => ipcRenderer.invoke('secrets:clear', provider)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:update', patch)
  },
  agent: {
    run: (input: RunAgentInput): Promise<{ runId: string }> => ipcRenderer.invoke('agent:run', input),
    cancel: (runId: string): Promise<void> => ipcRenderer.invoke('agent:cancel', runId),
    diagnostics: (): Promise<AgentDiagnostics> => ipcRenderer.invoke('agent:diagnostics'),
    diff: (projectId: string): Promise<FileDiffEntry[]> => ipcRenderer.invoke('agent:diff', projectId),
    revert: (projectId: string): Promise<void> => ipcRenderer.invoke('agent:revert', projectId),
    hasLastRun: (projectId: string): Promise<boolean> => ipcRenderer.invoke('agent:hasLastRun', projectId),
    onProgress: (cb: (p: AgentProgress) => void): (() => void) => {
      const fn = (_: unknown, p: AgentProgress) => cb(p)
      ipcRenderer.on('agent:progress', fn)
      return () => { ipcRenderer.off('agent:progress', fn) }
    }
  },
  comments: {
    port: (): Promise<number> => ipcRenderer.invoke('comments:port'),
    list: (projectId: string): Promise<Comment[]> => ipcRenderer.invoke('comments:list', projectId),
    update: (id: string, patch: { status?: 'open' | 'resolved'; body?: string }): Promise<Comment | undefined> =>
      ipcRenderer.invoke('comments:update', id, patch),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('comments:remove', id),
    onChanged: (cb: (e: { projectId: string; kind: 'created' | 'updated' | 'deleted' }) => void): (() => void) => {
      const fn = (_: unknown, e: { projectId: string; kind: 'created' | 'updated' | 'deleted' }) => cb(e)
      ipcRenderer.on('comments:changed', fn)
      return () => { ipcRenderer.off('comments:changed', fn) }
    }
  }
}

export type DemoxApi = typeof api

contextBridge.exposeInMainWorld('demox', api)
