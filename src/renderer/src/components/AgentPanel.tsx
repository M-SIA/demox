import { useEffect, useRef, useState } from 'react'
import type { AgentProgress, AgentStatus, Comment, FileDiffEntry, Project } from '../../../shared/types'

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

/**
 * Tiny unified-diff renderer. Not a true algorithm — shows before/after
 * block-style so PMs get a readable summary without pulling in a diff lib.
 */
function renderUnifiedDiff(before: string, after: string): string {
  const b = before.split('\n')
  const a = after.split('\n')
  const max = Math.max(b.length, a.length)
  const out: string[] = []
  for (let i = 0; i < max; i++) {
    const lb = b[i]
    const la = a[i]
    if (lb === la) {
      if (lb !== undefined) out.push('  ' + lb)
    } else {
      if (lb !== undefined) out.push('- ' + lb)
      if (la !== undefined) out.push('+ ' + la)
    }
  }
  return out.join('\n')
}

export function AgentPanel({ project, comment, onClose, onOpenSettings }: Props) {
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<AgentStatus | 'idle'>('idle')
  const [lines, setLines] = useState<Line[]>([])
  const [extra, setExtra] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [diff, setDiff] = useState<FileDiffEntry[] | null>(null)
  const [reverting, setReverting] = useState(false)
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
      if (p.status === 'done') {
        void window.demox.agent.diff(project.id).then(setDiff).catch(() => setDiff([]))
      }
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
    setDiff(null)
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

  const undo = async () => {
    setReverting(true)
    try {
      await window.demox.agent.revert(project.id)
      setDiff(null)
      setStatus('idle')
      setLines((prev) => [...prev, { kind: 'system', content: 'Reverted all changes from this run.' }])
    } catch (err) {
      setLines((prev) => [...prev, { kind: 'error', content: err instanceof Error ? err.message : String(err) }])
    } finally {
      setReverting(false)
    }
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
            {status === 'done' && diff && diff.length > 0 && (
              <div className="row">
                <label>Changes ({diff.length} file{diff.length === 1 ? '' : 's'})</label>
                <div className="diff-summary">
                  {diff.map((d) => (
                    <details key={d.file} className="diff-file">
                      <summary>
                        <code>{d.file}</code>
                        <span className="adds">+{d.additions}</span>
                        <span className="dels">−{d.deletions}</span>
                      </summary>
                      <pre className="diff-body">{renderUnifiedDiff(d.before, d.after)}</pre>
                    </details>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="primary" onClick={onClose} disabled={reverting}>Keep changes</button>
                  <button className="danger ghost" onClick={undo} disabled={reverting}>
                    {reverting ? 'Undoing…' : '↶ Undo this fix'}
                  </button>
                </div>
              </div>
            )}
            {status === 'done' && diff && diff.length === 0 && (
              <div className="row" style={{ color: 'var(--muted)', fontSize: 12 }}>
                Run finished without file edits.
              </div>
            )}
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
