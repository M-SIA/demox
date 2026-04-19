import type { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import type { DeployProgress, Deployment, Project } from '../../shared/types.js'
import { createHash } from 'node:crypto'
import { getToken } from '../secrets.js'
import * as store from '../deployStore.js'
import { walkProject } from './files.js'
import { createDeployment, pollUntilReady, uploadAll } from './vercel.js'
import { tunnelUrl } from '../tunnel.js'

const inflight = new Map<string, AbortController>()

function emit(win: BrowserWindow, p: DeployProgress): void {
  win.webContents.send('deploy:progress', p)
}

export async function deploy(project: Project, win: BrowserWindow): Promise<Deployment> {
  const token = await getToken('vercel')
  if (!token) throw new Error('No Vercel token configured. Add it in Settings.')

  const id = nanoid(10)
  const dep: Deployment = {
    id,
    projectId: project.id,
    provider: 'vercel',
    status: 'preparing',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await store.add(dep)
  const ctl = new AbortController()
  inflight.set(id, ctl)

  try {
    emit(win, { deploymentId: id, projectId: project.id, status: 'preparing', message: 'Collecting files…' })
    const files = await walkProject(project.path)
    if (files.length === 0) throw new Error('Project is empty.')

    // If remote sharing is on, rewrite HTML files to bake in the public
    // collector URL. Without the tunnel, deployed prototypes stay quiet —
    // the bootstrap script only activates when __demox_* params are present.
    const publicApi = tunnelUrl()
    if (publicApi) {
      const inject = bakedBootstrap(project.id, publicApi)
      for (const f of files) {
        if (!f.path.endsWith('.html')) continue
        const html = f.data.toString('utf8')
        if (html.includes('window.__DEMOX__')) continue
        const next = html.replace(/<\/head>/i, `${inject}\n</head>`)
        if (next === html) continue
        const buf = Buffer.from(next, 'utf8')
        f.data = buf
        f.size = buf.length
        f.sha1 = createHash('sha1').update(buf).digest('hex')
      }
    }

    emit(win, {
      deploymentId: id,
      projectId: project.id,
      status: 'uploading',
      message: `Uploading 0/${files.length}…`
    })
    await store.update(id, { status: 'uploading' })
    await uploadAll(token, files, (done, total) => {
      emit(win, {
        deploymentId: id,
        projectId: project.id,
        status: 'uploading',
        message: `Uploading ${done}/${total}…`
      })
    })

    emit(win, { deploymentId: id, projectId: project.id, status: 'building', message: 'Creating deployment…' })
    const created = await createDeployment(token, sanitizeProjectName(project.name), files, project.template)
    const url = `https://${created.url}`
    await store.update(id, { status: 'building', remoteId: created.id, url })
    emit(win, { deploymentId: id, projectId: project.id, status: 'building', message: 'Building on Vercel…', url })

    const final = await pollUntilReady(
      token,
      created.id,
      (s) => {
        const u = `https://${s.url}`
        emit(win, {
          deploymentId: id,
          projectId: project.id,
          status: s.readyState === 'BUILDING' ? 'building' : 'building',
          message: `Vercel: ${s.readyState.toLowerCase()}`,
          url: u
        })
      },
      ctl.signal
    )

    if (final.readyState === 'READY') {
      const finalUrl = `https://${final.url}`
      const updated = await store.update(id, { status: 'ready', url: finalUrl })
      emit(win, { deploymentId: id, projectId: project.id, status: 'ready', message: 'Live.', url: finalUrl })
      return updated!
    }
    if (final.readyState === 'CANCELED') {
      const updated = await store.update(id, { status: 'canceled' })
      emit(win, { deploymentId: id, projectId: project.id, status: 'canceled', message: 'Canceled.' })
      return updated!
    }
    const errMsg = final.errorMessage || 'Deployment failed'
    const updated = await store.update(id, { status: 'error', error: errMsg })
    emit(win, { deploymentId: id, projectId: project.id, status: 'error', message: errMsg })
    return updated!
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await store.update(id, { status: 'error', error: msg })
    emit(win, { deploymentId: id, projectId: project.id, status: 'error', message: msg })
    throw err
  } finally {
    inflight.delete(id)
  }
}

export function cancel(deploymentId: string): void {
  inflight.get(deploymentId)?.abort()
}

export function listForProject(projectId: string) {
  return store.listForProject(projectId)
}

export function removeForProject(projectId: string) {
  return store.removeForProject(projectId)
}

function bakedBootstrap(projectId: string, api: string): string {
  // Self-contained init that loads the comment SDK from the public tunnel.
  // Kept as a single inline script so the HTML stays valid after injection.
  const safePid = JSON.stringify(projectId)
  const safeApi = JSON.stringify(api.replace(/\/+$/, ''))
  return `<script>
(function(){
  try {
    var api = ${safeApi};
    var pid = ${safePid};
    window.__DEMOX__ = { project: pid, api: api };
    var s = document.createElement('script');
    s.src = api + '/sdk.js'; s.async = true;
    document.head.appendChild(s);
  } catch (e) { /* ignore */ }
})();
</script>`
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'demox-prototype'
}
