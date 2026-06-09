'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Invalid reset link</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>This link is missing a token. Please request a new one.</p>
        <Link href="/forgot-password"><button className="btn-primary">Request new link</button></Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) { setError('Passwords do not match'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Reset failed'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Password updated!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Redirecting you to sign in…</p>
        <Link href="/login"><button className="btn-primary">Sign in now</button></Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label">New password</label>
        <div style={{ position: 'relative' }}>
          <input className="input-field" type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ paddingRight: 44 }} autoFocus />
          <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 18 }}>
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input className="input-field" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </div>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>{error}</div>}
      <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
        {loading ? 'Updating password…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 400, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'white', fontSize: 20 }}>🔒</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Set new password</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Choose a strong password for your account</p>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
