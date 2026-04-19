import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { TemplateId } from '../../shared/types.js'
import { viteReactFiles } from './vite-react.js'
import { nextAppFiles } from './next-app.js'
import { astroFiles } from './astro.js'
import { staticHtmlFiles } from './static-html.js'

export type FileMap = Record<string, string>

export function filesFor(template: TemplateId, projectName: string): FileMap {
  switch (template) {
    case 'vite-react':
      return viteReactFiles(projectName)
    case 'next-app':
      return nextAppFiles(projectName)
    case 'astro':
      return astroFiles(projectName)
    case 'static-html':
      return staticHtmlFiles(projectName)
  }
}

export async function writeFiles(root: string, files: FileMap): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf8')
  }
}
