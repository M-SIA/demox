import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { nanoid } from 'nanoid'
import { execa } from 'execa'
import type { BrowserWindow } from 'electron'
import type { CreateProjectInput, Project } from '../shared/types.js'
import { findTemplate } from '../shared/templates.js'
import { workspaceRoot } from './paths.js'
import { addProject, removeProject } from './store.js'
import { filesFor, writeFiles } from './scaffolds/index.js'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project'
}

function uniqueDir(slug: string): string {
  const base = workspaceRoot()
  let candidate = join(base, slug)
  let n = 1
  while (existsSync(candidate)) {
    candidate = join(base, `${slug}-${n++}`)
  }
  return candidate
}

export interface CreateProgress {
  step: 'scaffold' | 'install' | 'done' | 'error'
  message: string
}

export async function createProject(
  input: CreateProjectInput,
  win: BrowserWindow,
  log: (line: string) => void
): Promise<Project> {
  const tpl = findTemplate(input.template)
  if (!tpl) throw new Error(`Unknown template: ${input.template}`)

  const slug = slugify(input.name)
  const dir = uniqueDir(slug)
  const project: Project = {
    id: nanoid(10),
    name: input.name,
    template: input.template,
    path: dir,
    createdAt: Date.now()
  }

  const emit = (p: CreateProgress) => win.webContents.send('project:create-progress', { id: project.id, ...p })

  try {
    emit({ step: 'scaffold', message: `Creating files in ${dir}` })
    log(`scaffolding ${input.template} → ${dir}`)
    const files = filesFor(input.template, slug)
    await writeFiles(dir, files)

    emit({ step: 'install', message: 'Installing dependencies (npm install)…' })
    log('running: npm install')
    const sub = execa('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
      cwd: dir,
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
    })
    sub.stdout?.on('data', (d) => log(d.toString()))
    sub.stderr?.on('data', (d) => log(d.toString()))
    await sub

    await addProject(project)
    emit({ step: 'done', message: 'Ready.' })
    return project
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emit({ step: 'error', message: msg })
    log(`error: ${msg}`)
    throw err
  }
}

export async function deleteProject(id: string, projectPath: string): Promise<void> {
  await removeProject(id)
  if (existsSync(projectPath)) {
    await rm(projectPath, { recursive: true, force: true })
  }
}
