import type { FileMap } from './index.js'

export function staticHtmlFiles(name: string): FileMap {
  const pkg = {
    name,
    private: true,
    version: '0.0.0',
    scripts: {
      dev: 'vite --host 127.0.0.1',
      build: 'vite build'
    },
    devDependencies: {
      vite: '^5.4.11'
    }
  }

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${name}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <h1>${name}</h1>
      <p>Edit <code>index.html</code> to start prototyping.</p>
    </main>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
    'styles.css': `:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; }
main { max-width: 640px; margin: 4rem auto; padding: 0 1rem; }
`,
    'main.js': `console.log('${name} ready')\n`,
    '.gitignore': 'node_modules\ndist\n.DS_Store\n'
  }
}
