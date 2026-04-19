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

export type DeployProvider = 'vercel'

export type DeployStatus = 'preparing' | 'uploading' | 'building' | 'ready' | 'error' | 'canceled'

export interface Deployment {
  id: string
  projectId: string
  provider: DeployProvider
  /** provider's deployment id */
  remoteId?: string
  url?: string
  status: DeployStatus
  error?: string
  createdAt: number
  updatedAt: number
}

export interface DeployProgress {
  deploymentId: string
  projectId: string
  status: DeployStatus
  message: string
  url?: string
}

export interface ProviderTokens {
  vercel?: boolean
}

export interface CommentTarget {
  /** computed CSS selector of the clicked element */
  selector: string
  /** full XPath as fallback */
  xpath: string
  /** click coordinates within the element (0-1 ratios) */
  rx: number
  ry: number
  /** bounding box snapshot at time of comment, in viewport coordinates */
  rect: { x: number; y: number; w: number; h: number }
  /** rendered text snippet of the element (up to ~120 chars) */
  text?: string
  /** tag name */
  tag: string
  /** optional source location captured via data-demox-loc / __source */
  sourceLoc?: string
}

export interface CommentViewport {
  w: number
  h: number
  scrollX: number
  scrollY: number
  pageUrl: string
  routePath: string
}

export interface Comment {
  id: string
  projectId: string
  author: string
  body: string
  status: 'open' | 'resolved'
  target: CommentTarget
  viewport: CommentViewport
  createdAt: number
  updatedAt: number
}

export interface CreateCommentInput {
  projectId: string
  author?: string
  body: string
  target: CommentTarget
  viewport: CommentViewport
}
