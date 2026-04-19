import { useEffect, useState } from 'react'
import type { ProviderTokens } from '../../../shared/types'

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const [tokens, setTokens] = useState<ProviderTokens>({})
  const [vercelToken, setVercelToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.demox.secrets.list().then(setTokens)
  }, [])

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await window.demox.secrets.set('vercel', vercelToken.trim())
      setVercelToken('')
      setTokens(await window.demox.secrets.list())
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await window.demox.secrets.clear('vercel')
      setTokens(await window.demox.secrets.list())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>
        <div className="row">
          <label>Vercel personal token {tokens.vercel ? '· connected' : '· not set'}</label>
          <input
            type="password"
            placeholder={tokens.vercel ? 'Replace existing token…' : 'paste token here'}
            value={vercelToken}
            onChange={(e) => setVercelToken(e.target.value)}
            disabled={busy}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Create one at vercel.com → Account Settings → Tokens. Stored encrypted on this device.
          </div>
        </div>
        {error && <div className="row" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {saved && <div className="row" style={{ color: 'var(--ok)', fontSize: 12 }}>Saved.</div>}
        <div className="dialog-actions">
          {tokens.vercel && <button className="danger ghost" onClick={clear} disabled={busy}>Remove token</button>}
          <button onClick={onClose} disabled={busy}>Close</button>
          <button className="primary" onClick={save} disabled={busy || !vercelToken.trim()}>
            {busy ? 'Verifying…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
