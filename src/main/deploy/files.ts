import { readdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative, sep } from 'node:path'

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.astro',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.vercel',
  '.netlify',
  'dist',
  'build',
  'out',
  'coverage',
  '.DS_Store'
])

const IGNORE_FILE_SUFFIX = ['.log']

export interface ProjectFile {
  /** posix-style path relative to project root */
  path: string
  size: number
  sha1: string
  data: Buffer
}

export async function walkProject(root: string): Promise<ProjectFile[]> {
  const out: ProjectFile[] = []
  await visit(root, root, out)
  return out
}

async function visit(root: string, dir: string, out: ProjectFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue
    const abs = join(dir, e.name)
    if (e.isDirectory()) {
      await visit(root, abs, out)
    } else if (e.isFile()) {
      if (IGNORE_FILE_SUFFIX.some((s) => e.name.endsWith(s))) continue
      const st = await stat(abs)
      // skip oversized files (>20MB) — prototypes shouldn't ship huge assets
      if (st.size > 20 * 1024 * 1024) continue
      const data = await readFile(abs)
      const sha1 = createHash('sha1').update(data).digest('hex')
      const rel = relative(root, abs).split(sep).join('/')
      out.push({ path: rel, size: st.size, sha1, data })
    }
  }
}
