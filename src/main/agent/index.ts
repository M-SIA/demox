import type { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { createOpencodeClient, createOpencodeServer, type Event } from '@opencode-ai/sdk'
import type { AgentProgress, Comment, Project, RunAgentInput } from '../../shared/types.js'
import { listForProject, update as updateComment } from '../commentStore.js'
import { getProject } from '../store.js'
import { getToken } from '../secrets.js'
import * as settings from '../settings.js'
import { buildFixPrompt, SYSTEM_PROMPT } from './prompt.js'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

interface ServerHandle {
  url: string
  close(): void
}

let serverPromise: Promise<ServerHandle> | null = null

async function ensureServer(): Promise<ServerHandle> {
  if (serverPromise) return serverPromise
  serverPromise = (async () => {
    try {
      const srv = await createOpencodeServer({
        hostname: '127.0.0.1',
        port: 0,
        timeout: 15000,
        config: {
          logLevel: 'WARN',
          permission: { edit: 'allow', bash: 'ask', webfetch: 'deny' },
          share: 'disabled',
          autoupdate: false
        }
      })
      return srv
    } catch (err) {
      serverPromise = null
      throw new Error(
        'Could not start opencode server. Make sure the `opencode` CLI is installed ' +
          'and on PATH (see https://opencode.ai). Underlying error: ' +
          (err instanceof Error ? err.message : String(err))
      )
    }
  })()
  return serverPromise
}

export async function shutdownServer(): Promise<void> {
  if (!serverPromise) return
  try {
    const s = await serverPromise
    s.close()
  } catch {
    // ignore
  }
  serverPromise = null
}

const inflight = new Map<string, { abort: AbortController; projectId: string }>()

function emit(win: BrowserWindow, p: AgentProgress): void {
  win.webContents.send('agent:progress', p)
}

function parseModel(input: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = input.split('/')
  const modelID = rest.join('/')
  if (!providerID || !modelID) return { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' }
  return { providerID, modelID }
}

export async function run(input: RunAgentInput, win: BrowserWindow): Promise<{ runId: string }> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')

  const anthropicKey = await getToken('anthropic')
  if (!anthropicKey) throw new Error('Anthropic API key required. Add it in Settings.')

  const runId = nanoid(10)
  const abort = new AbortController()
  inflight.set(runId, { abort, projectId: project.id })

  emit(win, { projectId: project.id, runId, status: 'starting', line: 'Starting opencode server…' })

  try {
    const server = await ensureServer()
    const client = createOpencodeClient({ baseUrl: server.url, directory: project.path })

    emit(win, { projectId: project.id, runId, status: 'starting', line: 'Setting Anthropic credentials…' })
    await client.auth.set({
      path: { id: 'anthropic' },
      body: { type: 'api', key: anthropicKey },
      throwOnError: true
    })

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

    const { providerID, modelID } = parseModel((await settings.get()).model || DEFAULT_MODEL)

    emit(win, { projectId: project.id, runId, status: 'running', line: `Model: ${providerID}/${modelID}` })

    // SSE subscription — start before prompt so we don't miss early events.
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

    // Consume events until session.idle for this session, or prompt resolves.
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

    // Auto-resolve the targeted comments.
    for (const c of targets) {
      await updateComment(c.id, { status: 'resolved' })
    }
    win.webContents.send('comments:changed', { projectId: project.id, kind: 'updated' })

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
