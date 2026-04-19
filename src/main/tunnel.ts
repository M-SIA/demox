// Minimal type for localtunnel — the package doesn't ship .d.ts.
interface LocaltunnelOptions {
  port: number
  host?: string
  subdomain?: string
  local_host?: string
}
interface LocaltunnelInstance {
  url: string
  on(event: 'close' | 'error', cb: (err?: Error) => void): void
  close(): void
}

// The default export is an async function `localtunnel(opts)` returning an instance.
const importLt = async (): Promise<(opts: LocaltunnelOptions) => Promise<LocaltunnelInstance>> => {
  const mod: unknown = await import('localtunnel')
  const anyMod = mod as { default?: unknown }
  const fn = (anyMod.default ?? mod) as (opts: LocaltunnelOptions) => Promise<LocaltunnelInstance>
  return fn
}

let tunnel: LocaltunnelInstance | null = null
let starting: Promise<string> | null = null

export async function startTunnel(port: number): Promise<string> {
  if (tunnel) return tunnel.url
  if (starting) return starting
  starting = (async () => {
    try {
      const lt = await importLt()
      const t = await lt({ port })
      t.on('close', () => { tunnel = null })
      t.on('error', () => { /* swallow; we surface via diagnostics */ })
      tunnel = t
      return t.url
    } finally {
      starting = null
    }
  })()
  return starting
}

export async function stopTunnel(): Promise<void> {
  if (!tunnel) return
  try { tunnel.close() } catch { /* ignore */ }
  tunnel = null
}

export function tunnelUrl(): string | null {
  return tunnel?.url ?? null
}
