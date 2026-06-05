'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

interface Props {
  dailyLogId?: string
  initialMl: number
  targetMl: number
}

export default function WaterTracker({ dailyLogId, initialMl, targetMl }: Props) {
  const [waterMl, setWaterMl] = useState(initialMl)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const pct = Math.min(100, Math.round((waterMl / targetMl) * 100))
  const barColor = pct >= 80 ? '#3498DB' : pct >= 50 ? '#5DADE2' : '#AED6F1'

  async function addWater(ml: number) {
    if (!dailyLogId || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMl: ml }),
      })
      if (res.ok) {
        const d = await res.json()
        setWaterMl(d.waterMl)
      } else {
        toast('Failed to log water', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💧 Water</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{waterMl} / {targetMl} ml</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[250, 500, 1000].map(ml => (
          <button key={ml} onClick={() => addWater(ml)} disabled={loading || !dailyLogId}
            style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1.5px solid rgba(52,152,219,0.35)', background: 'rgba(52,152,219,0.06)',
              color: '#1A6B9A', opacity: loading || !dailyLogId ? 0.5 : 1, transition: 'all 0.12s',
            }}>
            +{ml < 1000 ? `${ml}ml` : '1L'}
          </button>
        ))}
        {pct >= 100 && <span style={{ fontSize: 12, color: '#3498DB', fontWeight: 600, alignSelf: 'center', marginLeft: 4 }}>🎉 Goal reached!</span>}
      </div>
    </div>
  )
}
