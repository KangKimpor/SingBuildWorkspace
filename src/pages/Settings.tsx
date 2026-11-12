import { Navigate, useParams } from 'react-router-dom'
import { AccountSettings } from '@/components/AccountSettings'
import './settings.css'

export default function Settings() {
  const { section } = useParams()

  if (section !== 'account') return <Navigate to="/settings/account" replace />

  return (
    <div className="page settings-page">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Settings</h1>
          <p className="muted">A workspace that feels like yours.</p>
        </div>
      </header>
      <div className="settings-content">
        <header className="settings-content-heading">
          <h2>Account & sync</h2>
          <p>Your account, your work. Always together.</p>
        </header>
        <AccountSettings />
      </div>
    </div>
  )
}

