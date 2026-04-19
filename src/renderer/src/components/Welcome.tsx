interface Props {
  onNew: () => void
  hasProjects: boolean
}

export function Welcome({ onNew, hasProjects }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <h2>{hasProjects ? 'Pick a prototype on the left' : 'Build a prototype in seconds'}</h2>
        <p>
          Pick a scaffold, edit, share a link, collect comments, and let AI fix them.
          Everything runs locally.
        </p>
        <button className="primary" onClick={onNew}>+ New prototype</button>
      </div>
    </div>
  )
}
