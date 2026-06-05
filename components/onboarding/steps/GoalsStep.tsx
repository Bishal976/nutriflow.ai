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
  const [goal, setGoal] = useState('')
  const [targetWeight, setTargetWeight] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ primaryGoal: goal, targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GOALS.map(g => (
          <label key={g.value} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
            borderRadius: 10, border: `2px solid ${goal === g.value ? 'var(--primary)' : 'var(--border)'}`,
            background: goal === g.value ? 'rgba(45,125,125,0.06)' : 'var(--surface)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <input type="radio" name="goal" value={g.value} checked={goal === g.value} onChange={() => setGoal(g.value)} style={{ display: 'none' }} />
            <span style={{ fontSize: 22 }}>{g.icon}</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{g.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{g.desc}</div>
            </div>
            {goal === g.value && <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 12 }}>✓</span>
            </div>}
          </label>
        ))}
      </div>

      {(goal === 'WEIGHT_LOSS' || goal === 'WEIGHT_GAIN') && (
        <div style={{ marginTop: 4 }}>
          <label className="label">Target weight (kg) — optional</label>
          <input className="input-field" type="number" placeholder="e.g. 65" min={30} max={250} value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={!goal || loading} style={{ marginTop: 8 }}>
        {loading ? 'Saving…' : 'Continue →'}
      </button>
    </form>
  )
}
