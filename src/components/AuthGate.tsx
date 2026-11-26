import { useEffect, type ReactNode } from 'react'
import { initializeCloud, useAccount } from '@/data/sync'
import { afterFirstPaint } from '@/lib/paint'
import { AccountSettings } from './AccountSettings'
import './auth-gate.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready, recovering } = useAccount()
  // Signed-out visitors see the sign-in card first; the Supabase client loads right after that paint,
  // so it is not on the first screen's critical path (D-59). A stored session started it before render.
  useEffect(() => afterFirstPaint(() => void initializeCloud()), [])
  if (ready && session && !recovering) return children
  return (
    <div className="auth-page">
      <main className="auth-main">
        <AccountSettings standalone loading={!ready} />
      </main>
    </div>
  )
}
