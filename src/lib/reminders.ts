import type { Task } from '@/data/types'
/** Task reminders that fell due in the last five minutes, keyed per occurrence. */
export function dueReminders(tasks: Task[], now: Date) {
  const at = now.getTime()
  const result: { key: string; title: string }[] = []
  for (const task of tasks) {
    if (task.deletedAt || task.status === 'Done' || !task.reminder) continue
    const due = new Date(task.reminder).getTime()
    if (Number.isFinite(due) && due <= at && due > at - 300000)
      result.push({ key: `task:${task.id}:${due}`, title: task.title })
  }
  return result
}
