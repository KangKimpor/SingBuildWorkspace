import { useState } from 'react'
import { Check, Cloud, Download, LockKeyhole, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { syncWorkspace, useAccount } from '@/data/sync'
import { contentOf, useWorkspace } from '@/data'
import './account-settings.css'

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      G
    </span>
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
        queryParams: { prompt: 'select_account' },
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
        {loading && <p className="small muted" role="status">Connecting to your account…</p>}
        {!loading && !supabase && <p className="account-notice account-error" role="alert">Account services are unavailable. Please try again shortly.</p>}
        {!standalone && <footer className="account-form-footer">
          <LockKeyhole size={14} />
          <span>Your work is private to your account and syncs across your devices.</span>
        </footer>}
      </section>
    </div>
  )
}
