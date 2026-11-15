import { Component, type ReactNode } from 'react'

/**
 * Catches a lazy route whose code could not be downloaded (offline before the service worker finished
 * installing, or a chunk removed by a newer deployment) and offers a retry instead of a blank app.
 */
export class ChunkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="page quiet-empty" role="alert">
      <h1>This page could not open</h1>
      <p>{navigator.onLine ? 'Part of the app did not load.' : 'The page editor has not finished downloading. Connect to the internet and try again.'}</p>
      <button className="btn-secondary" onClick={() => this.setState({ failed: false })}>Try again</button>
    </div>
  }
}
