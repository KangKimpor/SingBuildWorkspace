import { useEffect, type ReactNode } from 'react'
import { initializeCloud, useAccount } from '@/data/sync'
import { AccountSettings } from './AccountSettings'
import './auth-gate.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready, recovering } = useAccount()
  useEffect(() => {
    void initializeCloud()
  }, [])
  if (ready && session && !recovering) return children
  return <div className="auth-page">
    <header className="auth-header">
      <span className="auth-brand"><img src="/brand/favicon.svg" alt="" width={30} height={30}/>SingBuild</span>
    </header>
    <main className="auth-main"><AccountSettings standalone loading={!ready}/></main>
    <footer className="auth-footer">SingBuild Workspace</footer>
  </div>
}
