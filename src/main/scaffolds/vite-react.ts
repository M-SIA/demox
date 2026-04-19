import type { FileMap } from './index.js'

export function viteReactFiles(name: string): FileMap {
  const pkg = {
    name,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --host 127.0.0.1',
      build: 'vite build',
      preview: 'vite preview --host 127.0.0.1'
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1'
    },
    devDependencies: {
      '@types/react': '^18.3.18',
      '@types/react-dom': '^18.3.5',
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '^5.7.2',
      vite: '^5.4.11'
    }
  }

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 0, strictPort: false }
})
`,
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          isolatedModules: true,
          noEmit: false
        },
        include: ['src']
      },
      null,
      2
    ) + '\n',
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,
    'src/App.tsx': `export default function App() {
  return (
    <main>
      <h1>${name}</h1>
      <p>Edit <code>src/App.tsx</code> and save to reload.</p>
    </main>
  )
}
`,
    'src/styles.css': `:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; }
main { max-width: 640px; margin: 4rem auto; padding: 0 1rem; }
`,
    '.gitignore': 'node_modules\ndist\n.DS_Store\n'
  }
}
