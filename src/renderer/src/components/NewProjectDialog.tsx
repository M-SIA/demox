import { useEffect, useState } from 'react'
import type { Project, TemplateInfo, TemplateId } from '../../../shared/types'

interface Props {
  templates: TemplateInfo[]
  onClose: () => void
  onCreated: (p: Project) => void
}

export function NewProjectDialog({ templates, onClose, onCreated }: Props) {
  const [name, setName] = useState('My prototype')
  const [template, setTemplate] = useState<TemplateId>('vite-react')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const off = window.demox.projects.onCreateProgress((p) => {
      setProgress((prev) => [...prev, `[${p.step}] ${p.message}`])
      if (p.step === 'error') setError(p.message)
    })
    return off
  }, [])

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setProgress([])
    setError(null)
    try {
      const project = await window.demox.projects.create({ name: name.trim(), template })
      onCreated(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>New prototype</h3>
        <div className="row">
          <label>Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="row">
          <label>Scaffold</label>
          <div className="templates">
            {templates.map((t) => (
              <button
                key={t.id}
                className={`template-card ${template === t.id ? 'selected' : ''}`}
                onClick={() => setTemplate(t.id)}
                disabled={busy}
                type="button"
              >
                <div className="t-name">{t.name}</div>
                <div className="t-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
        {(busy || progress.length > 0) && (
          <div className="row">
            <label>Progress</label>
            <div className="progress">
              {progress.length === 0 ? 'starting…' : progress.join('\n')}
              {error ? `\n\n${error}` : ''}
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
