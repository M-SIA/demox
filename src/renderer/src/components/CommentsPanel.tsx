import { useEffect, useState } from 'react'
import type { Comment } from '../../../shared/types'

interface Props {
  projectId: string
}

export function CommentsPanel({ projectId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const refresh = async () => {
    setComments(await window.demox.comments.list(projectId))
  }

  useEffect(() => {
    void refresh()
    const off = window.demox.comments.onChanged((e) => {
      if (e.projectId === projectId) void refresh()
    })
    return off
  }, [projectId])

  const visible = comments.filter((c) => (filter === 'open' ? c.status === 'open' : true))

  const toggle = async (c: Comment) => {
    await window.demox.comments.update(c.id, { status: c.status === 'open' ? 'resolved' : 'open' })
  }
  const remove = async (c: Comment) => {
    await window.demox.comments.remove(c.id)
  }

  return (
    <aside className="comments">
      <div className="comments-header">
        <strong>Comments</strong>
        <div className="seg">
          <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>
            Open ({comments.filter((c) => c.status === 'open').length})
          </button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            All ({comments.length})
          </button>
        </div>
      </div>
      <div className="comments-list">
        {visible.length === 0 ? (
          <div className="empty-projects" style={{ padding: 12 }}>
            {filter === 'open'
              ? 'No open comments. Click 💬 in the preview to add one.'
              : 'No comments yet.'}
          </div>
        ) : (
          visible.map((c, i) => (
            <div key={c.id} className={`comment ${c.status}`}>
              <div className="comment-head">
                <span className="num">{i + 1}</span>
                <span className="author">{c.author}</span>
                <span className="ts">{new Date(c.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="comment-body">{c.body}</div>
              <div className="comment-target">
                <code title={c.target.selector}>&lt;{c.target.tag}&gt;</code>
                {c.target.text && <span className="snippet">"{c.target.text.slice(0, 48)}"</span>}
                {c.viewport.routePath && c.viewport.routePath !== '/' && (
                  <span className="route">{c.viewport.routePath}</span>
                )}
              </div>
              <div className="comment-actions">
                <button onClick={() => toggle(c)}>
                  {c.status === 'open' ? 'Resolve' : 'Reopen'}
                </button>
                <button className="danger ghost" onClick={() => remove(c)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
