'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import confetti from 'canvas-confetti'

const FREE_FEATURES = [
  { label: '1 meal plan per day (cached)', included: true },
  { label: 'Up to 3 meal photo logs per day', included: true },
  { label: '7-day history', included: true },
  { label: 'Basic macro tracking', included: true },
  { label: 'Plan regeneration with hints', included: false },
  { label: 'Unlimited meal photo logs', included: false },
  { label: 'Full history (365 days)', included: false },
  { label: 'Weather-adaptive plan updates', included: false },
  { label: 'Medical condition-aware planning', included: false },
]

const PRO_FEATURES = [
  { label: 'Everything in Free', included: true },
  { label: 'Unlimited plan regenerations', included: true },
  { label: 'Custom hints ("I want rajma today")', included: true },
  { label: 'Unlimited meal photo logs', included: true },
  { label: '365-day history & trends', included: true },
  { label: 'Weather-adaptive plan updates', included: true },
  { label: 'Medical condition-aware planning', included: true },
  { label: 'Priority AI processing', included: true },
]

const REASON_MESSAGES: Record<string, string> = {
  plan_regeneration: 'Plan regeneration and custom hints are a Pro feature.',
  meal_log_limit: "You've hit the 3 meal photo limit for today (Free plan).",
}

type Billing = 'monthly' | 'annual'

function WaitingCard({ billing, onCancel }: { billing: Billing; onCancel: () => void }) {
  const planLabel = billing === 'monthly' ? 'Pro Monthly (₹830)' : 'Pro Annual (₹6,640)'
  return (
    <div style={{
      background: 'rgba(45,125,125,0.04)',
      border: '2px solid var(--primary)',
      borderRadius: 14,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '3px solid var(--border)', borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Waiting for payment confirmation…</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Complete checkout for <strong>{planLabel}</strong> in the tab we opened — your account activates automatically the moment Razorpay confirms it. No need to do anything else.
            </p>
          </div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}

function UpgradePageInner() {
  const params = useSearchParams()
  const reason = params.get('reason') ?? ''

  const [plan, setPlan] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<Billing | null>(null)
  const [launching, setLaunching] = useState<Billing | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const celebratedRef = useRef(false)

  function celebrate() {
    if (celebratedRef.current) return
    celebratedRef.current = true
    const burst = (origin: { x: number; y: number }) =>
      confetti({ particleCount: 80, spread: 70, origin, colors: ['#2D7D7D', '#4CAF7D', '#FFD700', '#FF6B6B', '#A78BFA'] })
    burst({ x: 0.3, y: 0.6 })
    setTimeout(() => burst({ x: 0.7, y: 0.5 }), 150)
    setTimeout(() => burst({ x: 0.5, y: 0.4 }), 300)
  }

  function loadMe() {
    return fetch('/api/auth/me').then(r => r.json()).then(d => {
      setPlan(d.plan ?? 'free')
      return d.plan as string
    })
  }

  useEffect(() => {
    const isCallback = new URLSearchParams(window.location.search).get('payment') === 'callback'
    loadMe().then(p => {
      if (p === 'pro' && isCallback) celebrate()
    }).catch(() => {})
  }, [])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function stopWaiting() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setWaiting(null)
    celebrate()
  }

  async function handleUpgrade(billing: Billing) {
    setError('')
    setLaunching(billing)
    try {
      const res = await fetch('/api/razorpay/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing }),
      })
      const data = await res.json()
      if (!res.ok || !data.shortUrl) throw new Error(data.error || 'Could not start checkout')

      window.open(data.shortUrl, '_blank', 'noopener')
      setWaiting(billing)

      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const p = await loadMe()
          if (p === 'pro') stopWaiting()
        } catch {}
      }, 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout. Please try again.')
    } finally {
      setLaunching(null)
    }
  }

  const isPro = plan === 'pro'

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40 }}>

      {reason && REASON_MESSAGES[reason] && !isPro && (
        <div style={{ background: 'rgba(232,148,58,0.1)', border: '1px solid rgba(232,148,58,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#8B4F00', fontWeight: 500 }}>
          ⚡ {REASON_MESSAGES[reason]}
        </div>
      )}

      {isPro && (
        <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 10, padding: '14px 18px', fontSize: 14, color: '#2a6b44', fontWeight: 600 }}>
          ✓ You&apos;re on NutriFlow Pro — thanks for upgrading!
        </div>
      )}

      {waiting && !isPro && (
        <WaitingCard billing={waiting} onCancel={stopWaiting} />
      )}

      {error && (
        <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#a33', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,125,125,0.1)', border: '1px solid rgba(45,125,125,0.2)', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
          <span>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>NutriFlow Pro</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Upgrade your nutrition game</h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          Unlimited plans, unlimited meal logging, full history — everything you need to actually hit your goals.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid-2" style={{ gap: 20 }}>
        {/* Free */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>₹0</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>No credit card required</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {FREE_FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: f.included ? 'var(--success)' : 'var(--border)', flexShrink: 0 }}>{f.included ? '✓' : '✕'}</span>
                <span style={{ fontSize: 13, color: f.included ? 'var(--text)' : 'var(--text-muted)' }}>{f.label}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            {isPro ? 'Included with Pro' : 'Your current plan'}
          </div>
        </div>

        {/* Pro */}
        <div className="card" style={{ padding: 28, border: '2px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 14, right: 14, background: 'var(--primary)', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 10px' }}>
            MOST POPULAR
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>₹830</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/month</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>or ₹6,640/year (save 33%)</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>~$9.99/month · Cancel anytime</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--success)', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: i === 0 ? 600 : 400 }}>{f.label}</span>
              </div>
            ))}
          </div>
          {isPro ? (
            <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#2a6b44', fontWeight: 600, textAlign: 'center' }}>
              ✓ Active
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={() => handleUpgrade('monthly')} disabled={launching !== null} style={{ width: '100%', padding: '13px' }}>
                {launching === 'monthly' ? 'Opening checkout…' : 'Upgrade — ₹830/month'}
              </button>
              <button className="btn-secondary" onClick={() => handleUpgrade('annual')} disabled={launching !== null} style={{ width: '100%' }}>
                {launching === 'annual' ? 'Opening checkout…' : <>Upgrade — ₹6,640/year <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginLeft: 4 }}>SAVE 33%</span></>}
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
            🔒 Secure payment via Razorpay · UPI, cards & wallets
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Frequently asked questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { q: 'How quickly is Pro activated?', a: 'Instantly. The moment Razorpay confirms your payment, your account is upgraded automatically — no manual steps, no waiting.' },
            { q: 'Can I cancel anytime?', a: "Yes. Pro is a one-time charge for the billing period you choose — there's no auto-renewal or recurring debit. You keep Pro access until the period ends, then you can renew if you'd like to continue." },
            { q: 'Is my payment data secure?', a: 'Payments are processed by Razorpay — a PCI DSS compliant gateway. NutriFlow never stores your card details.' },
            { q: 'Do you support UPI?', a: 'Yes — Razorpay supports UPI, cards, net banking, and all major Indian wallets.' },
          ].map(({ q, a }, i, arr) => (
            <div key={q} style={{ paddingBottom: 16, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{q}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to dashboard</Link>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageInner />
    </Suspense>
  )
}
