import { create } from 'zustand'

export type Breakpoint = 'compact' | 'medium' | 'expanded' | 'large'

/** Compact (phone) below 768, medium 768 to 1023, expanded 1024 to 1439, large 1440 and up (§3). */
export function breakpointFor(width: number): Breakpoint {
  if (width < 768) return 'compact'
  if (width < 1024) return 'medium'
  if (width < 1440) return 'expanded'
  return 'large'
}

export const SIDEBAR_WIDTH = 264

export type SheetKind = 'quick-add' | null

interface ShellState {
  sidebarWidth: number
  /** Persistent sidebar (expanded and large) is open. */
  sidebarOpen: boolean
  /** Overlay drawer (medium) is open. */
  drawerOpen: boolean
  sheet: SheetKind
  setSidebarOpen: (open: boolean) => void
  setDrawerOpen: (open: boolean) => void
  setSheet: (sheet: SheetKind) => void
}

export const useShell = create<ShellState>((set) => ({
  sidebarWidth: SIDEBAR_WIDTH,
  sidebarOpen: true,
  drawerOpen: false,
  sheet: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSheet: (sheet) => set({ sheet }),
}))

export const isMac = () =>
  /Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)
export const modKey = () => (isMac() ? '⌘' : 'Ctrl')
