'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

export default function EmailVerificationBanner() {
  const [resending, setResending] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { toast } = useToast()

  if (dismissed) return null

  async function resend() {
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) toast('Verification email sent — check your inbox')
      else toast('Failed to resend. Try again in a moment.', 'error')
    } catch {
      toast('Network error.', 'error')
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(232,148,58,0.1)', border: '1px solid rgba(232,148,58,0.35)',
      borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center',
      gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 18 }}>✉️</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#8B4F00' }}>Verify your email address</span>
        <span style={{ fontSize: 13, color: '#8B4F00', marginLeft: 6 }}>Check your inbox for the verification link.</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={resend}
          disabled={resending}
          style={{ fontSize: 12, fontWeight: 600, color: '#8B4F00', background: 'rgba(232,148,58,0.15)', border: '1px solid rgba(232,148,58,0.4)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
        >
          {resending ? 'Sending…' : 'Resend email'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{ fontSize: 12, color: '#8B4F00', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
