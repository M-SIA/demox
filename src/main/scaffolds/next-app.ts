import type { FileMap } from './index.js'

export function nextAppFiles(name: string): FileMap {
  const pkg = {
    name,
    private: true,
    version: '0.0.0',
    scripts: {
      dev: 'next dev -H 127.0.0.1 -p 0',
      build: 'next build',
      start: 'next start'
    },
    dependencies: {
      next: '^15.1.3',
      react: '^19.0.0',
      'react-dom': '^19.0.0'
    },
    devDependencies: {
      '@types/node': '^22.10.2',
      '@types/react': '^19.0.2',
      '@types/react-dom': '^19.0.2',
      typescript: '^5.7.2'
    }
  }

  return {
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    'next.config.mjs': `export default { reactStrictMode: true }\n`,
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['DOM', 'DOM.Iterable', 'ES2022'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }]
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules']
      },
      null,
      2
    ) + '\n',
    'app/layout.tsx': `export const metadata = { title: '${name}' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    'app/page.tsx': `export default function Page() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>${name}</h1>
      <p>Edit <code>app/page.tsx</code> to start prototyping.</p>
    </main>
  )
}
`,
    '.gitignore': 'node_modules\n.next\nout\n.DS_Store\n'
  }
}
