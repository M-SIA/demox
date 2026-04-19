import type { FileMap } from './index.js'
import { DEMOX_BOOTSTRAP } from './bootstrap.js'

export function astroFiles(name: string): FileMap {
  const pkg = {
    name,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'astro dev --host 127.0.0.1',
      build: 'astro build',
      preview: 'astro preview --host 127.0.0.1'
    },
    dependencies: {
      astro: '^5.1.1'
    }
  }

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'astro.config.mjs': `import { defineConfig } from 'astro/config'
export default defineConfig({})
`,
    'src/pages/index.astro': `---
const title = '${name}'
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
    ${DEMOX_BOOTSTRAP}
  </head>
  <body style="font-family: ui-sans-serif, system-ui, sans-serif;">
    <main style="max-width: 640px; margin: 4rem auto; padding: 0 1rem;">
      <h1>{title}</h1>
      <p>Edit <code>src/pages/index.astro</code>.</p>
    </main>
  </body>
</html>
`,
    '.gitignore': 'node_modules\ndist\n.astro\n.DS_Store\n'
  }
}
