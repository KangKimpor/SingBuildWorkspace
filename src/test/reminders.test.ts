import { expect, test } from 'vitest'
import { dueReminders } from '@/lib/reminders'
import { nextTaskReminder } from '@/data/task-rules'
import type { Task } from '@/data'
test('recent reminders fire once per occurrence key and omit completed or old tasks', () => {
  const now = new Date('2026-10-20T09:00:00Z')
  const task: Task = {
    id: 'task',
    title: 'Review',
    status: 'Not started',
    priority: 'Low',
    projectId: 'project',
    due: '2026-10-20',
    notes: '',
    subtasks: [],
    reminder: '2026-10-20T08:59:00Z',
  }
  expect(dueReminders([task], now)).toEqual([{ key: `task:task:${Date.parse(task.reminder!)}`, title: 'Review' }])
  expect(dueReminders([{ ...task, status: 'Done' }], now)).toEqual([])
  expect(dueReminders([task], new Date(now.getTime() + 600000))).toEqual([])
})
test('task recurrence shifts a reminder by date while preserving its local clock', () => {
  expect(
    nextTaskReminder(
      { due: '2026-10-20', reminder: '2026-10-20T08:00' } as Task,
      '2026-10-22',
    ),
  ).toBe('2026-10-22T08:00')
})
