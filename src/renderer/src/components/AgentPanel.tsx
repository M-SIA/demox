import { useEffect, useRef, useState } from 'react'
import type { AgentProgress, AgentStatus, Comment, Project } from '../../../shared/types'

interface Props {
  project: Project
  /** when provided, run against only this comment */
  comment?: Comment | null
  onClose: () => void
  onOpenSettings: () => void
}

interface Line {
  kind: 'system' | 'text' | 'tool' | 'edit' | 'error'
  content: string
}

export function AgentPanel({ project, comment, onClose, onOpenSettings }: Props) {
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<AgentStatus | 'idle'>('idle')
  const [lines, setLines] = useState<Line[]>([])
  const [extra, setExtra] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.demox.secrets.list().then((t) => setHasKey(!!t.anthropic))
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  useEffect(() => {
    const off = window.demox.agent.onProgress((p: AgentProgress) => {
      if (p.projectId !== project.id) return
      setStatus(p.status)
      setLines((prev) => {
        const next = [...prev]
        if (p.line) next.push({ kind: 'system', content: p.line })
        if (p.textDelta) {
          const last = next[next.length - 1]
          if (last?.kind === 'text') last.content += p.textDelta
          else next.push({ kind: 'text', content: p.textDelta })
        }
        if (p.tool) next.push({ kind: 'tool', content: `${p.tool.name} · ${p.tool.state}` })
        if (p.editedFile) next.push({ kind: 'edit', content: `edited ${p.editedFile}` })
        if (p.error) next.push({ kind: 'error', content: p.error })
        return next
      })
    })
    return off
  }, [project.id])

  const run = async () => {
    setLines([])
    setStatus('starting')
    try {
      const r = await window.demox.agent.run({
        projectId: project.id,
        commentIds: comment ? [comment.id] : undefined,
        extraInstruction: extra.trim() || undefined
      })
      setRunId(r.runId)
    } catch (err) {
      setStatus('error')
      setLines((prev) => [...prev, { kind: 'error', content: err instanceof Error ? err.message : String(err) }])
    }
  }

  const cancel = async () => {
    if (runId) await window.demox.agent.cancel(runId)
  }

  const running = status === 'starting' || status === 'running'

  return (
    <div className="dialog-backdrop" onClick={running ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 720 }}>
        <h3>Fix with AI{comment ? ' · single comment' : ''}</h3>

        {!hasKey ? (
          <div className="row">
            <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>
              Connect an Anthropic API key to use the AI fix loop.
            </p>
            <button className="primary" onClick={onOpenSettings}>Open Settings</button>
          </div>
        ) : (
          <>
            {comment && (
              <div className="row">
                <label>Comment</label>
                <div style={{ background: 'var(--panel-2)', padding: 10, borderRadius: 8, fontSize: 13 }}>
                  <strong>{comment.author}:</strong> {comment.body}
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                    &lt;{comment.target.tag}&gt; · {comment.viewport.routePath}
                  </div>
                </div>
              </div>
            )}
            <div className="row">
              <label>Extra instructions (optional)</label>
              <textarea
                rows={2}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. keep existing styling; prefer small edits"
                disabled={running}
              />
            </div>
            <div className="row" style={{ display: 'flex', gap: 8 }}>
              {running ? (
                <button className="danger ghost" onClick={cancel}>Cancel</button>
              ) : (
                <button className="primary" onClick={run}>
                  {comment ? 'Fix this comment' : 'Fix all open comments'}
                </button>
              )}
              <span style={{ color: 'var(--muted)', fontSize: 12, alignSelf: 'center' }}>
                Status: {status}
              </span>
            </div>
            <div className="row">
              <label>Agent output</label>
              <div className="agent-log" ref={logRef}>
                {lines.length === 0 && (
                  <span style={{ color: '#555' }}>No activity yet.</span>
                )}
                {lines.map((l, i) => (
                  <div key={i} className={`agent-line k-${l.kind}`}>{l.content}</div>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button onClick={onClose} disabled={running}>Close</button>
        </div>
      </div>
    </div>
  )
}
