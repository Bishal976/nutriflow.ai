'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Signup failed'); return }
      router.push('/onboarding/1')
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 400, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'white', fontSize: 20 }}>🌿</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Create your account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Start your personalised nutrition journey</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 18 }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm password</label>
            <div style={{ position: 'relative' }}>
              <input className="input-field" type={showConfirm ? 'text' : 'password'} placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 18 }}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> : 'Create account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          By signing up you agree to our Terms of Service. NutriFlow is a wellness tool, not a medical device.
        </p>
      </div>
    </div>
  )
}
