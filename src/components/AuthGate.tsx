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
  return (
    <div className="auth-page">
      <main className="auth-main">
        <AccountSettings standalone loading={!ready} />
      </main>
    </div>
  )
}
