import { useState } from 'react'
import { Check, Cloud, Download, LockKeyhole, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { syncWorkspace, useAccount } from '@/data/sync'
import { contentOf, useWorkspace } from '@/data'
import './account-settings.css'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/emailDomain'

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
  const notice = (
    <>
      {(error || accountError) && (
        <p className="account-notice account-error" role="alert">
          {error || accountError}
        </p>
      )}
      {message && (
        <p className="account-notice" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
    </>
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
            onClick={() => void run('sync', syncWorkspace)}
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
  return (
    <div className="account-auth-layout">
      <section
        className="account-auth-card flat-card"
        aria-label="Workspace authentication"
      >
        <header className="account-form-heading">
          <Heading>Welcome</Heading>
          <p className="account-form-sub">
            Sign in with your @{ALLOWED_EMAIL_DOMAIN} Google account to sync your projects, tasks, and workbooks across devices.
          </p>
        </header>
        {notice}
        <button
          className="account-google"
          disabled={loading || !!busy || !supabase}
          onClick={() => void run('google', google)}
        >
          <GoogleMark />
          {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {loading && (
          <div className="account-connecting-pill" role="status">
            <span className="account-spinner" aria-hidden="true" />
            <span>Connecting to your account…</span>
          </div>
        )}
        {!loading && !supabase && <p className="account-notice account-error" role="alert">Account services are unavailable. Please try again shortly.</p>}
        <footer className="account-form-footer">
          <LockKeyhole size={14} />
          <span>Your work is private to your account and syncs across your devices.</span>
        </footer>
      </section>
    </div>
  )
}
