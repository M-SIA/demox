# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Demox is an Electron desktop app for product managers to prototype web apps end-to-end: scaffold a project from a template, run its dev server in an embedded preview, deploy it to Vercel, collect anchored comments on the live page, and have a bundled AI agent (opencode) turn those comments into code edits.

## Commands

```bash
npm run dev        # electron-vite dev — runs main + preload + renderer with HMR
npm run build      # electron-vite build → out/{main,preload,renderer}
npm run typecheck  # tsc --noEmit against tsconfig.node.json (main/preload) AND tsconfig.web.json (renderer)
npm run package    # build + electron-builder --dir (unpacked app, no installer)
npm run dist        # build + electron-builder (full platform installers)
npm start          # electron-vite preview
```

There is **no test runner and no linter configured**. `npm run typecheck` is the only static check — run it after edits, since the two `tsconfig`s split main/preload (`types: ["node"]`) from renderer (`types: ["vite/client"]`, DOM libs) and each enforces `strict`.

## Three-process layout (electron-vite)

Code is split by Electron process; the build config (`electron.vite.config.ts`) compiles each separately:

- **`src/main/`** — Node/Electron main process. Owns all filesystem, network, child processes, and persistence. Entry `src/main/index.ts`.
- **`src/preload/index.ts`** — the security boundary. Exposes a single frozen `window.demox` API object over `contextBridge` (contextIsolation is on, nodeIntegration off). Every renderer→main call goes through here.
- **`src/renderer/src/`** — React 18 SPA. Reaches the backend **only** via `window.demox.*`; it never imports from `src/main`. The `@renderer` alias points at this dir.
- **`src/shared/`** — types and the template registry, imported by all three. This is the contract layer.

Use `.js` extensions on relative imports even for `.ts` files (ESM + `moduleResolution: Bundler`); follow the existing pattern.

### IPC is the spine

`src/main/ipc.ts` (`registerIpc`) wires every `ipcMain.handle(channel, …)`. `src/preload/index.ts` exposes the matching `ipcRenderer.invoke(channel, …)` typed wrappers, grouped by domain (`projects`, `dev`, `deploy`, `secrets`, `settings`, `agent`, `comments`). Main→renderer push events use `win.webContents.send(channel, payload)` and are subscribed via `on*` helpers in preload that return an unsubscribe function.

**Adding a backend capability touches three files in lockstep:** add the handler in `ipc.ts`, the typed wrapper in `preload/index.ts`, and any new payload type in `src/shared/types.ts`. The `DemoxApi` type is derived from the preload object (`typeof api`) and is what the renderer sees on `window.demox`.

## Persistence model

No database. State lives as JSON files under Electron's `userData` dir, each module owning its own file with an in-memory `cache` that is the source of truth after first load:

- `projects.json` — `store.ts`
- `comments.json` — `commentStore.ts`
- deployments — `deployStore.ts`
- `settings.json` — `settings.ts`
- `secrets.json` — `secrets.ts`, encrypted via Electron `safeStorage` when available, plaintext fallback otherwise. The `encrypted` flag in the file records which.

Scaffolded user projects are created under `userData/workspaces/<slug>` (`paths.ts`). `paths.ts` is the single place that resolves these locations.

## Core flows

**Project lifecycle** (`projects.ts`): scaffold files from a template → `npm install` → register in store. Deleting a project also tears down its dev server, deployments, comments, and the on-disk folder.

**Templates** (`src/shared/templates.ts` + `src/main/scaffolds/`): four template ids — `vite-react`, `next-app`, `astro`, `static-html`. Each scaffold module returns a `FileMap` (relative path → string content) written verbatim. To add a template: add a `TemplateInfo` to `TEMPLATES`, a scaffold module, wire it into `scaffolds/index.ts`'s `filesFor` switch, and add its Vercel `frameworkFor` mapping in `deploy/vercel.ts`.

**Dev server** (`devServer.ts`): spawns `npm run <devScript>` per project via `execa`, scrapes stdout/stderr for a localhost URL (`URL_RE`) to detect "running", streams every line as a `dev:log` event, and kills the process tree with `tree-kill`.

**Deploy** (`deploy/`): direct Vercel REST API (`vercel.ts`) — no Vercel CLI. `files.ts` walks the project (skipping `node_modules`, build output, etc., capped at 20 MB/file), hashes each file with sha1, uploads by digest, creates a v13 deployment with framework-specific `projectSettings`, then polls with backoff until `READY`/`ERROR`/`CANCELED`.

**Comment system** — the distinctive part:
- `commentSdk.ts` exports `COMMENT_SDK_SOURCE`, a **vanilla-JS, no-build** overlay served verbatim at `/sdk.js` by `commentServer.ts` (a bare `node:http` server on a random port). It draws the 💬 FAB, element highlighter, and composer, and POSTs comments anchored to a CSS selector + XPath + click ratios back to `/api/comments`.
- Scaffolds inject `DEMOX_BOOTSTRAP` (`scaffolds/bootstrap.ts`) into their HTML. It is a **silent no-op** unless the page URL carries `__demox_sdk` / `__demox_pid` / `__demox_api` query params — so deployed prototypes stay clean by default. The embedded preview (`ProjectView.tsx`) appends those params to the iframe `src` to activate the overlay locally.
- For remote reviewers, `tunnel.ts` (localtunnel) exposes the comment server publicly when `settings.remoteSharing` is on; deploy then bakes a `window.__DEMOX__` bootstrap (pointing at the tunnel URL) into the uploaded HTML.
- The Vite-React scaffold ships a Babel plugin (`scripts/demox-loc-babel.cjs`) that stamps `data-demox-loc="file:line:col"` on every JSX element **in dev only**, giving the agent an exact source location (`sourceLoc`) per comment.

**AI agent** (`agent/`): the most involved subsystem.
- `binary.ts` locates the platform-specific native `opencode` binary from the `opencode-<platform>-<arch>[-baseline][-musl]` npm packages (detecting musl libc and AVX2 on Linux x64), materializes a shim under `userData/bin`, and prepends it to `PATH` — because the opencode SDK spawns `opencode` via cross-spawn. The opencode-ai JS wrapper is deliberately bypassed (see `electron-builder.yml` `asarUnpack` notes; native binaries must be unpacked from the asar).
- `index.ts` runs a single cached `createOpencodeServer` keyed by a signature of the provider config; changing the custom provider invalidates and restarts it (`invalidateServer`, called from `settings:update`). A run creates a session, subscribes to the event stream, sends the prompt, and translates opencode events into `agent:progress` events (text deltas, tool state, edited files, errors). On completion it auto-resolves the targeted comments, and records the session/message id so the UI can show a diff (`lastRunDiff`) or `revertLastRun` (which also re-opens the comments).
- `prompt.ts` builds the system + fix prompt from the project and its open comments. The agent's job is the **smallest correct edit** per comment.
- Model default is `anthropic/claude-sonnet-4-5`; format is `providerID/modelID`. Custom OpenAI-compatible providers are configured in settings (`CustomProvider`). API keys come from `secrets.ts`, not env vars; opencode auth is set per-run via `client.auth.set`.

## Conventions

- Native ESM throughout (`"type": "module"`); relative imports use `.js` suffixes.
- Long-running operations return an id (`runId`, deployment id) immediately and stream progress as push events keyed by `projectId` — do not block IPC handlers on completion where a stream exists.
- Cancellation uses `AbortController` registered in an `inflight` Map keyed by the operation id.
- Errors surface to the UI as `status: 'error'` progress events with a human-readable message; many background failures (tunnel, diff capture) are intentionally swallowed and exposed through `agent:diagnostics` instead of throwing.
- The renderer holds no backend logic — push state up to `App.tsx` and call `window.demox.*`.
