import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as chrono from 'chrono-node'
import { dateKey, useWorkspace } from '@/data'
import type { Priority } from '@/data'
import { useShallow } from 'zustand/react/shallow'

export function parseQuickAdd(raw: string, now = new Date()) {
  const priorityName = raw.match(/!(low|medium|high|urgent)\b/i)?.[1]
  const project = raw.match(/#([^!#]+?)(?=\s+!|$)/)?.[1]?.trim() ?? ''
  let text = raw
    .replace(/!(low|medium|high|urgent)\b/gi, '')
    .replace(/#[^!#]+?(?=\s+!|$)/g, '')
    .trim()
  const parsed = chrono.parse(text, now, { forwardDate: true })[0]
  const date = parsed?.start.date()
  if (parsed)
    text =
      `${text.slice(0, parsed.index)}${text.slice(parsed.index + parsed.text.length)}`.trim()
  const priority = priorityName
    ? priorityName[0]!.toUpperCase() + priorityName.slice(1).toLowerCase()
    : 'Medium'
  return {
    title: text.replace(/\s+/g, ' '),
    project,
    priority: priority as Priority,
    due: date ? dateKey(date) : '',
    time:
      date && parsed?.start.isCertain('hour')
        ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : '',
  }
}
export function QuickAdd({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState(''),
    [error, setError] = useState('')
  const { projects, addProject, addTask } = useWorkspace(
    useShallow((s) => ({ projects: s.projects, addProject: s.addProject, addTask: s.addTask })),
  )
  const navigate = useNavigate()
  return (
    <form
      className="quick-add-form"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseQuickAdd(text)
        if (!parsed.title) {
          setError('Add a title for your plan.')
          return
        }
        const project = projects.find((p) =>
          p.name.toLowerCase().includes(parsed.project.toLowerCase()),
        )
        if (parsed.project && !project) {
          setError(`Project “${parsed.project}” was not found.`)
          return
        }
        const id = addTask({
          title: parsed.title,
          projectId: project?.id ?? projects[0]?.id ?? addProject('Personal'),
          due: parsed.due,
          dueTime: parsed.time,
          priority: parsed.priority,
        })
        onDone?.()
        const task = useWorkspace.getState().tasks.find((t) => t.id === id)!
        navigate(`/projects/${task.projectId}/table?task=${id}`)
        setText('')
      }}
    >
      <label className="sr-only" htmlFor="quick-add-input">
        Quick add
      </label>
      <input
        id="quick-add-input"
        autoFocus
        placeholder="Review plan tomorrow 3pm #Website !high"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="small muted">
        Use a date, #project, and !priority. Everything is parsed on your
        device.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn-accent">Create task</button>
    </form>
  )
}
