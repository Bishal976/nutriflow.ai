'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 360, lineHeight: 1.6 }}>
          An unexpected error occurred. Try refreshing the page.
        </p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    )
  }
}
