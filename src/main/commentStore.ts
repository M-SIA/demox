import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nanoid } from 'nanoid'
import type { Comment, CreateCommentInput } from '../shared/types.js'

interface Db {
  comments: Comment[]
}

let cache: Db | null = null

function path(): string {
  return join(app.getPath('userData'), 'comments.json')
}

async function load(): Promise<Db> {
  if (cache) return cache
  if (!existsSync(path())) {
    cache = { comments: [] }
    return cache
  }
  cache = JSON.parse(await readFile(path(), 'utf8')) as Db
  return cache
}

async function persist(): Promise<void> {
  if (!cache) return
  await writeFile(path(), JSON.stringify(cache, null, 2), 'utf8')
}

export async function listForProject(projectId: string): Promise<Comment[]> {
  const db = await load()
  return db.comments
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function create(input: CreateCommentInput): Promise<Comment> {
  const db = await load()
  const now = Date.now()
  const c: Comment = {
    id: nanoid(10),
    projectId: input.projectId,
    author: input.author?.slice(0, 60) || 'Anonymous',
    body: input.body.slice(0, 4000),
    status: 'open',
    target: input.target,
    viewport: input.viewport,
    createdAt: now,
    updatedAt: now
  }
  db.comments.push(c)
  await persist()
  return c
}

export async function update(id: string, patch: Partial<Pick<Comment, 'status' | 'body'>>): Promise<Comment | undefined> {
  const db = await load()
  const idx = db.comments.findIndex((c) => c.id === id)
  if (idx < 0) return undefined
  db.comments[idx] = { ...db.comments[idx], ...patch, updatedAt: Date.now() }
  await persist()
  return db.comments[idx]
}

export async function remove(id: string): Promise<void> {
  const db = await load()
  db.comments = db.comments.filter((c) => c.id !== id)
  await persist()
}

export async function removeForProject(projectId: string): Promise<void> {
  const db = await load()
  db.comments = db.comments.filter((c) => c.projectId !== projectId)
  await persist()
}
