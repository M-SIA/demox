import { useEffect, useState } from 'react'
import type { ProviderTokens } from '../../../shared/types'

interface Props {
  onClose: () => void
}

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

export function SettingsDialog({ onClose }: Props) {
  const [tokens, setTokens] = useState<ProviderTokens>({})
  const [vercelToken, setVercelToken] = useState('')
  const [anthropicToken, setAnthropicToken] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const refresh = async () => {
    setTokens(await window.demox.secrets.list())
    const s = await window.demox.settings.get()
    setModel(s.model || DEFAULT_MODEL)
  }
  useEffect(() => { void refresh() }, [])

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (vercelToken.trim()) await window.demox.secrets.set('vercel', vercelToken.trim())
      if (anthropicToken.trim()) await window.demox.secrets.set('anthropic', anthropicToken.trim())
      await window.demox.settings.update({ model: model.trim() || DEFAULT_MODEL })
      setVercelToken('')
      setAnthropicToken('')
      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const clear = async (key: 'vercel' | 'anthropic') => {
    setBusy(true)
    try {
      await window.demox.secrets.clear(key)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <div className="row">
          <label>Anthropic API key {tokens.anthropic ? '· connected' : '· not set'}</label>
          <input
            type="password"
            placeholder={tokens.anthropic ? 'Replace existing key…' : 'sk-ant-…'}
            value={anthropicToken}
            onChange={(e) => setAnthropicToken(e.target.value)}
            disabled={busy}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Used by the AI fix loop via opencode.</span>
            {tokens.anthropic && (
              <button className="danger ghost" onClick={() => clear('anthropic')} disabled={busy} style={{ padding: '2px 6px', fontSize: 11 }}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="row">
          <label>Model (provider/modelID)</label>
          <input
            placeholder={DEFAULT_MODEL}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="row">
          <label>Vercel personal token {tokens.vercel ? '· connected' : '· not set'}</label>
          <input
            type="password"
            placeholder={tokens.vercel ? 'Replace existing token…' : 'paste token here'}
            value={vercelToken}
            onChange={(e) => setVercelToken(e.target.value)}
            disabled={busy}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>vercel.com → Account Settings → Tokens.</span>
            {tokens.vercel && (
              <button className="danger ghost" onClick={() => clear('vercel')} disabled={busy} style={{ padding: '2px 6px', fontSize: 11 }}>
                Remove
              </button>
            )}
          </div>
        </div>

        {error && <div className="row" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {saved && <div className="row" style={{ color: 'var(--ok)', fontSize: 12 }}>Saved.</div>}

        <div className="dialog-actions">
          <button onClick={onClose} disabled={busy}>Close</button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
