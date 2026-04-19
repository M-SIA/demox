import { useEffect, useMemo, useRef, useState } from 'react'
import type { DevServerState, LogEvent, Project } from '../../../shared/types'
import { CommentsPanel } from './CommentsPanel'

interface Props {
  project: Project
  state: DevServerState | undefined
  logs: LogEvent[]
  onDelete: () => void
  onShare: () => void
}

export function ProjectView({ project, state, logs, onDelete, onShare }: Props) {
  const status = state?.status ?? 'idle'
  const url = state?.url
  const [busy, setBusy] = useState(false)
  const [commentPort, setCommentPort] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.demox.comments.port().then(setCommentPort)
  }, [])

  const previewSrc = useMemo(() => {
    if (!url || !commentPort) return url
    const sep = url.includes('?') ? '&' : '?'
    const sdk = `http://127.0.0.1:${commentPort}/sdk.js`
    const api = `http://127.0.0.1:${commentPort}`
    return `${url}${sep}__demox_sdk=${encodeURIComponent(sdk)}&__demox_api=${encodeURIComponent(api)}&__demox_pid=${encodeURIComponent(project.id)}`
  }, [url, commentPort, project.id])

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
        <button className="primary" onClick={onShare}>Share</button>
        <button className="danger ghost" onClick={onDelete}>Delete</button>
      </div>
      <div className="content with-comments">
        <div className="preview">
          {previewSrc ? (
            <iframe src={previewSrc} title={project.name} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
          ) : (
            <div className="placeholder">
              {status === 'starting' ? 'Starting dev server…' : 'Click Run to start the dev server.'}
            </div>
          )}
        </div>
        <CommentsPanel projectId={project.id} />
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
