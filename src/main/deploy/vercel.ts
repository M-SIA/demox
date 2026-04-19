import type { TemplateId } from '../../shared/types.js'
import type { ProjectFile } from './files.js'

const API = 'https://api.vercel.com'

interface FrameworkSettings {
  framework: string | null
  buildCommand: string | null
  outputDirectory: string | null
  installCommand: string | null
}

export function frameworkFor(template: TemplateId): FrameworkSettings {
  switch (template) {
    case 'next-app':
      return { framework: 'nextjs', buildCommand: null, outputDirectory: null, installCommand: null }
    case 'vite-react':
      return { framework: 'vite', buildCommand: null, outputDirectory: null, installCommand: null }
    case 'astro':
      return { framework: 'astro', buildCommand: null, outputDirectory: null, installCommand: null }
    case 'static-html':
      return { framework: null, buildCommand: '', outputDirectory: '.', installCommand: '' }
  }
}

interface CreateDeploymentResponse {
  id: string
  url: string
  readyState?: string
  alias?: string[]
}

interface PollResponse {
  id: string
  url: string
  readyState: 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'QUEUED'
  errorMessage?: string
  alias?: string[]
}

async function authed(token: string, init: RequestInit & { url: string }): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(init.url, { ...init, headers })
  return res
}

/** Uploads a single file by hash. Vercel will store it keyed by sha1. */
async function uploadFile(token: string, file: ProjectFile): Promise<void> {
  const res = await authed(token, {
    url: `${API}/v2/files`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': file.sha1
    },
    body: new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength) as unknown as BodyInit
  })
  if (!res.ok && res.status !== 200) {
    const body = await res.text()
    throw new Error(`upload ${file.path} failed: ${res.status} ${body}`)
  }
}

export async function uploadAll(
  token: string,
  files: ProjectFile[],
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const concurrency = 6
  let i = 0
  let done = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const idx = i++
        if (idx >= files.length) return
        await uploadFile(token, files[idx])
        done++
        onProgress(done, files.length)
      }
    })
  )
}

export async function createDeployment(
  token: string,
  name: string,
  files: ProjectFile[],
  template: TemplateId
): Promise<CreateDeploymentResponse> {
  const fw = frameworkFor(template)
  const body = {
    name,
    files: files.map((f) => ({ file: f.path, sha: f.sha1, size: f.size })),
    target: 'production',
    projectSettings: {
      framework: fw.framework,
      ...(fw.buildCommand !== null ? { buildCommand: fw.buildCommand } : {}),
      ...(fw.outputDirectory !== null ? { outputDirectory: fw.outputDirectory } : {}),
      ...(fw.installCommand !== null ? { installCommand: fw.installCommand } : {})
    }
  }
  const res = await authed(token, {
    url: `${API}/v13/deployments`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`create deployment failed: ${res.status} ${txt}`)
  }
  return (await res.json()) as CreateDeploymentResponse
}

export async function pollUntilReady(
  token: string,
  deploymentId: string,
  onTick: (state: PollResponse) => void,
  signal?: AbortSignal
): Promise<PollResponse> {
  let backoff = 1500
  while (true) {
    if (signal?.aborted) throw new Error('canceled')
    const res = await authed(token, {
      url: `${API}/v13/deployments/${deploymentId}`,
      method: 'GET'
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`poll failed: ${res.status} ${txt}`)
    }
    const json = (await res.json()) as PollResponse
    onTick(json)
    if (json.readyState === 'READY' || json.readyState === 'ERROR' || json.readyState === 'CANCELED') {
      return json
    }
    await new Promise((r) => setTimeout(r, backoff))
    backoff = Math.min(backoff * 1.3, 5000)
  }
}

export async function whoami(token: string): Promise<{ user: { username: string } } | null> {
  const res = await authed(token, { url: `${API}/v2/user`, method: 'GET' })
  if (!res.ok) return null
  return (await res.json()) as { user: { username: string } }
}
