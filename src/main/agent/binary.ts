import { app } from 'electron'
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

let cachedShimDir: string | null = null

/**
 * The SDK spawns cross-spawn("opencode", ...), so we need `opencode` to be
 * resolvable via PATH. Rather than rely on the Node.js wrapper shipped in
 * node_modules/opencode-ai/bin (which has awkward Windows semantics once
 * asar-unpacked), we detect the right platform-specific native binary
 * ourselves and materialize a minimal shim under userData/bin that simply
 * forwards to it. Then we prepend that dir to PATH.
 */

interface Candidate {
  pkg: string
  bin: string
}

function nativeCandidates(): Candidate[] {
  const platformMap: Record<string, string> = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
  const archMap: Record<string, string> = { x64: 'x64', arm64: 'arm64' }
  const platform = platformMap[process.platform] ?? process.platform
  const arch = archMap[process.arch] ?? process.arch
  const binName = process.platform === 'win32' ? 'opencode.exe' : 'opencode'

  const base = `opencode-${platform}-${arch}`
  const out: Candidate[] = []

  if (platform === 'linux' && arch === 'x64') {
    const musl = isMuslLibc()
    const avx2 = supportsAvx2Linux()
    // Prefer the best available; push in priority order.
    if (musl) {
      if (avx2) out.push({ pkg: `${base}-musl`, bin: binName })
      out.push({ pkg: `${base}-baseline-musl`, bin: binName })
    }
    if (avx2) out.push({ pkg: base, bin: binName })
    out.push({ pkg: `${base}-baseline`, bin: binName })
  } else if ((platform === 'darwin' || platform === 'windows') && arch === 'x64') {
    out.push({ pkg: base, bin: binName })
    out.push({ pkg: `${base}-baseline`, bin: binName })
  } else {
    out.push({ pkg: base, bin: binName })
  }

  return out
}

function isMuslLibc(): boolean {
  if (process.platform !== 'linux') return false
  try {
    const out = spawnSync('ldd', ['--version'], { encoding: 'utf8' })
    const blob = `${out.stdout ?? ''}\n${out.stderr ?? ''}`
    return /musl/i.test(blob)
  } catch {
    return false
  }
}

function supportsAvx2Linux(): boolean {
  if (process.arch !== 'x64' || process.platform !== 'linux') return false
  try {
    return /(^|\s)avx2(\s|$)/i.test(readFileSync('/proc/cpuinfo', 'utf8'))
  } catch {
    return false
  }
}

function resolvePackageBin(pkg: string, bin: string): string | null {
  // Try require.resolve first (works in dev).
  try {
    const require_ = createRequire(import.meta.url)
    const pkgJson = require_.resolve(`${pkg}/package.json`)
    const candidate = join(dirname(pkgJson), 'bin', bin)
    if (existsSync(candidate)) return candidate
  } catch {
    // fall through
  }

  // Packaged / asar-unpacked location.
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', pkg, 'bin', bin)
    if (existsSync(unpacked)) return unpacked
  }

  // Monorepo-style fallback next to the main bundle or app path.
  const extra = [
    join(app.getAppPath(), 'node_modules', pkg, 'bin', bin),
    join(process.cwd(), 'node_modules', pkg, 'bin', bin)
  ]
  for (const p of extra) if (existsSync(p)) return p
  return null
}

export function resolveNativeBinary(): string {
  for (const c of nativeCandidates()) {
    const p = resolvePackageBin(c.pkg, c.bin)
    if (p) return p
  }
  throw new Error(
    `Bundled opencode binary not found for ${process.platform}-${process.arch}. ` +
      `Looked for: ${nativeCandidates().map((c) => c.pkg).join(', ')}. ` +
      `In a packaged build make sure node_modules/opencode-* is unpacked from the asar.`
  )
}

function ensureShim(): string {
  if (cachedShimDir) return cachedShimDir
  const nat = resolveNativeBinary()
  const dir = join(app.getPath('userData'), 'bin')
  mkdirSync(dir, { recursive: true })

  if (process.platform === 'win32') {
    const shim = join(dir, 'opencode.cmd')
    // Quote the path in case it contains spaces (Electron userData paths often do).
    writeFileSync(shim, `@echo off\r\n"${nat}" %*\r\n`, 'utf8')
  } else {
    const shim = join(dir, 'opencode')
    try { unlinkSync(shim) } catch { /* ignore */ }
    try {
      symlinkSync(nat, shim)
    } catch {
      // symlink failed (e.g. restrictive FS). Fall back to a tiny shell wrapper.
      writeFileSync(shim, `#!/bin/sh\nexec "${nat}" "$@"\n`, 'utf8')
      chmodSync(shim, 0o755)
    }
  }

  cachedShimDir = dir
  return dir
}

export function ensureOnPath(): void {
  const dir = ensureShim()
  const sep = process.platform === 'win32' ? ';' : ':'
  const cur = process.env.PATH ?? ''
  const parts = cur.split(sep)
  if (!parts.includes(dir)) {
    process.env.PATH = `${dir}${sep}${cur}`
  }
  // Some opencode wrappers also honor this; harmless to expose directly.
  process.env.OPENCODE_BIN_PATH = resolveNativeBinary()
}

// Exported for debugging / diagnostics from the UI.
export function diagnostics(): { platform: string; arch: string; binary: string | null; shimDir: string | null } {
  let binary: string | null = null
  try { binary = resolveNativeBinary() } catch { /* ignore */ }
  return { platform: process.platform, arch: process.arch, binary, shimDir: cachedShimDir }
}
