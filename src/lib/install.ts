import { create } from 'zustand'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export type UpdateStatus = 'pending' | 'installing' | 'failed'
export interface AppUpdate {
  status: UpdateStatus
  apply: () => Promise<void>
}
export const useInstall = create<{
  prompt: InstallPrompt | null
  update: AppUpdate | null
  installed: boolean
}>(() => ({
  prompt: null,
  update: null,
  installed: matchMedia('(display-mode: standalone)').matches,
}))

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  useInstall.setState({ prompt: event as InstallPrompt })
})
window.addEventListener('appinstalled', () =>
  useInstall.setState({ prompt: null, installed: true }),
)
