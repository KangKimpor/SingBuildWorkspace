import { create } from 'zustand'

export type GlassPref = 'auto' | 'full' | 'reduced' | 'off'
export type GlassLevel = 'full' | 'reduced' | 'off'

const GLASS_KEY = 'kw-glass'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

interface GlassState {
  pref: GlassPref
  /** What Auto currently resolves to; Auto starts at Full (§10). */
  auto: GlassLevel
  setPref: (pref: GlassPref) => void
  setAuto: (level: GlassLevel) => void
}

const effectiveLevel = (s: Pick<GlassState, 'pref' | 'auto'>): GlassLevel =>
  s.pref === 'auto' ? s.auto : s.pref

function apply(s: GlassState) {
  const root = document.documentElement
  root.dataset.glass = effectiveLevel(s)
  delete root.dataset.motion
}

const useGlass = create<GlassState>((set, get) => ({
  pref: read<GlassPref>(GLASS_KEY, ['auto', 'full', 'reduced', 'off'], 'auto'),
  auto: 'full',
  setPref: (pref) => {
    write(GLASS_KEY, pref)
    set({ pref, auto: 'full' })
    apply(get())
  },
  setAuto: (auto) => {
    set({ auto })
    apply(get())
  },
}))

export function syncGlassToDocument() {
  apply(useGlass.getState())
}
