import { useInstall } from '@/lib/install'

export function UpdateNotice() {
  const update = useInstall((state) => state.update)
  if (!update) return null
  const failed = update.status === 'failed'
  const message = failed
    ? 'Update failed. Reload to finish updating.'
    : update.status === 'pending'
      ? 'Update ready. Reloading automatically…'
      : 'Updating to the latest version…'
  return (
    <div className="update-notice" role="status" aria-live="polite">
      {!failed && <span className="spinner" aria-hidden="true" />}
      <span>{message}</span>
      {failed && (
        <button className="btn-accent" onClick={() => void update.apply()}>
          Retry
        </button>
      )}
    </div>
  )
}
