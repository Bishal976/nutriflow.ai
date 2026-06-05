'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { MealPlanItem, NutritionTargetSummary } from '@/types/api'

interface DashboardData {
  plan: { meals: MealPlanItem[]; hydrationTip: string }
  target: NutritionTargetSummary & { targetWaterMl: number; targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number }
  weatherContext: { tempC: number; condition: string; weatherAdjustmentNote?: string } | null
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0 / {max}{label === 'Calories' ? ' kcal' : 'g'}</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function MealCard({ meal }: { meal: MealPlanItem }) {
  const [open, setOpen] = useState(false)
  const icons: Record<string, string> = { BREAKFAST: '🌅', MORNING_SNACK: '🫖', LUNCH: '🍱', EVENING_SNACK: '🌰', DINNER: '🌙' }
  const labels: Record<string, string> = { BREAKFAST: 'Breakfast', MORNING_SNACK: 'Morning snack', LUNCH: 'Lunch', EVENING_SNACK: 'Evening snack', DINNER: 'Dinner' }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}>
        <span style={{ fontSize: 20 }}>{icons[meal.mealType] ?? '🍽️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{labels[meal.mealType]}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {meal.items.slice(0, 2).map(i => i.name).join(' · ')}{meal.items.length > 2 ? ` +${meal.items.length - 2} more` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{meal.totalCalories}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>kcal</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 16px 14px' }}>
          {meal.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < meal.items.length - 1 ? '1px solid var(--surface-2)' : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.quantity}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.calories} kcal</div>
                <div>P: {item.proteinG}g · C: {item.carbsG}g · F: {item.fatG}g</div>
              </div>
            </div>
          ))}
          {meal.notes && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>{meal.notes}</p>}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/plan/generate')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load your plan.'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <div className="spinner" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Building your personalised plan…</p>
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <p style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</p>
      <button className="btn-primary" onClick={() => { setError(''); setLoading(true); fetch('/api/plan/generate').then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false)) }}>Retry</button>
    </div>
  )

  if (!data || !data.target) return null

  const { plan, target, weatherContext } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Today&apos;s Plan</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{today}</p>
        </div>
        <Link href="/log">
          <button className="btn-primary" style={{ fontSize: 14 }}>📸 Log a meal</button>
        </Link>
      </div>

      {/* Weather nudge */}
      {weatherContext?.weatherAdjustmentNote && (
        <div style={{ background: 'rgba(232,148,58,0.1)', border: '1px solid rgba(232,148,58,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>🌡️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#8B4F0A', marginBottom: 2 }}>Weather adjustment applied</div>
            <div style={{ fontSize: 13, color: '#8B4F0A', lineHeight: 1.5 }}>{weatherContext.weatherAdjustmentNote}</div>
          </div>
        </div>
      )}

      {/* Macro targets */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Daily targets</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>0% complete</span>
        </div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Calories', val: target.targetCalories, unit: 'kcal', color: 'var(--primary)' },
            { label: 'Protein', val: target.targetProteinG, unit: 'g', color: '#4CAF7D' },
            { label: 'Carbs', val: target.targetCarbsG, unit: 'g', color: 'var(--accent)' },
            { label: 'Fat', val: target.targetFatG, unit: 'g', color: '#9B59B6' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}<br />{m.unit}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3498DB' }}>{target.targetWaterMl ?? 2500}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Water<br />ml</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MacroBar label="Calories" value={0} max={target.targetCalories} color="var(--primary)" />
          <MacroBar label="Protein" value={0} max={target.targetProteinG} color="#4CAF7D" />
          <MacroBar label="Carbs" value={0} max={target.targetCarbsG} color="var(--accent)" />
        </div>
      </div>

      {/* Hydration tip */}
      {plan.hydrationTip && (
        <div style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>💧</span>
          <span style={{ fontSize: 13, color: '#1A6B9A' }}>{plan.hydrationTip}</span>
        </div>
      )}

      {/* Meal plan */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Your meals</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.meals.map((meal, i) => <MealCard key={i} meal={meal} />)}
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center', padding: '0 16px' }}>
        Calorie and macro estimates are approximate. NutriFlow is a wellness decision-support tool, not a medical device. Consult your healthcare provider before making significant dietary changes.
      </p>
    </div>
  )
}
