import { registerSW } from 'virtual:pwa-register'
import { useInstall } from './install'
import { announceUpdate } from './update'

let registered = false

export function registerUpdates() {
  if (registered) return
  registered = true
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // This tab already shows its own notice, so reload it as soon as it is controlled.
      if (useInstall.getState().update) {
        location.reload()
        return
      }
      // A first installation claims this page, which already runs the newest build.
      if (!hadController) return
      // Another tab activated a deployment: show the notice here and adopt it too.
      announceUpdate(async () => location.reload())
    })
  }
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine && !registration.installing)
          void registration.update().catch(() => {})
      }
      addEventListener('focus', check)
      addEventListener('online', check)
      document.addEventListener('visibilitychange', check)
      setInterval(check, 60_000)
      check()
    },
    onNeedReload() {},
    onNeedRefresh() {
      announceUpdate(() => updateSW(true))
    },
  })
}
