'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const ERRORS: Record<string, { title: string; body: string }> = {
  missing_token: { title: 'Invalid link', body: 'The verification link is missing a token. Please use the link from your email.' },
  invalid_token: { title: 'Link not recognised', body: 'This verification link is invalid or has already been used.' },
  expired: { title: 'Link expired', body: 'This verification link has expired (links are valid for 24 hours). Request a new one below.' },
}

function VerifyEmailInner() {
  const params = useSearchParams()
  const error = params.get('error')
  const email = params.get('email') ?? ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const info = error ? (ERRORS[error] ?? { title: 'Something went wrong', body: 'Please try again.' }) : null

  async function resend() {
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) setResent(true)
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 420, padding: 36, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{error ? '⚠️' : '✉️'}</div>

        {info ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{info.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>{info.body}</p>
            {resent ? (
              <p style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>New verification email sent! Check your inbox.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(error === 'expired' || error === 'invalid_token') && (
                  <button className="btn-primary" onClick={resend} disabled={resending} style={{ width: '100%' }}>
                    {resending ? 'Sending…' : 'Send new verification email'}
                  </button>
                )}
                <Link href="/login"><button className="btn-secondary" style={{ width: '100%' }}>Back to login</button></Link>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Check your email</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              We sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>
            <Link href="/dashboard"><button className="btn-secondary" style={{ width: '100%' }}>Continue to dashboard</button></Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  )
}
