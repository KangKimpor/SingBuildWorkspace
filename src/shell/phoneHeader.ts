import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'

export interface PhoneHeader {
  title: string
  back?: string
  actions?: ReactNode
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
}

interface Entry { seq: number; header: Partial<PhoneHeader>; patch?: boolean }

interface State { entries: Entry[]; active: PhoneHeader | null }

const useHeaders = create<State>(() => ({ entries: [], active: null }))
let seq = 0

const same = (a: Partial<PhoneHeader>, b: Partial<PhoneHeader>) =>
  a.title === b.title && a.back === b.back && a.actions === b.actions && !a.search === !b.search &&
  a.search?.value === b.search?.value && a.search?.placeholder === b.search?.placeholder && a.search?.onChange === b.search?.onChange

function computeActive(entries: Entry[]): PhoneHeader | null {
  if (!entries.length) return null
  const sorted = [...entries].sort((a, b) => a.seq - b.seq)
  let baseIdx = -1
  for (let i = sorted.length - 1; i >= 0; i--) if (!sorted[i]!.patch) { baseIdx = i; break }
  if (baseIdx < 0) return Object.assign({ title: '' }, ...sorted.map((e) => e.header)) as PhoneHeader
  const result = { ...sorted[baseIdx]!.header }
  for (let i = baseIdx + 1; i < sorted.length; i++) Object.assign(result, sorted[i]!.header)
  return result as PhoneHeader
}

function register(header: Partial<PhoneHeader>, patch: boolean): void {
  const [id] = useState(() => ++seq)
  useLayoutEffect(() => {
    useHeaders.setState((s) => {
      const i = s.entries.findIndex((e) => e.seq === id)
      if (i >= 0 && same(s.entries[i]!.header, header) && !!s.entries[i]!.patch === patch) return s
      const entry = { seq: id, header, patch }
      const entries = i < 0 ? [...s.entries, entry] : s.entries.map((e, j) => (j === i ? entry : e))
      return { entries, active: computeActive(entries) }
    })
  })
  useLayoutEffect(() => () => useHeaders.setState((s) => {
    const entries = s.entries.filter((e) => e.seq !== id)
    return { entries, active: computeActive(entries) }
  }), [id])
}

/**
 * Sets the phone top bar while the calling screen is mounted. The sequence number is taken during the
 * first render, so a nested screen (rendered after its layout) and a later-mounted screen both win.
 * A fresh object each render is fine: subscribers are notified only when a field changes, and only the
 * top bar subscribes, so the caller never re-renders from its own update.
 */
export function usePhoneHeader(header: PhoneHeader): void {
  register(header, false)
}

/** Merges fields (such as search or a view title) onto the current base header while mounted. */
export function usePhoneHeaderPatch(patch: Partial<PhoneHeader>): void {
  register(patch, true)
}

export const usePhoneHeaderState = (): PhoneHeader | null => useHeaders((s) => s.active)
