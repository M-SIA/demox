import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { projectsDbPath } from './paths.js'
import type { Project } from '../shared/types.js'

interface DbShape {
  projects: Project[]
}

let cache: DbShape | null = null

async function load(): Promise<DbShape> {
  if (cache) return cache
  const path = projectsDbPath()
  if (!existsSync(path)) {
    cache = { projects: [] }
    return cache
  }
  const raw = await readFile(path, 'utf8')
  cache = JSON.parse(raw) as DbShape
  return cache
}

async function persist(): Promise<void> {
  if (!cache) return
  await writeFile(projectsDbPath(), JSON.stringify(cache, null, 2), 'utf8')
}

export async function listProjects(): Promise<Project[]> {
  const db = await load()
  return [...db.projects].sort((a, b) => b.createdAt - a.createdAt)
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await load()
  return db.projects.find((p) => p.id === id)
}

export async function addProject(p: Project): Promise<void> {
  const db = await load()
  db.projects.push(p)
  await persist()
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined> {
  const db = await load()
  const idx = db.projects.findIndex((p) => p.id === id)
  if (idx < 0) return undefined
  db.projects[idx] = { ...db.projects[idx], ...patch }
  await persist()
  return db.projects[idx]
}

export async function removeProject(id: string): Promise<void> {
  const db = await load()
  db.projects = db.projects.filter((p) => p.id !== id)
  await persist()
}
