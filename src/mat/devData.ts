/**
 * Dev-only switch for the material list's stress fixtures (`?data=worst` and friends).
 * In a production build `import.meta.env.DEV` is false, so this always returns null and the
 * fixtures module is never imported.
 */
export const DEV_DATASETS = ['demo', 'worst', 'empty', 'one', 'huge'] as const
export type DevDataset = (typeof DEV_DATASETS)[number]

export function devDataset(): DevDataset | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get('data')
  return (DEV_DATASETS as readonly string[]).includes(value ?? '') ? value as DevDataset : null
}
