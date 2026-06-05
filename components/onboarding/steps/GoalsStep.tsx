'use client'
import { useState } from 'react'

interface Props { onSubmit: (data: object) => void; loading: boolean }

const GOALS = [
  { value: 'WEIGHT_LOSS', label: 'Lose weight', desc: 'Sustainable calorie deficit with balanced nutrition', icon: '📉' },
  { value: 'WEIGHT_GAIN', label: 'Gain weight', desc: 'Healthy calorie surplus for gradual gain', icon: '📈' },
  { value: 'MUSCLE_GAIN', label: 'Build muscle', desc: 'High-protein plan with strength-supporting macros', icon: '💪' },
  { value: 'MAINTENANCE', label: 'Maintain weight', desc: 'Eat at maintenance with balanced macros', icon: '⚖️' },
  { value: 'CONDITION_MANAGEMENT', label: 'Manage a condition', desc: 'Nutrition plan tailored to your health needs', icon: '🏥' },
]

export default function GoalsStep({ onSubmit, loading }: Props) {
  const [goals, setGoals] = useState<string[]>([])
  const [targetWeight, setTargetWeight] = useState('')

  function toggle(value: string) {
    setGoals(prev =>
      prev.includes(value)
        ? prev.filter(g => g !== value)
        : prev.length < 3 ? [...prev, value] : prev
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      primaryGoal: goals[0],
      secondaryGoals: goals.slice(1),
      targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined,
    })
  }

  const showTargetWeight = goals.includes('WEIGHT_LOSS') || goals.includes('WEIGHT_GAIN')

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>Select up to 3 goals. Your first selection becomes the primary focus.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GOALS.map(g => {
          const selected = goals.includes(g.value)
          const rank = goals.indexOf(g.value)
          return (
            <button key={g.value} type="button" onClick={() => toggle(g.value)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderRadius: 10, border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
              background: selected ? 'rgba(45,125,125,0.06)' : 'var(--surface)',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}>
              <span style={{ fontSize: 22 }}>{g.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{g.desc}</div>
              </div>
              {selected && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{rank + 1}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {showTargetWeight && (
        <div style={{ marginTop: 4 }}>
          <label className="label">Target weight (kg) — optional</label>
          <input className="input-field" type="number" placeholder="e.g. 65" min={30} max={250} value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={goals.length === 0 || loading} style={{ marginTop: 8 }}>
        {loading ? 'Saving…' : `Continue with ${goals.length} goal${goals.length !== 1 ? 's' : ''} →`}
      </button>
    </form>
  )
}
