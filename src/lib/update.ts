import { useInstall } from './install'

/** Leave the updating notice on screen long enough to read before the tab reloads. */
export const UPDATE_NOTICE_DELAY = 1_500

/**
 * Apply a waiting update automatically. A visible tab shows the notice first; a
 * hidden tab activates the update straight away so the next visit is current.
 */
export function announceUpdate(activate: () => Promise<void>) {
  const current = useInstall.getState().update
  if (current && current.status !== 'failed') return
  const apply = async () => {
    if (useInstall.getState().update?.status === 'installing') return
    useInstall.setState({ update: { status: 'installing', apply } })
    try {
      await activate()
    } catch {
      useInstall.setState({ update: { status: 'failed', apply } })
    }
  }
  useInstall.setState({ update: { status: 'pending', apply } })
  if (document.visibilityState === 'hidden') void apply()
  else setTimeout(() => void apply(), UPDATE_NOTICE_DELAY)
}
