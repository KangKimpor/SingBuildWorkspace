import { useEffect, type ReactNode } from 'react'
import { Cloud, Layers, LockKeyhole, TrendingUp } from 'lucide-react'
import { initializeCloud, useAccount } from '@/data/sync'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/emailDomain'
import { AccountSettings } from './AccountSettings'
import './auth-gate.css'

const DESKTOP_HIGHLIGHTS = [
  {
    icon: TrendingUp,
    title: 'Weekly BOQ progress',
    detail: 'Live curves, floor rollups, and site handler updates.',
  },
  {
    icon: Layers,
    title: 'Material & PO tracking',
    detail: 'Procurement milestones and team remarks in one sheet.',
  },
  {
    icon: Cloud,
    title: 'Live cloud sync',
    detail: `Private to @${ALLOWED_EMAIL_DOMAIN} with offline edit recovery.`,
  },
] as const

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready, recovering } = useAccount()
  useEffect(() => {
    void initializeCloud()
  }, [])
  if (ready && session && !recovering) return children
  return (
    <div className="auth-page">
      <div className="auth-ambient" aria-hidden="true" />
      <header className="auth-header">
        <div className="auth-header-inner">
          <span className="auth-brand">
            <img src="/brand/favicon.svg" alt="" width={24} height={24} />
            <span>SingBuild</span>
          </span>
          <span className="auth-header-domain">
            <LockKeyhole size={12} aria-hidden="true" />
            <span>@{ALLOWED_EMAIL_DOMAIN}</span>
          </span>
        </div>
      </header>
      <main className="auth-main">
        <div className="auth-stage">
          <section className="auth-intro" aria-label="About SingBuild Workspace">
            <p className="auth-kicker">SingBuild Workspace</p>
            <p className="auth-hero-title">Projects, progress, and materials in one place.</p>
            <p className="auth-hero-copy">
              Track weekly BOQ progress, update site activities, and manage project materials with live cloud sync.
            </p>
            <ul className="auth-highlights">
              {DESKTOP_HIGHLIGHTS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="auth-highlight-item">
                  <span className="auth-highlight-icon" aria-hidden="true">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <div className="auth-highlight-text">
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <AccountSettings standalone loading={!ready} />
        </div>
      </main>
      <footer className="auth-footer">SingBuild Workspace</footer>
    </div>
  )
}
