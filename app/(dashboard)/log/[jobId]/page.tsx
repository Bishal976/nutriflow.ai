'use client'
import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FoodItem, VisionStatusResponse, RebalanceResponse } from '@/types/api'

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? '#4CAF7D' : pct >= 50 ? 'var(--warning)' : 'var(--error)'
  const label = pct >= 75 ? 'High confidence' : pct >= 50 ? 'Medium confidence' : 'Low — please review'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`, padding: '2px 8px', borderRadius: 10 }}>
      {pct}% · {label}
    </span>
  )
}

function DeviationBadge({ delta, label }: { delta: number; label: string }) {
  const over = delta > 0
  const abs = Math.abs(delta)
  if (abs < 10) return null
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: over ? 'var(--error)' : 'var(--success)', background: over ? '#FEF2F2' : '#F0FFF4', padding: '2px 8px', borderRadius: 10 }}>
      {over ? '+' : '-'}{abs} {label}
    </span>
  )
}

export default function VisionResultPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const searchParams = useSearchParams()
  const mealLogId = searchParams.get('mealLogId')
  const router = useRouter()

  const [status, setStatus] = useState<VisionStatusResponse | null>(null)
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [confirming, setConfirming] = useState(false)
  const [rebalance, setRebalance] = useState<RebalanceResponse | null>(null)
  const [error, setError] = useState('')

  // Poll for job completion
  useEffect(() => {
    let attempts = 0
    const poll = async () => {
      const res = await fetch(`/api/vision/status/${jobId}`)
      const data: VisionStatusResponse = await res.json()
      setStatus(data)
      if (data.status === 'COMPLETED' && data.result) {
        setFoods(data.result.foods)
      } else if (data.status === 'FAILED') {
        setError(data.error ?? 'Analysis failed. Please try again.')
      } else if (data.status !== 'COMPLETED' && attempts < 30) {
        attempts++
        setTimeout(poll, 2000)
      }
    }
    poll()
  }, [jobId])

  function updateFood(idx: number, key: keyof FoodItem, value: string | number) {
    setFoods(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f))
  }

  async function handleConfirm() {
    if (!mealLogId) return
    setConfirming(true)
    try {
      const planRes = await fetch('/api/plan/generate')
      const planData = await planRes.json()

      const res = await fetch('/api/plan/rebalance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyLogId: planData?.dailyLogId, mealLogId, confirmedFoods: foods }),
      })
      const data: RebalanceResponse = await res.json()
      if (!res.ok) { setError((data as any).error ?? 'Failed to rebalance'); return }
      setRebalance(data)
    } catch { setError('Network error.') }
    finally { setConfirming(false) }
  }

  // Loading state
  if (!status || status.status === 'PENDING' || status.status === 'PROCESSING') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Reading your plate…</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Our AI is identifying the foods and estimating portions. This takes 5–10 seconds.</p>
        <div className="spinner" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: 'var(--error)', marginBottom: 20 }}>{error}</p>
        <button className="btn-primary" onClick={() => router.push('/dashboard/log')}>Try again</button>
      </div>
    )
  }

  // Rebalance result
  if (rebalance) {
    const sev = rebalance.deviation.severity
    const sevColor = sev === 'significant' ? 'var(--error)' : sev === 'moderate' ? 'var(--warning)' : 'var(--success)'
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Meal logged!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Your remaining day has been adjusted.</p>
        </div>

        {/* Deviation summary */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Deviation summary</h3>
            <span style={{ fontSize: 12, fontWeight: 700, color: sevColor, background: `${sevColor}18`, padding: '3px 10px', borderRadius: 10, textTransform: 'capitalize' }}>{sev}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Calories', val: rebalance.deviation.deltaCalories, unit: 'kcal' },
              { label: 'Protein', val: rebalance.deviation.deltaProteinG, unit: 'g' },
              { label: 'Carbs', val: rebalance.deviation.deltaCarbsG, unit: 'g' },
              { label: 'Fat', val: rebalance.deviation.deltaFatG, unit: 'g' },
            ].map(d => (
              <div key={d.label} style={{ textAlign: 'center', flex: 1, minWidth: 60 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: Math.abs(d.val) < 30 ? 'var(--success)' : d.val > 0 ? 'var(--error)' : 'var(--warning)' }}>
                  {d.val > 0 ? '+' : ''}{Math.round(d.val)}{d.unit}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '14px 16px' }}>
          <p style={{ fontSize: 14, color: 'var(--primary)', lineHeight: 1.6 }}>{rebalance.explanation}</p>
          {rebalance.complianceNote && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{rebalance.complianceNote}</p>}
        </div>

        {/* Rebalanced meals */}
        {rebalance.rebalancedMeals.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Adjusted remaining meals</h3>
            {rebalance.rebalancedMeals.map((meal, i) => (
              <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{meal.mealType} · {meal.totalCalories} kcal</div>
                {meal.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: j < meal.items.length - 1 ? '1px solid var(--surface-2)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.quantity}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.calories} kcal</div>
                      <div>P{item.proteinG}g · C{item.carbsG}g · F{item.fatG}g</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={() => router.push('/dashboard')} style={{ padding: '13px' }}>
          Back to dashboard
        </button>
      </div>
    )
  }

  // Vision result + confirmation
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Review your meal</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          We identified {foods.length} item{foods.length !== 1 ? 's' : ''}.
          {status.result && <> Overall confidence: <ConfidenceBadge score={status.result.overallConfidence} /></>}
        </p>
        {status.result?.mealContext && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{status.result.mealContext}</p>}
      </div>

      {status.result?.lightingQuality === 'poor' && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
          ⚡ The photo lighting was poor. Estimates may be less accurate — please review carefully.
        </div>
      )}

      {/* Food items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {foods.map((food, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <input
                  style={{ fontWeight: 600, fontSize: 15, border: 'none', background: 'transparent', width: '100%', color: 'var(--text)', outline: 'none', padding: 0 }}
                  value={food.name} onChange={e => updateFood(i, 'name', e.target.value)}
                />
                <ConfidenceBadge score={food.confidence} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', marginLeft: 12 }}>{food.caloriesEstimate}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              {[
                { key: 'proteinG', label: 'Protein (g)' },
                { key: 'carbsG', label: 'Carbs (g)' },
                { key: 'fatG', label: 'Fat (g)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ padding: '6px 10px', fontSize: 14 }}
                    value={(food as any)[key]}
                    onChange={e => updateFood(i, key as keyof FoodItem, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📏 {food.householdQuantity}</span>
              {food.visualCues && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '60%', textAlign: 'right' }}>{food.visualCues}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="card" style={{ padding: 16, background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>This meal total</div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Calories', val: foods.reduce((s, f) => s + f.caloriesEstimate, 0), unit: 'kcal' },
            { label: 'Protein', val: Math.round(foods.reduce((s, f) => s + f.proteinG, 0)), unit: 'g' },
            { label: 'Carbs', val: Math.round(foods.reduce((s, f) => s + f.carbsG, 0)), unit: 'g' },
            { label: 'Fat', val: Math.round(foods.reduce((s, f) => s + f.fatG, 0)), unit: 'g' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>{m.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{m.label}<br />{m.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>{error}</div>}

      <button className="btn-primary" onClick={handleConfirm} disabled={confirming || foods.length === 0} style={{ padding: '14px', fontSize: 15 }}>
        {confirming ? 'Calculating rebalance…' : '✓ Confirm & rebalance my day'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        You can edit any values above before confirming. Macro estimates are approximate.
      </p>
    </div>
  )
}
