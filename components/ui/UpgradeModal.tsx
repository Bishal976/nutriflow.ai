'use client'
import { useRouter } from 'next/navigation'

interface Props {
  open: boolean
  onClose: () => void
  reason?: string
}

const FEATURE_BULLETS: Record<string, { title: string; body: string; perks: string[] }> = {
  meal_log_limit: {
    title: "You've used today's free logs",
    body: 'Free plan allows 3 meal photos per day. Upgrade to Pro to log unlimited meals every day.',
    perks: ['Unlimited daily meal photos', 'Unlimited plan regenerations', 'Full 365-day history', 'Custom hints & weather-aware plans'],
  },
  plan_regeneration: {
    title: "Unlock unlimited plan regens",
    body: "You've used your free regeneration for today. Go Pro to rebuild your plan anytime with custom hints.",
    perks: ['Unlimited regenerations', 'Custom hints (e.g. "make it lighter")', 'Weather-adaptive suggestions', 'Condition-aware swaps'],
  },
  medical_documents: {
    title: 'Upload unlimited reports',
    body: 'Free plan includes 1 medical report. Upgrade to Pro to upload all your prescriptions and lab reports.',
    perks: ['Unlimited document uploads', 'Auto-extracted lab values', 'Condition-aware meal targets', 'Medication tracking'],
  },
}

const DEFAULT_CONTENT = {
  title: 'Upgrade to Pro',
  body: 'Unlock the full NutriFlow experience.',
  perks: ['Unlimited meal logging', 'Unlimited plan regenerations', 'Upload unlimited reports', '365-day history'],
}

export default function UpgradeModal({ open, onClose, reason }: Props) {
  const router = useRouter()
  if (!open) return null

  const looked = reason ? FEATURE_BULLETS[reason] : undefined
  const content = looked ?? DEFAULT_CONTENT

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 20, padding: 28,
          maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
              {content.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              {content.body}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, flexShrink: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Perks */}
        <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content.perks.map(perk => (
            <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>✓</span>
              {perk}
            </div>
          ))}
        </div>

        {/* Pricing note */}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
          Starting at <strong style={{ color: 'var(--text)' }}>₹830/month</strong> · Cancel anytime
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn-primary"
            onClick={() => router.push(`/upgrade${reason ? `?reason=${reason}` : ''}`)}
            style={{ padding: '13px', fontSize: 15, fontWeight: 700 }}
          >
            Upgrade to Pro →
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '6px' }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
