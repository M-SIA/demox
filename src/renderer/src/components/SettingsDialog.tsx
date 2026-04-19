import { useEffect, useState } from 'react'
import type { AgentDiagnostics, CustomProvider, ProviderTokens } from '../../../shared/types'

interface Props {
  onClose: () => void
}

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

const EMPTY_CUSTOM: CustomProvider = {
  id: '',
  name: '',
  npm: '@ai-sdk/openai',
  baseURL: '',
  modelId: '',
  modelName: '',
  toolCall: true
}

export function SettingsDialog({ onClose }: Props) {
  const [tokens, setTokens] = useState<ProviderTokens>({})
  const [vercelToken, setVercelToken] = useState('')
  const [anthropicToken, setAnthropicToken] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [custom, setCustom] = useState<CustomProvider>(EMPTY_CUSTOM)
  const [customKey, setCustomKey] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [remoteSharing, setRemoteSharing] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [diag, setDiag] = useState<AgentDiagnostics | null>(null)
  const [showDiag, setShowDiag] = useState(false)

  const refresh = async () => {
    const s = await window.demox.settings.get()
    setModel(s.model || DEFAULT_MODEL)
    setRemoteSharing(!!s.remoteSharing)
    if (s.customProvider) {
      setCustom(s.customProvider)
      setUseCustom(true)
    } else {
      setUseCustom(false)
    }
    setTokens(await window.demox.secrets.list())
    try { setTunnelUrl((await window.demox.agent.diagnostics()).tunnelUrl) } catch { /* ignore */ }
  }
  useEffect(() => { void refresh() }, [])

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (vercelToken.trim()) await window.demox.secrets.set('vercel', vercelToken.trim())
      if (anthropicToken.trim()) await window.demox.secrets.set('anthropic', anthropicToken.trim())

      const settingsPatch: Partial<{
        model: string
        customProvider: CustomProvider | undefined
        remoteSharing: boolean
      }> = {
        model: model.trim() || DEFAULT_MODEL,
        remoteSharing
      }
      if (useCustom) {
        if (!custom.id.trim() || !custom.baseURL.trim() || !custom.modelId.trim()) {
          throw new Error('Custom provider requires id, baseURL, and modelId.')
        }
        settingsPatch.customProvider = { ...custom, id: custom.id.trim() }
        if (customKey.trim()) await window.demox.secrets.set(custom.id.trim(), customKey.trim())
      } else {
        settingsPatch.customProvider = undefined
      }
      await window.demox.settings.update(settingsPatch)

      setVercelToken('')
      setAnthropicToken('')
      setCustomKey('')
      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const clear = async (key: string) => {
    setBusy(true)
    try {
      await window.demox.secrets.clear(key)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const suggestedModel = useCustom && custom.id && custom.modelId ? `${custom.id}/${custom.modelId}` : null

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
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
            <span>For anthropic/* models via the AI fix loop.</span>
            {tokens.anthropic && (
              <button className="danger ghost" onClick={() => clear('anthropic')} disabled={busy} style={{ padding: '2px 6px', fontSize: 11 }}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--panel-2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              disabled={busy}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ color: 'var(--text)' }}>Custom provider (OpenAI-compatible proxy)</span>
          </label>
          {useCustom && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label>Provider ID</label>
                  <input
                    value={custom.id}
                    onChange={(e) => setCustom({ ...custom, id: e.target.value })}
                    placeholder="airouter"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label>npm package</label>
                  <input
                    value={custom.npm ?? ''}
                    onChange={(e) => setCustom({ ...custom, npm: e.target.value })}
                    placeholder="@ai-sdk/openai"
                    disabled={busy}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Base URL</label>
                <input
                  value={custom.baseURL}
                  onChange={(e) => setCustom({ ...custom, baseURL: e.target.value })}
                  placeholder="https://airouter.bytedance.net/v1"
                  disabled={busy}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label>Model ID</label>
                  <input
                    value={custom.modelId}
                    onChange={(e) => setCustom({ ...custom, modelId: e.target.value })}
                    placeholder="gpt-5.4-2026-03-05"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label>Display name</label>
                  <input
                    value={custom.modelName ?? ''}
                    onChange={(e) => setCustom({ ...custom, modelName: e.target.value })}
                    placeholder="GPT-5.4"
                    disabled={busy}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>
                  API key {tokens.custom?.connected ? `· ${tokens.custom.id} connected` : '· not set'}
                </label>
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder={tokens.custom?.connected ? 'Replace existing key…' : 'paste key here'}
                  disabled={busy}
                />
                {tokens.custom?.connected && (
                  <div style={{ textAlign: 'right', marginTop: 4 }}>
                    <button
                      className="danger ghost"
                      onClick={() => clear(tokens.custom!.id)}
                      disabled={busy}
                      style={{ padding: '2px 6px', fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {suggestedModel && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                  Tip: set the Model field below to <code>{suggestedModel}</code> to use this provider.
                </div>
              )}
            </div>
          )}
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

        <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--panel-2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <input
              type="checkbox"
              checked={remoteSharing}
              onChange={(e) => setRemoteSharing(e.target.checked)}
              disabled={busy}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ color: 'var(--text)' }}>Remote sharing (tunnel comments from deployed prototypes)</span>
          </label>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Exposes the local comment collector via a public localtunnel URL so reviewers
            on other machines can leave comments on your deployed prototype.
            {tunnelUrl && (
              <div style={{ marginTop: 6 }}>
                <code style={{ background: '#08090b', padding: '2px 6px', borderRadius: 4 }}>{tunnelUrl}</code>
              </div>
            )}
          </div>
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

        <div className="row">
          <button
            className="ghost"
            style={{ width: '100%', textAlign: 'left', fontSize: 12 }}
            onClick={async () => {
              if (!showDiag) setDiag(await window.demox.agent.diagnostics())
              setShowDiag(!showDiag)
            }}
          >
            {showDiag ? '▾' : '▸'} Diagnostics
          </button>
          {showDiag && diag && (
            <pre className="progress" style={{ marginTop: 6 }}>
{`platform       ${diag.platform}-${diag.arch}
binary         ${diag.binary ?? '(not found)'}
shim dir       ${diag.shimDir ?? '(not materialized)'}
server         ${diag.serverRunning ? diag.serverUrl : 'not running'}
model          ${diag.model}
${diag.providerKeys
  .map((p) => `${p.id.padEnd(14)} key ${p.connected ? 'set' : 'missing'} (${p.source})`)
  .join('\n')}
${diag.customProvider ? `custom         ${diag.customProvider.id} → ${diag.customProvider.baseURL} (${diag.customProvider.modelId})` : ''}`}
            </pre>
          )}
        </div>

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
