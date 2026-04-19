import { execa, type ResultPromise } from 'execa'
import treeKill from 'tree-kill'
import type { BrowserWindow } from 'electron'
import type { DevServerState, LogEvent, Project } from '../shared/types.js'
import { findTemplate } from '../shared/templates.js'
import { updateProject } from './store.js'

interface RunningServer {
  state: DevServerState
  child: ResultPromise
}

const servers = new Map<string, RunningServer>()

const URL_RE = /(https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/[^\s)]*)?)/i

function emitState(win: BrowserWindow, state: DevServerState): void {
  win.webContents.send('dev:state', state)
}

function emitLog(win: BrowserWindow, ev: LogEvent): void {
  win.webContents.send('dev:log', ev)
}

export function getState(projectId: string): DevServerState {
  const s = servers.get(projectId)
  return s?.state ?? { projectId, status: 'idle' }
}

export async function start(project: Project, win: BrowserWindow): Promise<DevServerState> {
  if (servers.has(project.id)) return servers.get(project.id)!.state

  const tpl = findTemplate(project.template)
  if (!tpl) throw new Error(`Unknown template: ${project.template}`)

  const state: DevServerState = { projectId: project.id, status: 'starting' }
  emitState(win, state)

  const child = execa(tpl.packageManager, ['run', tpl.devScript], {
    cwd: project.path,
    env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none' },
    reject: false,
    stdin: 'ignore'
  })

  const handleLine = (stream: 'stdout' | 'stderr', line: string) => {
    emitLog(win, { projectId: project.id, stream, line, ts: Date.now() })
    if (state.status !== 'running') {
      const m = line.match(URL_RE)
      if (m) {
        state.status = 'running'
        state.url = m[1].replace('localhost', '127.0.0.1')
        emitState(win, state)
        void updateProject(project.id, { lastUrl: state.url })
      }
    }
  }

  child.stdout?.on('data', (d: Buffer) => {
    for (const ln of d.toString().split(/\r?\n/)) if (ln) handleLine('stdout', ln)
  })
  child.stderr?.on('data', (d: Buffer) => {
    for (const ln of d.toString().split(/\r?\n/)) if (ln) handleLine('stderr', ln)
  })

  state.pid = child.pid
  servers.set(project.id, { state, child })

  child.then((res) => {
    const final: DevServerState = {
      projectId: project.id,
      status: res.failed ? 'error' : 'stopped',
      error: res.failed ? res.shortMessage : undefined
    }
    servers.delete(project.id)
    emitState(win, final)
  })

  return state
}

export async function stop(projectId: string): Promise<void> {
  const s = servers.get(projectId)
  if (!s?.state.pid) return
  await new Promise<void>((resolve) => treeKill(s.state.pid!, 'SIGTERM', () => resolve()))
}

export async function stopAll(): Promise<void> {
  await Promise.all([...servers.keys()].map(stop))
}
