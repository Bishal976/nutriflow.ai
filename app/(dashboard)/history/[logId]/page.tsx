'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'

interface FoodItemLite {
  name: string
  householdQuantity: string
  caloriesEstimate: number
  proteinG: number
  carbsG: number
  fatG: number
}
interface MealDetail {
  id: string
  mealType: string
  loggedAt: string
  foodItems: FoodItemLite[]
  estimatedCalories: number | null
  estimatedProteinG: number | null
  estimatedCarbsG: number | null
  estimatedFatG: number | null
  overallConfidence: number | null
}
interface DayDetail {
  date: string
  target: { targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number } | null
  actuals: { calories: number; proteinG: number; carbsG: number; fatG: number }
  meals: MealDetail[]
  isMock?: boolean
}

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast', MORNING_SNACK: 'Morning snack', LUNCH: 'Lunch', EVENING_SNACK: 'Evening snack', DINNER: 'Dinner',
}
const MEAL_ICONS: Record<string, string> = {
  BREAKFAST: '🌅', MORNING_SNACK: '🍎', LUNCH: '🍛', EVENING_SNACK: '☕', DINNER: '🌙',
}
const MOCK_MEAL_ORDER = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER']
const MOCK_FOOD_BANK = [
  { name: 'Vegetable upma', householdQuantity: '1 bowl', proteinG: 8, carbsG: 42, fatG: 10 },
  { name: 'Masala chai', householdQuantity: '1 cup', proteinG: 2, carbsG: 14, fatG: 4 },
  { name: 'Roti', householdQuantity: '2 pieces', proteinG: 6, carbsG: 36, fatG: 3 },
  { name: 'Dal tadka', householdQuantity: '1 bowl', proteinG: 12, carbsG: 28, fatG: 6 },
  { name: 'Mixed veg sabzi', householdQuantity: '1 bowl', proteinG: 5, carbsG: 18, fatG: 8 },
  { name: 'Steamed rice', householdQuantity: '1 cup', proteinG: 4, carbsG: 45, fatG: 1 },
  { name: 'Curd', householdQuantity: '1 small bowl', proteinG: 5, carbsG: 8, fatG: 4 },
  { name: 'Mixed nuts', householdQuantity: '1 handful', proteinG: 6, carbsG: 8, fatG: 14 },
  { name: 'Banana', householdQuantity: '1 medium', proteinG: 1, carbsG: 27, fatG: 0 },
  { name: 'Grilled paneer', householdQuantity: '100g', proteinG: 18, carbsG: 4, fatG: 16 },
  { name: 'Chapati', householdQuantity: '1 piece', proteinG: 3, carbsG: 18, fatG: 2 },
  { name: 'Sprouts salad', householdQuantity: '1 bowl', proteinG: 9, carbsG: 22, fatG: 3 },
]

function makeMockDayDetail(logId: string, date: string, totalCalories: number, mealCount: number): DayDetail {
  let seed = [...logId].reduce((a, c) => a + c.charCodeAt(0), 0) || 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const types = MOCK_MEAL_ORDER.slice(0, Math.max(1, Math.min(mealCount, MOCK_MEAL_ORDER.length)))
  const perMeal = Math.round(totalCalories / types.length)
  const hours = [8, 11, 13, 17, 20]

  const meals: MealDetail[] = types.map((type, i) => {
    const itemCount = 2 + Math.round(rand() * 2)
    const rawItems = Array.from({ length: itemCount }, () => MOCK_FOOD_BANK[Math.floor(rand() * MOCK_FOOD_BANK.length)])
    const rawCals = rawItems.map(it => Math.round(it.proteinG * 4 + it.carbsG * 4 + it.fatG * 9))
    const sum = rawCals.reduce((s, c) => s + c, 0) || 1
    const scale = perMeal / sum
    const items: FoodItemLite[] = rawItems.map((it, j) => ({
      name: it.name,
      householdQuantity: it.householdQuantity,
      caloriesEstimate: Math.round(rawCals[j] * scale),
      proteinG: Math.round(it.proteinG * scale),
      carbsG: Math.round(it.carbsG * scale),
      fatG: Math.round(it.fatG * scale),
    }))
    const d = new Date(date)
    d.setHours(hours[i] ?? 12, Math.round(rand() * 50), 0, 0)
    return {
      id: `${logId}-meal-${i}`,
      mealType: type,
      loggedAt: d.toISOString(),
      foodItems: items,
      estimatedCalories: items.reduce((s, it) => s + it.caloriesEstimate, 0),
      estimatedProteinG: items.reduce((s, it) => s + it.proteinG, 0),
      estimatedCarbsG: items.reduce((s, it) => s + it.carbsG, 0),
      estimatedFatG: items.reduce((s, it) => s + it.fatG, 0),
      overallConfidence: 0.7 + rand() * 0.25,
    }
  })

  return {
    date,
    target: { targetCalories: 2200, targetProteinG: 130, targetCarbsG: 260, targetFatG: 70 },
    actuals: {
      calories: totalCalories,
      proteinG: meals.reduce((s, m) => s + (m.estimatedProteinG ?? 0), 0),
      carbsG: meals.reduce((s, m) => s + (m.estimatedCarbsG ?? 0), 0),
      fatG: meals.reduce((s, m) => s + (m.estimatedFatG ?? 0), 0),
    },
    meals,
    isMock: true,
  }
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? '#4CAF7D' : pct >= 50 ? '#F5A623' : '#E05A5A'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: '2px 7px', borderRadius: 8 }}>
      {pct}% confidence
    </span>
  )
}

export default function DayDetailPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = use(params)
  const [detail, setDetail] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [backHref, setBackHref] = useState('/history')

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    setBackHref(qs.get('mock') === '1' ? '/history?preview=mock' : '/history')

    if (qs.get('mock') === '1') {
      const date = qs.get('date') ?? new Date().toISOString()
      const cal = parseInt(qs.get('cal') ?? '2000', 10)
      const meals = parseInt(qs.get('meals') ?? '4', 10)
      setDetail(makeMockDayDetail(logId, date, cal, meals))
      setLoading(false)
      return
    }

    fetch(`/api/history/${logId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setDetail(d)
      })
      .catch(() => setError('Failed to load this day.'))
      .finally(() => setLoading(false))
  }, [logId])

  if (loading) {
    const sk = { background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' } as const
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ width: 100, height: 14, borderRadius: 4, ...sk, marginBottom: 16 }} />
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ width: 180, height: 20, borderRadius: 5, ...sk, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', flex: 1 }}>
                <div style={{ width: 50, height: 22, borderRadius: 5, ...sk }} />
                <div style={{ width: 60, height: 10, borderRadius: 3, ...sk }} />
              </div>
            ))}
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 18, marginBottom: 12 }}>
            <div style={{ width: 140, height: 16, borderRadius: 4, ...sk, marginBottom: 14 }} />
            {[1, 2].map(j => <div key={j} style={{ width: '100%', height: 40, borderRadius: 8, ...sk, marginBottom: 8 }} />)}
          </div>
        ))}
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{error || 'This day could not be found.'}</p>
        <Link href="/history"><button className="btn-primary">← Back to history</button></Link>
      </div>
    )
  }

  const { target, actuals, meals } = detail
  const pct = target?.targetCalories ? Math.round((actuals.calories / target.targetCalories) * 100) : 0
  const adherenceColor = pct >= 85 ? '#4CAF7D' : pct >= 60 ? '#F5A623' : '#E05A5A'
  const adherenceLabel = pct >= 85 ? 'On track' : pct >= 60 ? 'Partial' : 'Off track'
  const dateLabel = new Date(detail.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link href={backHref} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ← Back to history
      </Link>

      {detail.isMock && (
        <div style={{ background: 'rgba(232,148,58,0.08)', border: '1px solid rgba(232,148,58,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#8B5200' }}>
          📸 Sample day — generated for preview. Your real logged days will look like this once you start logging meals.
        </div>
      )}

      {/* Day summary */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{dateLabel}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{meals.length} meal{meals.length !== 1 ? 's' : ''} logged</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: adherenceColor, background: `${adherenceColor}18`, padding: '4px 12px', borderRadius: 10 }}>
            {adherenceLabel} · {pct}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Calories', actual: actuals.calories, target: target?.targetCalories, unit: 'kcal' },
            { label: 'Protein', actual: Math.round(actuals.proteinG), target: target?.targetProteinG, unit: 'g' },
            { label: 'Carbs', actual: Math.round(actuals.carbsG), target: target?.targetCarbsG, unit: 'g' },
            { label: 'Fat', actual: Math.round(actuals.fatG), target: target?.targetFatG, unit: 'g' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                {s.actual}{s.target != null && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}> / {Math.round(s.target)} {s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: adherenceColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Meal-by-meal breakdown */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Meals</h2>
        {meals.length === 0 && (
          <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No confirmed meals were logged on this day.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meals.map(meal => {
            const time = new Date(meal.loggedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={meal.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{MEAL_ICONS[meal.mealType] ?? '🍽️'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{time}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{meal.estimatedCalories ?? 0} kcal</div>
                    {meal.overallConfidence != null && <ConfidenceBadge score={meal.overallConfidence} />}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {meal.foodItems.map((item, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: j > 0 ? '1px solid var(--surface-2)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.householdQuantity}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.caloriesEstimate} kcal</div>
                        <div>P{item.proteinG}g · C{item.carbsG}g · F{item.fatG}g</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
