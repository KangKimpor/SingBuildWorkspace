/**
 * Lazy views the first visit to a section would otherwise wait on. Each one is loaded on its own
 * idle callback, so the work never competes with input. The page editor (BlockNote and emoji data,
 * about 1.4 MB) and the XLSX export are left to load on demand.
 */
const chunks: (() => Promise<unknown>)[] = [
  () => import('@/pages/Projects'),
  () => import('@/nbc/NbcProject'),
  () => import('@/components/TaskTable'),
  () => import('@/components/glass/GlassSelect'),
  () => import('@/components/glass/GlassPopover'),
  () => import('@/pages/Tasks'),
  () => import('@/pages/Calendar'),
  () => import('@/components/ProjectBoard'),
  () => import('@/components/ProjectEditor'),
  () => import('@/shell/WorkspaceOverlays'),
  () => import('@/components/QuickAdd'),
  () => import('@/shell/Overlays'),
  () => import('@/pages/Settings'),
  () => import('@/pages/Trash'),
]

const idle = (callback: () => void) =>
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(callback, { timeout: 5000 })
    : setTimeout(callback, 300)

/**
 * Warm the route chunks after the first paint. These are static files from Vercel and the
 * service worker's precache; no Supabase request is made. Skipped when the browser asks to save data.
 */
export function prefetchRoutes(): () => void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (!import.meta.env.PROD || connection?.saveData) return () => {}
  let cancelled = false
  const next = (index: number) => {
    if (cancelled || index >= chunks.length) return
    idle(() => {
      if (cancelled) return
      void chunks[index]!().catch(() => {}).finally(() => next(index + 1))
    })
  }
  next(0)
  return () => { cancelled = true }
}
