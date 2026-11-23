import { useState } from 'react'
import { AlertCircle, Check, Cloud, Download, LockKeyhole, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { syncWorkspace, useAccount } from '@/data/sync'
import { contentOf, useWorkspace } from '@/data'
import { useMediaQuery } from '@/lib/media'
import { useMotionReduced } from '@/motion/hooks'
import './account-settings.css'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/emailDomain'

// Critically damped Apple springs (WWDC Designing Fluid Interfaces: damping ratio 1.0, no overshoot).
const SHEET_SPRING = { type: 'spring' as const, bounce: 0, duration: 0.36 }
const PRESS_SPRING = { type: 'spring' as const, bounce: 0, duration: 0.22 }
const NOTICE_SPRING = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const REDUCED_FADE = { type: 'tween' as const, duration: 0.16, ease: [0.2, 0, 0, 1] as const }

function GoogleMark() {
  return (
    <svg className="google-mark-svg" width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285f4" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7A20 20 0 0 0 4 24a20 20 0 0 0 40 0c0-1.2-.1-2.4-.4-3.5Z"/>
      <path fill="#34a853" d="m6.3 33.8 6.6-5.1A12 12 0 0 0 24 36c3.1 0 5.9-1.2 8-3l6.2 5.2A20 20 0 0 1 6.3 33.8Z"/>
      <path fill="#fbbc05" d="m4 24 2.3 9.8 6.6-5.1A12 12 0 0 1 12 24c0-1.8.4-3.5 1.1-5L6.5 14A20 20 0 0 0 4 24Z"/>
      <path fill="#ea4335" d="M24 4A20 20 0 0 0 6.5 14l6.6 5A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7A20 20 0 0 0 24 4Z"/>
    </svg>
  )
}
function backupWorkspace() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(contentOf(useWorkspace.getState()), null, 2)], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'singbuild-workspace-backup.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function AccountSettings({ standalone = false, loading = false }: { standalone?: boolean; loading?: boolean }) {
  const { session, recovering, error: accountError } = useAccount()
  const sync = useWorkspace((s) => s.sync)
  const reduced = useMotionReduced()
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function run(action: string, work: () => Promise<void>) {
    setBusy(action)
    setError('')
    setMessage('')
    try {
      await work()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setBusy('')
    }
  }
  async function google() {
    if (!supabase)
      throw new Error('Account services are unavailable. Try again shortly.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/settings/account`,
        // `hd` makes Google offer only singbuild.com accounts; the app and the server still check the address.
        queryParams: { prompt: 'select_account', hd: ALLOWED_EMAIL_DOMAIN },
      },
    })
    if (error) throw error
  }
  const activeError = error || accountError || (!loading && !supabase ? 'Account services are unavailable. Please try again shortly.' : '')
  const notice = (
    <AnimatePresence initial={false}>
      {activeError && (
        <motion.p
          key="auth-error"
          className="account-notice account-error"
          role="alert"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={reduced ? REDUCED_FADE : NOTICE_SPRING}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>{activeError}</span>
        </motion.p>
      )}
      {message && (
        <motion.p
          key="auth-status"
          className="account-notice"
          role="status"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={reduced ? REDUCED_FADE : NOTICE_SPRING}
        >
          <Check size={16} aria-hidden="true" />
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  )
  if (session && !recovering && !standalone)
    return (
      <div className="account-dashboard">
        <section className="account-profile flat-card">
          <div className="account-avatar" aria-hidden="true">
            {(session.user.user_metadata.full_name || session.user.email || 'K')
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div>
            <span className="eyebrow">YOUR WORKSPACE ACCOUNT</span>
            <h2>
              {session.user.user_metadata.full_name || 'You’re signed in'}
            </h2>
            <p className="muted">{session.user.email}</p>
          </div>
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              void run('signout', async () => {
                const result = await supabase!.auth.signOut()
                if (result.error) throw result.error
              })
            }
          >
            Sign out
          </button>
        </section>
        {notice}
        <section className="account-sync-card flat-card">
          <div className="account-section-icon">
            <Cloud size={22} />
          </div>
          <div>
            <h2>Everything, in sync</h2>
            <p className="muted">
              The cloud is your workspace database. Changes appear live across signed-in sessions. Pending or failed edits remain available for recovery.
            </p>
            <p className="account-sync-status" role="status">
              {sync.kind === 'saved'
                ? 'All changes saved'
                : sync.kind === 'saving'
                  ? 'Saving your changes…'
                  : sync.kind === 'offline'
                    ? `Offline · ${sync.pending} changes waiting to sync`
                    : sync.reason}
            </p>
          </div>
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() => void run('sync', () => syncWorkspace(true, true))}
          >
            <RefreshCw size={16} />
            Retry / reconnect
          </button>
        </section>
        <button className="btn-text account-backup" onClick={backupWorkspace}>
          <Download size={16} />
          Download workspace backup
        </button>
      </div>
    )
  const Heading = standalone ? 'h1' : 'h2'
  const isPending = loading || busy === 'google'
  const isDisabled = loading || !!busy || !supabase
  const googleLabel = busy === 'google'
    ? 'Opening Google…'
    : loading
      ? 'Connecting…'
      : 'Continue with Google'
  return (
    <div className="account-auth-layout">
      <motion.section
        className={standalone ? 'account-auth-card' : 'account-auth-card flat-card'}
        aria-label="Workspace authentication"
        initial={standalone && !reduced ? { y: 8, scale: 0.985 } : false}
        animate={standalone && !reduced ? { y: 0, scale: 1 } : undefined}
        transition={SHEET_SPRING}
      >
        {standalone && (
          <div className="auth-medallion" aria-hidden="true">
            <img src="/brand/favicon.svg" alt="" width={34} height={34} />
          </div>
        )}
        <header className="account-form-heading">
          <Heading>Welcome</Heading>
          <p className="account-form-sub">
            {standalone
              ? 'Sign in to SingBuild Workspace with your Google account.'
              : `Sign in with your @${ALLOWED_EMAIL_DOMAIN} Google account to sync your projects, tasks, and workbooks across devices.`}
          </p>
        </header>
        {notice}
        <motion.button
          type="button"
          className="account-google"
          data-pending={isPending ? 'true' : undefined}
          disabled={isDisabled}
          whileTap={isDisabled || reduced ? undefined : { scale: 0.975 }}
          whileHover={isDisabled || reduced || !finePointer ? undefined : { y: -1 }}
          transition={PRESS_SPRING}
          onClick={() => void run('google', google)}
        >
          <span className="account-google-badge" aria-hidden="true">
            {isPending ? <span className="account-google-spinner" /> : <GoogleMark />}
          </span>
          <span className="account-google-label">{googleLabel}</span>
        </motion.button>
        <footer className="account-form-footer">
          <LockKeyhole size={13} aria-hidden="true" />
          <span>
            {standalone
              ? `Restricted to @${ALLOWED_EMAIL_DOMAIN} Google accounts`
              : 'Your work is private to your account and syncs across your devices.'}
          </span>
        </footer>
      </motion.section>
    </div>
  )
}
