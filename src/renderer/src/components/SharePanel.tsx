import { useEffect, useState } from 'react'
import type { DeployProgress, Deployment, Project } from '../../../shared/types'

interface Props {
  project: Project
  onOpenSettings: () => void
  onClose: () => void
}

export function SharePanel({ project, onOpenSettings, onClose }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [hasToken, setHasToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<DeployProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = async () => {
    setDeployments(await window.demox.deploy.list(project.id))
    const t = await window.demox.secrets.list()
    setHasToken(!!t.vercel)
  }

  useEffect(() => {
    void refresh()
    const off = window.demox.deploy.onProgress((p) => {
      if (p.projectId !== project.id) return
      setProgress(p)
      if (p.status === 'ready' || p.status === 'error' || p.status === 'canceled') {
        setBusy(false)
        void refresh()
      }
    })
    return off
  }, [project.id])

  const start = async () => {
    setError(null)
    setProgress(null)
    setBusy(true)
    try {
      await window.demox.deploy.start(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const copy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200)
  }

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
        <h3>Share — {project.name}</h3>

        {!hasToken ? (
          <div className="row">
            <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>
              Connect a Vercel token to deploy a shareable URL.
            </p>
            <button className="primary" onClick={onOpenSettings}>Open Settings</button>
          </div>
        ) : (
          <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="primary" onClick={start} disabled={busy}>
              {busy ? 'Deploying…' : 'Deploy new version'}
            </button>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Source uploads to Vercel; build runs there.
            </span>
          </div>
        )}

        {progress && (
          <div className="row">
            <label>Status</label>
            <div className="progress">
              [{progress.status}] {progress.message}
              {progress.url ? `\n${progress.url}` : ''}
            </div>
          </div>
        )}
        {error && <div className="row" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

        <div className="row">
          <label>History</label>
          {deployments.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>No deployments yet.</div>
          ) : (
            <div className="deploy-list">
              {deployments.map((d) => (
                <div key={d.id} className="deploy-item">
                  <span className={`status-dot ${d.status === 'ready' ? 'running' : d.status === 'error' ? 'error' : 'starting'}`} />
                  <div className="deploy-meta">
                    <div className="deploy-url" title={d.url ?? ''}>{d.url ?? '—'}</div>
                    <div className="deploy-sub">
                      {d.status} · {new Date(d.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {d.url && d.status === 'ready' && (
                    <>
                      <button onClick={() => copy(d.url!, d.id)}>{copiedId === d.id ? 'Copied!' : 'Copy'}</button>
                      <button onClick={() => window.demox.shell.openExternal(d.url!)}>Open</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button onClick={onClose} disabled={busy}>Close</button>
        </div>
      </div>
    </div>
  )
}
