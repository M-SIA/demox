import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deployment } from '../shared/types.js'

interface Db {
  deployments: Deployment[]
}

let cache: Db | null = null

function path(): string {
  return join(app.getPath('userData'), 'deployments.json')
}

async function load(): Promise<Db> {
  if (cache) return cache
  if (!existsSync(path())) {
    cache = { deployments: [] }
    return cache
  }
  cache = JSON.parse(await readFile(path(), 'utf8')) as Db
  return cache
}

async function persist(): Promise<void> {
  if (!cache) return
  await writeFile(path(), JSON.stringify(cache, null, 2), 'utf8')
}

export async function listForProject(projectId: string): Promise<Deployment[]> {
  const db = await load()
  return db.deployments
    .filter((d) => d.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function add(d: Deployment): Promise<void> {
  const db = await load()
  db.deployments.push(d)
  await persist()
}

export async function update(id: string, patch: Partial<Deployment>): Promise<Deployment | undefined> {
  const db = await load()
  const idx = db.deployments.findIndex((d) => d.id === id)
  if (idx < 0) return undefined
  db.deployments[idx] = { ...db.deployments[idx], ...patch, updatedAt: Date.now() }
  await persist()
  return db.deployments[idx]
}

export async function removeForProject(projectId: string): Promise<void> {
  const db = await load()
  db.deployments = db.deployments.filter((d) => d.projectId !== projectId)
  await persist()
}
