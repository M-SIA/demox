import { useCallback, useEffect, useState } from 'react'
import type { DevServerState, LogEvent, Project, TemplateInfo } from '../../shared/types'
import { Sidebar } from './components/Sidebar'
import { ProjectView } from './components/ProjectView'
import { Welcome } from './components/Welcome'
import { NewProjectDialog } from './components/NewProjectDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { SharePanel } from './components/SharePanel'

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, LogEvent[]>>({})
  const [states, setStates] = useState<Record<string, DevServerState>>({})

  const refreshProjects = useCallback(async () => {
    const list = await window.demox.projects.list()
    setProjects(list)
    return list
  }, [])

  useEffect(() => {
    void refreshProjects()
    void window.demox.templates.list().then(setTemplates)

    const offLog = window.demox.dev.onLog((ev) => {
      setLogs((prev) => {
        const arr = prev[ev.projectId] ?? []
        const next = [...arr, ev]
        if (next.length > 1000) next.splice(0, next.length - 1000)
        return { ...prev, [ev.projectId]: next }
      })
    })
    const offState = window.demox.dev.onState((s) => {
      setStates((prev) => ({ ...prev, [s.projectId]: s }))
    })
    return () => {
      offLog()
      offState()
    }
  }, [refreshProjects])

  const selected = projects.find((p) => p.id === selectedId) ?? null

  const handleCreated = async (p: Project) => {
    await refreshProjects()
    setSelectedId(p.id)
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    await window.demox.projects.delete(id)
    if (selectedId === id) setSelectedId(null)
    await refreshProjects()
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setCreating(true)}
        onOpenSettings={() => setShowSettings(true)}
        states={states}
      />
      <main className="main">
        {selected ? (
          <ProjectView
            project={selected}
            state={states[selected.id]}
            logs={logs[selected.id] ?? []}
            onDelete={() => handleDelete(selected.id)}
            onShare={() => setSharingProjectId(selected.id)}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <Welcome onNew={() => setCreating(true)} hasProjects={projects.length > 0} />
        )}
      </main>
      {creating && (
        <NewProjectDialog
          templates={templates}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {sharingProjectId && (() => {
        const p = projects.find((x) => x.id === sharingProjectId)
        if (!p) return null
        return (
          <SharePanel
            project={p}
            onClose={() => setSharingProjectId(null)}
            onOpenSettings={() => { setSharingProjectId(null); setShowSettings(true) }}
          />
        )
      })()}
    </div>
  )
}
