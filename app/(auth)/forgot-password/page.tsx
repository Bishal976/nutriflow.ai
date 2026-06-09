'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Something went wrong'); return }
      setSent(true)
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 400, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'white', fontSize: 20 }}>🔑</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Forgot password?</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>We&apos;ll send a reset link to your email</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Check your inbox</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              If <strong>{email}</strong> has an account, you&apos;ll receive a reset link shortly. The link expires in <strong>1 hour</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Didn&apos;t get it? Check your spam folder.</p>
            <Link href="/login"><button className="btn-secondary" style={{ width: '100%' }}>Back to sign in</button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Email address</label>
              <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>{error}</div>}
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>← Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
