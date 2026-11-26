import { registerSW } from 'virtual:pwa-register'
import { useInstall } from './install'
import { announceUpdate } from './update'
import { checkAppVersion, clearClientCaches } from './versionGate'

let registered = false

export function registerUpdates() {
  if (registered) return
  registered = true
  let registration: ServiceWorkerRegistration | undefined
  const check = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    if (registration && !registration.installing) void registration.update().catch(() => {})
    void checkAppVersion().then((result) => {
      if (result.status === 'outdated') {
        announceUpdate(async () => {
          await clearClientCaches()
          location.reload()
        })
      }
    })
  }
  addEventListener('focus', check)
  addEventListener('online', check)
  document.addEventListener('visibilitychange', check)
  // Focus, visibility and reconnects already check; the timer only covers a tab left open all day.
  setInterval(check, 5 * 60_000)

  if ('serviceWorker' in navigator) {
    let hasController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // This tab already shows its own notice, so reload it as soon as it is controlled.
      if (useInstall.getState().update) {
        location.reload()
        return
      }
      // A first installation claims this page, which already runs the newest build.
      if (!hasController) {
        hasController = true
        return
      }
      // Another tab or skipWaiting activated a deployment: show the notice here and adopt it too.
      announceUpdate(async () => location.reload())
    })
  }
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg
      check()
    },
    onNeedReload() {},
    onNeedRefresh() {
      announceUpdate(() => updateSW(true))
    },
  })
}
