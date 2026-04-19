export type TemplateId = 'vite-react' | 'next-app' | 'astro' | 'static-html'

export interface TemplateInfo {
  id: TemplateId
  name: string
  description: string
  /** package manager command used for install + dev */
  packageManager: 'npm' | 'pnpm'
  /** dev script run inside the project (e.g. "dev") */
  devScript: string
  /** url pattern to detect when reading dev server stdout */
  readyPattern: string
}

export interface Project {
  id: string
  name: string
  template: TemplateId
  path: string
  createdAt: number
  /** last known dev server url, if any */
  lastUrl?: string
}

export interface CreateProjectInput {
  name: string
  template: TemplateId
}

export type DevServerStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped'

export interface DevServerState {
  projectId: string
  status: DevServerStatus
  pid?: number
  url?: string
  error?: string
}

export interface LogEvent {
  projectId: string
  stream: 'stdout' | 'stderr' | 'system'
  line: string
  ts: number
}
