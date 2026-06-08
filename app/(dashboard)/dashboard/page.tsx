'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import LoggedMeals from '@/components/dashboard/LoggedMeals'
import WaterTracker from '@/components/dashboard/WaterTracker'
import { track } from '@/lib/posthog'
import type { MealPlanItem, NutritionTargetSummary } from '@/types/api'

interface DashboardData {
  plan: { meals: MealPlanItem[]; hydrationTip: string }
  target: NutritionTargetSummary & { targetWaterMl: number; targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number }
  actuals: { calories: number; proteinG: number; carbsG: number; fatG: number }
  waterMl: number
  weatherContext: { tempC: number; condition: string; weatherAdjustmentNote?: string } | null
  dailyLogId?: string
  cached?: boolean
  planGeneratedAt?: string
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.round(value)} / {max}{label === 'Calories' ? ' kcal' : 'g'}</span>
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
          {/* Recipe links */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--surface-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>🍳 How to cook:</span>
            <a
              href={`https://www.youtube.com/results?search_query=how+to+make+${encodeURIComponent(meal.items[0]?.name ?? labels[meal.mealType])}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: '#FF0000', background: 'rgba(255,0,0,0.07)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none' }}
            >
              ▶ YouTube
            </a>
            <a
              href={`https://hebbarskitchen.com/?s=${encodeURIComponent(meal.items[0]?.name ?? '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'rgba(45,125,125,0.07)', border: '1px solid rgba(45,125,125,0.2)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none' }}
            >
              📖 Hebbars Kitchen
            </a>
            <a
              href={`https://www.archanaskitchen.com/?s=${encodeURIComponent(meal.items[0]?.name ?? '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none' }}
            >
              🥗 Archana's Kitchen
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function loadPlan(setData: any, setError: any, setLoading: any, toast: any, setUpgradePrompt: any, regenerate = false, hint = '') {
  setLoading(true); setError('')
  const params = new URLSearchParams()
  if (regenerate) params.set('regenerate', '1')
  if (hint.trim()) params.set('hint', hint.trim())
  fetch(`/api/plan/generate?${params}`)
    .then(r => r.json())
    .then(d => {
      if (d.upgrade) { setUpgradePrompt(true); return }
      if (d.error) { setError(d.error); toast(d.error, 'error') }
      else {
        setData(d)
        if (!d.cached) {
          toast('Your plan for today is ready!')
          track('plan_generated', { hint: hint.trim() || undefined })
        }
      }
    })
    .catch(() => { setError('Failed to load your plan.'); toast('Failed to load your plan.', 'error') })
    .finally(() => setLoading(false))
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/plan/generate')
      .then(r => r.json())
      .then(d => {
        if (d.error && !d.error.includes('onboarding')) { setError(d.error) }
        else if (!d.error) { setData(d) }
      })
      .catch(() => setError('Failed to load your plan.'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ width: 150, height: 24, borderRadius: 6, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 110, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', marginTop: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 130, height: 36, borderRadius: 8, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 110, height: 36, borderRadius: 8, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 120, height: 36, borderRadius: 8, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      {/* Macro targets card */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ width: 100, height: 16, borderRadius: 5, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 90, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 0, justifyContent: 'space-between', marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 44, height: 26, borderRadius: 5, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 44, height: 22, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ width: 60, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 80, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
        {/* Water tracker skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 70, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 80, height: 13, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: 70, height: 32, borderRadius: 20, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
      {/* Logged meals section skeleton */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ width: 110, height: 18, borderRadius: 5, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 120, height: 13, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, borderLeft: '3px solid var(--surface-2)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 90, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 150, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ width: 56, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
      {/* Suggested meals section skeleton */}
      <div>
        <div style={{ width: 180, height: 18, borderRadius: 5, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 12 }} />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 80, height: 15, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 190, height: 12, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ width: 40, height: 18, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 28, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <p style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</p>
      <button className="btn-primary" onClick={() => { setError(''); setLoading(true); fetch('/api/plan/generate').then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false)) }}>Retry</button>
    </div>
  )


  if (!data || !data.target) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Complete your onboarding first</h2>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
        We need a few details about your goals and body to build your personalised plan.
      </p>
      <Link href="/onboarding/1"><button className="btn-primary" style={{ padding: '12px 28px' }}>Finish onboarding →</button></Link>
    </div>
  )

  const plan = data?.plan
  const target = data?.target
  const actuals = data?.actuals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  const weatherContext = data?.weatherContext
  const planTime = data?.planGeneratedAt
    ? new Date(data.planGeneratedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Today&apos;s Plan</h1>
            {data?.cached && (
              <span style={{ fontSize: 11, background: 'rgba(45,125,125,0.1)', color: 'var(--primary)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                cached{planTime ? ` · ${planTime}` : ''}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={() => setShowHint(v => !v)}>
            💡 {showHint ? 'Hide hint' : 'Add preference'}
          </button>
          {data && <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={() => loadPlan(setData, setError, setLoading, toast, setUpgradePrompt, true, hint)}>↻ Regenerate</button>}
          <Link href="/log"><button className="btn-primary" style={{ fontSize: 14 }}>📸 Log a meal</button></Link>
        </div>
      </div>

      {/* Hint panel — always accessible */}
      {showHint && (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Anything specific in mind for today?</p>
          <textarea
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder="e.g. I want rajma chawal for lunch, or eating out for dinner tonight…"
            rows={2}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', resize: 'none', marginBottom: 10, lineHeight: 1.6, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}
              onClick={() => { setShowHint(false); loadPlan(setData, setError, setLoading, toast, setUpgradePrompt, true, hint) }}>
              Build plan with this hint
            </button>
            <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => { setHint(''); setShowHint(false) }}>Clear</button>
          </div>
        </div>
      )}

      {/* No plan yet CTA */}
      {!data && !loading && !error && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Ready to plan your day?</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>Add a preference above or jump straight in.</p>
          <button className="btn-primary" style={{ padding: '12px 28px' }}
            onClick={() => { setGenerating(true); loadPlan(setData, setError, (v: boolean) => { setLoading(v); setGenerating(v) }, toast, setUpgradePrompt, false, hint) }}>
            {generating ? 'Building your plan…' : 'Build my plan →'}
          </button>
        </div>
      )}

      {/* Inline upgrade prompt — shown when free user tries a Pro feature */}
      {upgradePrompt && (
        <div className="card" style={{ padding: 20, border: '2px solid var(--primary)', background: 'rgba(45,125,125,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>⚡ Pro feature required</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 420 }}>
                Plan regeneration and custom hints are available on Pro. Upgrade to rebuild your plan anytime with custom preferences.
              </p>
            </div>
            <button onClick={() => setUpgradePrompt(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '0 4px', flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Link href="/upgrade"><button className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>View Pro plans →</button></Link>
            <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setUpgradePrompt(false)}>Not now</button>
          </div>
        </div>
      )}

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
          {actuals.calories > 0
            ? <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{Math.round((actuals.calories / target.targetCalories) * 100)}% consumed</span>
            : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing logged yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {[
            { label: 'Calories', val: target.targetCalories, unit: 'kcal', color: 'var(--primary)' },
            { label: 'Protein', val: target.targetProteinG, unit: 'g', color: '#4CAF7D' },
            { label: 'Carbs', val: target.targetCarbsG, unit: 'g', color: 'var(--accent)' },
            { label: 'Fat', val: target.targetFatG, unit: 'g', color: '#9B59B6' },
            { label: 'Water', val: target.targetWaterMl ?? 2500, unit: 'ml', color: '#3498DB' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', minWidth: 56 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}<br />{m.unit}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MacroBar label="Calories" value={actuals.calories} max={target.targetCalories} color="var(--primary)" />
          <MacroBar label="Protein" value={actuals.proteinG} max={target.targetProteinG} color="#4CAF7D" />
          <MacroBar label="Carbs" value={actuals.carbsG} max={target.targetCarbsG} color="var(--accent)" />
        </div>
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <WaterTracker
            dailyLogId={data.dailyLogId}
            initialMl={data.waterMl ?? 0}
            targetMl={target.targetWaterMl ?? 2500}
          />
        </div>
      </div>

      {/* Hydration tip */}
      {plan.hydrationTip && (
        <div style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>💧</span>
          <span style={{ fontSize: 13, color: '#1A6B9A' }}>{plan.hydrationTip}</span>
        </div>
      )}

      {/* Logged meals */}
      <LoggedMeals dailyLogId={data.dailyLogId} />

      {/* Meal plan */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Today&apos;s suggested meals</h2>
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
