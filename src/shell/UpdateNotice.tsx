import { useInstall } from '@/lib/install'

export function UpdateNotice() {
  const update = useInstall((state) => state.update)
  if (!update) return null
  const failed = update.status === 'failed'
  return (
    <div className="update-notice" role="status" aria-live="polite">
      {!failed && <span className="spinner" aria-hidden="true" />}
      <span>{failed ? 'Update failed. Try again.' : 'Updating to the latest version…'}</span>
      {failed && (
        <button className="btn-accent" onClick={() => void update.apply()}>
          Retry
        </button>
      )}
    </div>
  )
}
