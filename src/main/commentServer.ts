import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { BrowserWindow } from 'electron'
import { COMMENT_SDK_SOURCE } from './commentSdk.js'
import * as store from './commentStore.js'
import type { CreateCommentInput } from '../shared/types.js'

let server: Server | null = null
let port = 0
let mainWin: BrowserWindow | null = null

function setCors(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}'
        resolve(JSON.parse(raw) as T)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  setCors(res)
  res.statusCode = status
  res.setHeader('content-type', type)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function emitChange(projectId: string, kind: 'created' | 'updated' | 'deleted'): void {
  mainWin?.webContents.send('comments:changed', { projectId, kind })
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', 'http://localhost')
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.statusCode = 204
    res.end()
    return
  }

  if (url.pathname === '/sdk.js' && req.method === 'GET') {
    setCors(res)
    res.setHeader('content-type', 'application/javascript; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(COMMENT_SDK_SOURCE)
    return
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    send(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/comments') {
    const projectId = url.searchParams.get('p')
    if (!projectId) return send(res, 400, { error: 'missing p' })

    if (req.method === 'GET') {
      const list = await store.listForProject(projectId)
      return send(res, 200, list)
    }

    if (req.method === 'POST') {
      try {
        const input = await readJson<CreateCommentInput>(req)
        if (!input?.body || !input?.target?.selector) return send(res, 400, { error: 'invalid payload' })
        const created = await store.create({ ...input, projectId })
        emitChange(projectId, 'created')
        return send(res, 201, created)
      } catch (e) {
        return send(res, 400, { error: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  // /api/comments/:id
  const m = url.pathname.match(/^\/api\/comments\/([A-Za-z0-9_-]+)$/)
  if (m) {
    const id = m[1]
    const projectId = url.searchParams.get('p') || ''
    if (req.method === 'PATCH') {
      try {
        const patch = await readJson<{ status?: 'open' | 'resolved'; body?: string }>(req)
        const updated = await store.update(id, patch)
        if (!updated) return send(res, 404, { error: 'not found' })
        emitChange(projectId, 'updated')
        return send(res, 200, updated)
      } catch (e) {
        return send(res, 400, { error: e instanceof Error ? e.message : String(e) })
      }
    }
    if (req.method === 'DELETE') {
      await store.remove(id)
      emitChange(projectId, 'deleted')
      return send(res, 204, '')
    }
  }

  send(res, 404, { error: 'not found' })
}

export async function start(win: BrowserWindow): Promise<{ port: number }> {
  if (server) return { port }
  mainWin = win
  await new Promise<void>((resolve, reject) => {
    const s = createServer((req, res) => {
      handle(req, res).catch((e) => send(res, 500, { error: e instanceof Error ? e.message : String(e) }))
    })
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      server = s
      const addr = s.address()
      if (addr && typeof addr === 'object') port = addr.port
      resolve()
    })
  })
  return { port }
}

export function getPort(): number {
  return port
}

export async function stop(): Promise<void> {
  if (!server) return
  await new Promise<void>((resolve) => server!.close(() => resolve()))
  server = null
  port = 0
}
