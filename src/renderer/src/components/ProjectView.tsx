import { useEffect, useRef, useState } from 'react'
import type { DevServerState, LogEvent, Project } from '../../../shared/types'

interface Props {
  project: Project
  state: DevServerState | undefined
  logs: LogEvent[]
  onDelete: () => void
}

export function ProjectView({ project, state, logs, onDelete }: Props) {
  const status = state?.status ?? 'idle'
  const url = state?.url
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const start = async () => {
    setBusy(true)
    try { await window.demox.dev.start(project.id) } finally { setBusy(false) }
  }
  const stop = async () => {
    setBusy(true)
    try { await window.demox.dev.stop(project.id) } finally { setBusy(false) }
  }
  const reveal = () => window.demox.projects.reveal(project.id)
  const open = () => url && window.demox.shell.openExternal(url)

  return (
    <>
      <div className="toolbar">
        <span className={`status-dot ${status}`} />
        <span className="title">{project.name}</span>
        <div className="url" title={url ?? ''}>{url ?? (status === 'starting' ? 'starting…' : 'not running')}</div>
        {status === 'running' || status === 'starting' ? (
          <button onClick={stop} disabled={busy}>Stop</button>
        ) : (
          <button className="primary" onClick={start} disabled={busy}>Run</button>
        )}
        <button onClick={open} disabled={!url}>Open</button>
        <button onClick={reveal}>Reveal files</button>
        <button className="danger ghost" onClick={onDelete}>Delete</button>
      </div>
      <div className="content">
        <div className="preview">
          {url ? (
            <iframe src={url} title={project.name} sandbox="allow-scripts allow-same-origin allow-forms" />
          ) : (
            <div className="placeholder">
              {status === 'starting' ? 'Starting dev server…' : 'Click Run to start the dev server.'}
            </div>
          )}
        </div>
        <div className="logs" ref={logRef}>
          {logs.length === 0 ? <span style={{ color: '#555' }}>No logs yet.</span> : null}
          {logs.map((l, i) => (
            <div key={i} className={`log-${l.stream}`}>{l.line}</div>
          ))}
        </div>
      </div>
    </>
  )
}
