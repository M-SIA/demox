import type { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { createOpencodeClient, createOpencodeServer, type Config, type Event } from '@opencode-ai/sdk'
import type { AgentProgress, Comment, CustomProvider, FileDiffEntry, Project, RunAgentInput } from '../../shared/types.js'
import { listForProject, update as updateComment } from '../commentStore.js'
import { getProject } from '../store.js'
import { getToken } from '../secrets.js'
import * as settings from '../settings.js'
import { buildFixPrompt, SYSTEM_PROMPT } from './prompt.js'
import { ensureOnPath } from './binary.js'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

interface ServerHandle {
  url: string
  close(): void
}

interface CachedServer {
  handle: ServerHandle
  signature: string
}

let cached: CachedServer | null = null
let pending: Promise<ServerHandle> | null = null

function buildServerConfig(custom?: CustomProvider): Config {
  const config: Config = {
    logLevel: 'WARN',
    permission: { edit: 'allow', bash: 'ask', webfetch: 'deny' },
    share: 'disabled',
    autoupdate: false
  }
  if (custom?.id && custom.baseURL && custom.modelId) {
    config.provider = {
      [custom.id]: {
        name: custom.name ?? custom.id,
        npm: custom.npm ?? '@ai-sdk/openai',
        models: {
          [custom.modelId]: {
            id: custom.modelId,
            name: custom.modelName ?? custom.modelId,
            ...(custom.reasoning !== undefined ? { reasoning: custom.reasoning } : {}),
            ...(custom.toolCall !== undefined ? { tool_call: custom.toolCall } : { tool_call: true })
          }
        },
        options: { baseURL: custom.baseURL }
      } as Config['provider'] extends Record<string, infer V> | undefined ? V : never
    }
  }
  return config
}

function signatureOf(config: Config): string {
  return JSON.stringify(config.provider ?? {})
}

async function ensureServer(): Promise<ServerHandle> {
  const cfg = buildServerConfig((await settings.get()).customProvider)
  const sig = signatureOf(cfg)

  if (cached && cached.signature === sig) return cached.handle
  if (pending) return pending

  // Shut down previous server if the provider config changed.
  if (cached) {
    try { cached.handle.close() } catch { /* ignore */ }
    cached = null
  }

  pending = (async () => {
    try {
      ensureOnPath()
      const srv = await createOpencodeServer({
        hostname: '127.0.0.1',
        port: 0,
        timeout: 20000,
        config: cfg
      })
      cached = { handle: srv, signature: sig }
      return srv
    } catch (err) {
      throw new Error(
        'Could not start the bundled opencode server. ' +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      pending = null
    }
  })()
  return pending
}

export async function shutdownServer(): Promise<void> {
  if (pending) {
    try { (await pending).close() } catch { /* ignore */ }
  } else if (cached) {
    try { cached.handle.close() } catch { /* ignore */ }
  }
  cached = null
  pending = null
}

export function invalidateServer(): void {
  // Called by settings:update so the next run picks up new provider config.
  if (cached) {
    try { cached.handle.close() } catch { /* ignore */ }
  }
  cached = null
}

const inflight = new Map<string, { abort: AbortController; projectId: string }>()
const lastRun = new Map<string, { sessionID: string; userMessageID: string; resolvedCommentIds: string[] }>()

function emit(win: BrowserWindow, p: AgentProgress): void {
  win.webContents.send('agent:progress', p)
}

function parseModel(input: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = input.split('/')
  const modelID = rest.join('/')
  if (!providerID || !modelID) return { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' }
  return { providerID, modelID }
}

async function setAuthForProvider(
  client: ReturnType<typeof createOpencodeClient>,
  providerID: string
): Promise<void> {
  const key = await getToken(providerID)
  if (!key) {
    throw new Error(
      `No API key configured for provider "${providerID}". Add it in Settings.`
    )
  }
  await client.auth.set({
    path: { id: providerID },
    body: { type: 'api', key },
    throwOnError: true
  })
}

export async function run(input: RunAgentInput, win: BrowserWindow): Promise<{ runId: string }> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')

  const appSettings = await settings.get()
  const { providerID, modelID } = parseModel(appSettings.model || DEFAULT_MODEL)

  const runId = nanoid(10)
  const abort = new AbortController()
  inflight.set(runId, { abort, projectId: project.id })

  emit(win, { projectId: project.id, runId, status: 'starting', line: 'Starting opencode server…' })

  try {
    const server = await ensureServer()
    const client = createOpencodeClient({ baseUrl: server.url, directory: project.path })

    emit(win, {
      projectId: project.id,
      runId,
      status: 'starting',
      line: `Setting credentials for ${providerID}…`
    })
    await setAuthForProvider(client, providerID)

    const allComments = await listForProject(project.id)
    const targets: Comment[] = input.commentIds?.length
      ? allComments.filter((c) => input.commentIds!.includes(c.id))
      : allComments.filter((c) => c.status === 'open')
    if (targets.length === 0) throw new Error('No open comments to fix.')

    emit(win, {
      projectId: project.id,
      runId,
      status: 'starting',
      line: `Preparing session for ${targets.length} comment(s)…`
    })

    const session = await client.session.create({
      query: { directory: project.path },
      body: { title: `demox fix · ${new Date().toLocaleString()}` },
      throwOnError: true
    })
    const sessionID = session.data!.id

    emit(win, { projectId: project.id, runId, status: 'running', line: `Model: ${providerID}/${modelID}` })

    const sub = await client.event.subscribe({ query: { directory: project.path }, signal: abort.signal })
    const stream = sub.stream as AsyncIterable<{ data?: Event }>

    const prompt = buildFixPrompt(project, targets, input.extraInstruction)
    const promptPromise = client.session.prompt({
      path: { id: sessionID },
      query: { directory: project.path },
      body: {
        model: { providerID, modelID },
        system: SYSTEM_PROMPT,
        parts: [{ type: 'text', text: prompt }]
      },
      throwOnError: true,
      signal: abort.signal
    })

    const consume = async () => {
      for await (const msg of stream) {
        if (abort.signal.aborted) break
        const ev = msg.data
        if (!ev) continue
        if (ev.type === 'message.part.updated') {
          const part = ev.properties.part as { type: string; text?: string; tool?: string; state?: { status?: string } }
          const delta = ev.properties.delta
          if (part.type === 'text') {
            emit(win, { projectId: project.id, runId, status: 'running', textDelta: delta ?? part.text })
          } else if (part.type === 'tool') {
            const status = (part.state as { status?: string } | undefined)?.status ?? 'running'
            emit(win, {
              projectId: project.id,
              runId,
              status: 'running',
              tool: { name: part.tool ?? 'tool', state: status }
            })
          }
        } else if (ev.type === 'file.edited') {
          emit(win, { projectId: project.id, runId, status: 'running', editedFile: ev.properties.file })
        } else if (ev.type === 'session.error') {
          const props = ev.properties as { sessionID?: string; error?: { message?: string } }
          if (!props.sessionID || props.sessionID === sessionID) {
            emit(win, {
              projectId: project.id,
              runId,
              status: 'error',
              error: props.error?.message ?? 'session error'
            })
          }
        } else if (ev.type === 'session.idle') {
          if (ev.properties.sessionID === sessionID) break
        }
      }
    }

    const [_, consumed] = await Promise.allSettled([promptPromise, consume()])

    if (consumed.status === 'rejected' && !abort.signal.aborted) {
      throw consumed.reason
    }

    for (const c of targets) {
      await updateComment(c.id, { status: 'resolved' })
    }
    win.webContents.send('comments:changed', { projectId: project.id, kind: 'updated' })

    // Capture last user message id so UI can show diffs or revert.
    try {
      const msgs = await client.session.messages({
        path: { id: sessionID },
        query: { directory: project.path },
        throwOnError: true
      })
      const list = (msgs.data ?? []) as Array<{ info: { id: string; role: string } }>
      const userMsgs = list.filter((m) => m.info.role === 'user')
      const lastUser = userMsgs[userMsgs.length - 1]
      if (lastUser) {
        lastRun.set(project.id, {
          sessionID,
          userMessageID: lastUser.info.id,
          resolvedCommentIds: targets.map((t) => t.id)
        })
      }
    } catch {
      // best-effort; diff/revert will simply be unavailable
    }

    emit(win, { projectId: project.id, runId, status: 'done', line: 'All comments processed.' })
    return { runId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emit(win, {
      projectId: project.id,
      runId,
      status: abort.signal.aborted ? 'canceled' : 'error',
      error: msg
    })
    throw err
  } finally {
    inflight.delete(runId)
  }
}

export function cancel(runId: string): void {
  const entry = inflight.get(runId)
  if (entry) entry.abort.abort()
}

export function isRunning(): boolean {
  return inflight.size > 0
}

export function currentServerUrl(): string | null {
  return cached?.handle.url ?? null
}

export function hasLastRun(projectId: string): boolean {
  return lastRun.has(projectId)
}

export async function lastRunDiff(projectId: string): Promise<FileDiffEntry[]> {
  const entry = lastRun.get(projectId)
  if (!entry) return []
  const project = await getProject(projectId)
  if (!project) return []
  const server = await ensureServer()
  const client = createOpencodeClient({ baseUrl: server.url, directory: project.path })
  const res = await client.session.diff({
    path: { id: entry.sessionID },
    query: { directory: project.path, messageID: entry.userMessageID },
    throwOnError: true
  })
  return (res.data ?? []) as FileDiffEntry[]
}

export async function revertLastRun(projectId: string, win: BrowserWindow): Promise<void> {
  const entry = lastRun.get(projectId)
  if (!entry) throw new Error('No recent fix to undo.')
  const project = await getProject(projectId)
  if (!project) throw new Error('Project not found')
  const server = await ensureServer()
  const client = createOpencodeClient({ baseUrl: server.url, directory: project.path })
  await client.session.revert({
    path: { id: entry.sessionID },
    query: { directory: project.path },
    body: { messageID: entry.userMessageID },
    throwOnError: true
  })
  // Reopen the comments we auto-resolved.
  for (const cid of entry.resolvedCommentIds) {
    await updateComment(cid, { status: 'open' })
  }
  win.webContents.send('comments:changed', { projectId, kind: 'updated' })
  lastRun.delete(projectId)
}
