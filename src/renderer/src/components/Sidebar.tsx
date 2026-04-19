import type { DevServerState, Project } from '../../../shared/types'

interface Props {
  projects: Project[]
  selectedId: string | null
  states: Record<string, DevServerState>
  onSelect: (id: string) => void
  onNew: () => void
}

export function Sidebar({ projects, selectedId, states, onSelect, onNew }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Demox</h1>
        <div className="sidebar-actions">
          <button className="primary" onClick={onNew}>+ New prototype</button>
        </div>
      </div>
      <div className="project-list">
        {projects.length === 0 && <div className="empty-projects">No projects yet.</div>}
        {projects.map((p) => {
          const status = states[p.id]?.status ?? 'idle'
          return (
            <button
              key={p.id}
              className={`project-item ${selectedId === p.id ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`status-dot ${status}`} />
                <span className="name">{p.name}</span>
              </div>
              <div className="meta">{p.template} · {new Date(p.createdAt).toLocaleDateString()}</div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
