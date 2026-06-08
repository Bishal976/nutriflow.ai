'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#0A0F0F', color: '#E8F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: 'rgba(232,240,240,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
            An unexpected error occurred. Your data is safe. Please try again or return to the dashboard.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{ padding: '10px 24px', background: 'var(--primary, #2D7D7D)', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
            <Link href="/dashboard" style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#E8F0F0', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              Back to dashboard
            </Link>
          </div>
          {error.digest && (
            <p style={{ fontSize: 11, color: 'rgba(232,240,240,0.2)', marginTop: 24 }}>Error ID: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  )
}
