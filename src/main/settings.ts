import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings } from '../shared/types.js'

let cache: AppSettings | null = null

function path(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function get(): Promise<AppSettings> {
  if (cache) return cache
  if (!existsSync(path())) {
    cache = {}
    return cache
  }
  cache = JSON.parse(await readFile(path(), 'utf8')) as AppSettings
  return cache
}

export async function update(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await get()
  cache = { ...cur, ...patch }
  await writeFile(path(), JSON.stringify(cache, null, 2), 'utf8')
  return cache
}
