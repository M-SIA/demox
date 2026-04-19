import type { Comment, Project } from '../../shared/types.js'

export const SYSTEM_PROMPT = `You are demox, an AI assistant that helps a product manager
iterate on a prototype. Users leave comments anchored to specific DOM elements in the
running app. Your job is to translate each comment into the smallest correct code change.

Ground rules:
- Prefer minimal, focused edits over refactors.
- Match existing code style; do not reformat unrelated code.
- Do not change the scaffolding (package.json, build config) unless strictly required.
- Each comment has a CSS selector and an XPath — use find/read tools to locate the
  source file that renders that element. For React/JSX, grep for distinctive text
  snippets first, then selectors/class names.
- If a comment is ambiguous, apply the most plausible interpretation and note your
  assumption in one short sentence.
- When done, output a brief summary of what changed for each comment, in order.`

export function buildFixPrompt(project: Project, comments: Comment[], extra?: string): string {
  const lines: string[] = []
  lines.push(`Project: ${project.name} (${project.template})`)
  lines.push(`Location: ${project.path}`)
  lines.push('')
  lines.push(`There are ${comments.length} open comment(s) to address.`)
  lines.push('Handle them one by one. After each edit, briefly confirm which file changed.')
  lines.push('')
  comments.forEach((c, i) => {
    lines.push(`--- Comment #${i + 1} (id: ${c.id}) ---`)
    lines.push(`Author: ${c.author}`)
    lines.push(`Comment: ${c.body}`)
    lines.push(`Route: ${c.viewport.routePath || '/'}`)
    lines.push(`Element: <${c.target.tag}>`)
    if (c.target.text) lines.push(`Visible text near click: "${c.target.text}"`)
    lines.push(`CSS selector: ${c.target.selector}`)
    lines.push(`XPath: ${c.target.xpath}`)
    if (c.target.sourceLoc) lines.push(`Source hint: ${c.target.sourceLoc}`)
    lines.push('')
  })
  if (extra?.trim()) {
    lines.push('Additional instruction from the user:')
    lines.push(extra.trim())
    lines.push('')
  }
  lines.push('Begin.')
  return lines.join('\n')
}
