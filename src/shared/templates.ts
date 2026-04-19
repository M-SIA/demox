import type { TemplateInfo } from './types.js'

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'vite-react',
    name: 'Vite + React',
    description: 'Lightweight SPA. Fast HMR, great default for prototypes.',
    packageManager: 'npm',
    devScript: 'dev',
    readyPattern: 'Local:'
  },
  {
    id: 'next-app',
    name: 'Next.js (App Router)',
    description: 'Full-stack React with routing + server components.',
    packageManager: 'npm',
    devScript: 'dev',
    readyPattern: 'Local:'
  },
  {
    id: 'astro',
    name: 'Astro',
    description: 'Content-first sites. Mostly static, partial hydration.',
    packageManager: 'npm',
    devScript: 'dev',
    readyPattern: 'Local'
  },
  {
    id: 'static-html',
    name: 'Static HTML',
    description: 'Plain HTML/CSS/JS. No build step.',
    packageManager: 'npm',
    devScript: 'dev',
    readyPattern: 'Local:'
  }
]

export function findTemplate(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
