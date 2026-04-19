import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function workspaceRoot(): string {
  const p = join(app.getPath('userData'), 'workspaces')
  mkdirSync(p, { recursive: true })
  return p
}

export function projectsDbPath(): string {
  return join(app.getPath('userData'), 'projects.json')
}
