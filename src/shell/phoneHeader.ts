import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'

export interface PhoneHeader {
  title: string
  back?: string
  actions?: ReactNode
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
}

interface Entry { seq: number; header: PhoneHeader }

const useHeaders = create<{ entries: Entry[] }>(() => ({ entries: [] }))
let seq = 0

const same = (a: PhoneHeader, b: PhoneHeader) =>
  a.title === b.title && a.back === b.back && a.actions === b.actions && !a.search === !b.search &&
  a.search?.value === b.search?.value && a.search?.placeholder === b.search?.placeholder && a.search?.onChange === b.search?.onChange

/**
 * Sets the phone top bar while the calling screen is mounted. The sequence number is taken during the
 * first render, so a nested screen (rendered after its layout) and a later-mounted screen both win.
 * A fresh object each render is fine: subscribers are notified only when a field changes, and only the
 * top bar subscribes, so the caller never re-renders from its own update.
 */
export function usePhoneHeader(header: PhoneHeader): void {
  const [id] = useState(() => ++seq)
  useLayoutEffect(() => {
    useHeaders.setState((s) => {
      const i = s.entries.findIndex((e) => e.seq === id)
      if (i >= 0 && same(s.entries[i]!.header, header)) return s
      const entry = { seq: id, header }
      return { entries: i < 0 ? [...s.entries, entry] : s.entries.map((e, j) => (j === i ? entry : e)) }
    })
  })
  useLayoutEffect(() => () => useHeaders.setState((s) => ({ entries: s.entries.filter((e) => e.seq !== id) })), [id])
}

const top = (entries: Entry[]) =>
  entries.reduce<Entry | null>((best, e) => (!best || e.seq > best.seq ? e : best), null)?.header ?? null

export const usePhoneHeaderState = (): PhoneHeader | null => useHeaders((s) => top(s.entries))
