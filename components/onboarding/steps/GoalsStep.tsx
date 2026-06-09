'use client'
import { useState } from 'react'

interface Props {
  onSubmit: (data: object) => void
  onSaveOnly?: (data: object) => void
  loading: boolean
  initialData?: { primaryGoal?: string; secondaryGoals?: string[]; targetWeightKg?: number | null }
}

const GOALS = [
  { value: 'WEIGHT_LOSS', label: 'Lose weight', desc: 'Sustainable calorie deficit with balanced nutrition', icon: '📉' },
  { value: 'WEIGHT_GAIN', label: 'Gain weight', desc: 'Healthy calorie surplus for gradual gain', icon: '📈' },
  { value: 'MUSCLE_GAIN', label: 'Build muscle', desc: 'High-protein plan with strength-supporting macros', icon: '💪' },
  { value: 'MAINTENANCE', label: 'Maintain weight', desc: 'Eat at maintenance with balanced macros', icon: '⚖️' },
  { value: 'CONDITION_MANAGEMENT', label: 'Manage a condition', desc: 'Nutrition plan tailored to your health needs', icon: '🏥' },
]

// Goals that can't coexist — pick at most one from each conflict group
const CONFLICTS: Record<string, string[]> = {
  WEIGHT_LOSS:  ['WEIGHT_GAIN', 'MAINTENANCE'],
  WEIGHT_GAIN:  ['WEIGHT_LOSS', 'MAINTENANCE'],
  MAINTENANCE:  ['WEIGHT_LOSS', 'WEIGHT_GAIN'],
}

export default function GoalsStep({ onSubmit, onSaveOnly, loading, initialData }: Props) {
  const [goals, setGoals] = useState<string[]>(() => {
    if (!initialData?.primaryGoal) return []
    return [initialData.primaryGoal, ...(initialData.secondaryGoals ?? [])]
  })
  const [targetWeight, setTargetWeight] = useState(
    initialData?.targetWeightKg ? String(initialData.targetWeightKg) : ''
  )

  function toggle(value: string) {
    setGoals(prev => {
      if (prev.includes(value)) return prev.filter(g => g !== value)
      const conflicts = CONFLICTS[value] ?? []
      const filtered = prev.filter(g => !conflicts.includes(g))
      return filtered.length < 3 ? [...filtered, value] : filtered
    })
  }

  function buildData() {
    return {
      primaryGoal: goals[0],
      secondaryGoals: goals.slice(1),
      targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(buildData())
  }

  const showTargetWeight = goals.includes('WEIGHT_LOSS') || goals.includes('WEIGHT_GAIN')

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>
        Select up to 3 goals. Your first selection becomes the primary focus. Conflicting goals (e.g. lose + gain) are auto-resolved.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GOALS.map(g => {
          const selected = goals.includes(g.value)
          const rank = goals.indexOf(g.value)
          const conflictsWithSelected = goals.some(sg => (CONFLICTS[sg] ?? []).includes(g.value))
          const disabled = !selected && conflictsWithSelected
          return (
            <button key={g.value} type="button" onClick={() => !disabled && toggle(g.value)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderRadius: 10, border: `2px solid ${selected ? 'var(--primary)' : disabled ? 'var(--surface-2)' : 'var(--border)'}`,
              background: selected ? 'rgba(45,125,125,0.06)' : disabled ? 'var(--surface-2)' : 'var(--surface)',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
              transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}>
              <span style={{ fontSize: 22 }}>{g.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{g.desc}</div>
              </div>
              {disabled && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>conflicts</span>}
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {onSaveOnly && (
          <button type="button" className="btn-secondary" disabled={goals.length === 0 || loading}
            onClick={() => onSaveOnly(buildData())} style={{ flex: 1 }}>
            Save & return to profile
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={goals.length === 0 || loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : `Continue with ${goals.length} goal${goals.length !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </form>
  )
}
