'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'

interface FoodItem {
  name: string
  quantity?: string
  householdQuantity?: string
  caloriesEstimate?: number
  calories?: number
  proteinG: number
  carbsG: number
  fatG: number
}

interface MealLog {
  id: string
  mealType: string
  loggedAt: string
  estimatedCalories: number | null
  estimatedProteinG: number | null
  estimatedCarbsG: number | null
  estimatedFatG: number | null
  foodItems: FoodItem[]
  userEdited: boolean
  userConfirmed: boolean
}

interface EditState {
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
}

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast', MORNING_SNACK: 'Morning snack',
  LUNCH: 'Lunch', EVENING_SNACK: 'Evening snack', DINNER: 'Dinner',
}
const MEAL_ICONS: Record<string, string> = {
  BREAKFAST: '🌅', MORNING_SNACK: '🫖', LUNCH: '🍱', EVENING_SNACK: '🌰', DINNER: '🌙',
}

function getCalories(item: FoodItem): number {
  return item.caloriesEstimate ?? item.calories ?? 0
}

function getQuantity(item: FoodItem): string {
  return item.householdQuantity ?? item.quantity ?? ''
}

export default function LoggedMeals({ dailyLogId }: { dailyLogId?: string }) {
  const [meals, setMeals] = useState<MealLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditState>({ calories: '', proteinG: '', carbsG: '', fatG: '' })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const url = dailyLogId ? `/api/meals?dailyLogId=${dailyLogId}` : '/api/meals'
    fetch(url)
      .then(r => r.json())
      .then(d => setMeals(d.meals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dailyLogId])

  function startEdit(meal: MealLog) {
    setEditingId(meal.id)
    setEditValues({
      calories: String(meal.estimatedCalories ?? ''),
      proteinG: String(meal.estimatedProteinG ?? ''),
      carbsG: String(meal.estimatedCarbsG ?? ''),
      fatG: String(meal.estimatedFatG ?? ''),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({ calories: '', proteinG: '', carbsG: '', fatG: '' })
  }

  async function saveEdit(mealId: string) {
    setSaving(true)
    try {
      const payload = {
        mealLogId: mealId,
        estimatedCalories: editValues.calories ? parseInt(editValues.calories) : undefined,
        estimatedProteinG: editValues.proteinG ? parseFloat(editValues.proteinG) : undefined,
        estimatedCarbsG: editValues.carbsG ? parseFloat(editValues.carbsG) : undefined,
        estimatedFatG: editValues.fatG ? parseFloat(editValues.fatG) : undefined,
      }
      const res = await fetch('/api/meals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setMeals(prev => prev.map(m => m.id === mealId ? {
          ...m,
          estimatedCalories: payload.estimatedCalories ?? m.estimatedCalories,
          estimatedProteinG: payload.estimatedProteinG ?? m.estimatedProteinG,
          estimatedCarbsG: payload.estimatedCarbsG ?? m.estimatedCarbsG,
          estimatedFatG: payload.estimatedFatG ?? m.estimatedFatG,
          userEdited: true,
        } : m))
        cancelEdit()
        toast('Meal updated')
      } else {
        toast('Failed to update meal', 'error')
      }
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 110, height: 18, borderRadius: 5, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 120, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2].map(i => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid var(--surface-2)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 90, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 150, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
              <div style={{ width: 56, height: 14, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 72, height: 11, borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (meals.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        No meals logged today. <a href="/log" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log your first meal →</a>
      </p>
    </div>
  )

  const totalCals = meals.reduce((s, m) => s + (m.estimatedCalories ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Logged today</h2>
        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{totalCals} kcal consumed</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meals.map(meal => {
          const isExpanded = expandedId === meal.id
          const isEditing = editingId === meal.id
          const hasFoods = meal.foodItems && meal.foodItems.length > 0

          return (
            <div key={meal.id} className="card" style={{ overflow: 'hidden', borderLeft: '3px solid var(--primary)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
                <button onClick={() => setExpandedId(isExpanded ? null : meal.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <span style={{ fontSize: 20 }}>{MEAL_ICONS[meal.mealType] ?? '🍽️'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</span>
                      {meal.userEdited && <span style={{ fontSize: 10, background: 'rgba(45,125,125,0.1)', color: 'var(--primary)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>edited</span>}
                      {!meal.userConfirmed && <span style={{ fontSize: 10, background: 'rgba(245,166,35,0.12)', color: 'var(--warning)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>unconfirmed</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(meal.loggedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {meal.estimatedCalories != null ? ` · ${meal.estimatedCalories} kcal` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 4 }}>
                    {meal.estimatedProteinG != null && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>P {meal.estimatedProteinG}g · C {meal.estimatedCarbsG}g · F {meal.estimatedFatG}g</div>}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                </button>

                <button onClick={() => isEditing ? cancelEdit() : startEdit(meal)}
                  style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: '1px solid rgba(45,125,125,0.3)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, padding: '4px 10px', flexShrink: 0 }}>
                  {isEditing ? 'Cancel' : '✏️ Edit'}
                </button>
              </div>

              {/* Food items breakdown */}
              {isExpanded && hasFoods && !isEditing && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Items identified</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meal.foodItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < meal.foodItems.length - 1 ? '1px solid var(--surface-2)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                          {getQuantity(item) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{getQuantity(item)}</div>}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{getCalories(item)} kcal</div>
                          <div>P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Edit totals for this meal</div>
                  <div className="grid-4" style={{ marginBottom: 12 }}>
                    {([
                      { field: 'calories' as const, label: 'Calories', unit: 'kcal' },
                      { field: 'proteinG' as const, label: 'Protein', unit: 'g' },
                      { field: 'carbsG' as const, label: 'Carbs', unit: 'g' },
                      { field: 'fatG' as const, label: 'Fat', unit: 'g' },
                    ]).map(({ field, label, unit }) => (
                      <div key={field}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          {label} <span style={{ fontWeight: 400 }}>({unit})</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editValues[field]}
                          onChange={e => setEditValues(v => ({ ...v, [field]: e.target.value }))}
                          style={{ width: '100%', padding: '7px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
                          onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                        />
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ fontSize: 13, padding: '8px 20px' }} disabled={saving} onClick={() => saveEdit(meal.id)}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
