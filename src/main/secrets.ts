import { app, safeStorage } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderTokens, SecretKey } from '../shared/types.js'

interface Stored {
  /** base64 encoded encrypted blob, or plaintext if encryption unavailable */
  encrypted: boolean
  values: Record<string, string>
}

function path(): string {
  return join(app.getPath('userData'), 'secrets.json')
}

let cache: Stored | null = null

async function load(): Promise<Stored> {
  if (cache) return cache
  const p = path()
  if (!existsSync(p)) {
    cache = { encrypted: safeStorage.isEncryptionAvailable(), values: {} }
    return cache
  }
  const raw = JSON.parse(await readFile(p, 'utf8')) as Stored
  if (raw.encrypted && safeStorage.isEncryptionAvailable()) {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw.values)) {
      try {
        out[k] = safeStorage.decryptString(Buffer.from(v, 'base64'))
      } catch {
        // skip bad entries
      }
    }
    cache = { encrypted: true, values: out }
  } else {
    cache = raw
  }
  return cache
}

async function persist(): Promise<void> {
  if (!cache) return
  const useEnc = safeStorage.isEncryptionAvailable()
  const out: Stored = { encrypted: useEnc, values: {} }
  if (useEnc) {
    for (const [k, v] of Object.entries(cache.values)) {
      out.values[k] = safeStorage.encryptString(v).toString('base64')
    }
  } else {
    out.values = { ...cache.values }
  }
  await writeFile(path(), JSON.stringify(out, null, 2), 'utf8')
}

export async function setToken(provider: SecretKey, value: string): Promise<void> {
  const s = await load()
  s.values[provider] = value
  await persist()
}

export async function clearToken(provider: SecretKey): Promise<void> {
  const s = await load()
  delete s.values[provider]
  await persist()
}

export async function getToken(provider: SecretKey): Promise<string | undefined> {
  const s = await load()
  return s.values[provider]
}

export async function listTokens(customId?: string): Promise<ProviderTokens> {
  const s = await load()
  return {
    vercel: !!s.values['vercel'],
    anthropic: !!s.values['anthropic'],
    custom: customId ? { id: customId, connected: !!s.values[customId] } : null
  }
}
