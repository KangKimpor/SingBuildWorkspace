import { create } from 'zustand'

interface WorkspaceUI {
  commandOpen: boolean
  toast: { message: string; undo?: () => void } | null
  setCommandOpen: (open: boolean) => void
  notify: (message: string, undo?: () => void) => void
}
let toastTimer: ReturnType<typeof setTimeout>
export const useWorkspaceUI = create<WorkspaceUI>((set) => ({
  commandOpen: false,
  toast: null,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  notify: (message, undo) => {
    clearTimeout(toastTimer)
    set({ toast: { message, undo } })
    toastTimer = setTimeout(() => set({ toast: null }), 6000)
  },
}))
