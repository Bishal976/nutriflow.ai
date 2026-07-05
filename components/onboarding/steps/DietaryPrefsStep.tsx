'use client'
import { useState, useRef } from 'react'

interface Props {
  onSubmit: (data: object) => void
  onSaveOnly?: (data: object) => void
  loading: boolean
  initialData?: {
    dietType?: string | null; allergens?: string[] | null
    cuisinePreferences?: string[] | null; dislikedIngredients?: string[] | null
  }
}

const DIET_TYPES = [
  { value: 'VEG', label: 'Vegetarian', icon: '🥦' },
  { value: 'NON_VEG', label: 'Non-Vegetarian', icon: '🍗' },
  { value: 'VEGAN', label: 'Vegan', icon: '🌱' },
  { value: 'JAIN', label: 'Jain', icon: '🌼' },
  { value: 'EGGETARIAN', label: 'Eggetarian', icon: '🥚' },
  { value: 'PESCATARIAN', label: 'Pescatarian', icon: '🐟' },
]

const ALLERGENS = ['nuts', 'gluten', 'dairy', 'shellfish', 'eggs', 'soy', 'sesame']

const CUISINES = ['North Indian', 'South Indian', 'Bengali', 'Gujarati', 'Maharashtrian', 'Punjabi', 'Rajasthani', 'Jain', 'Continental', 'Mediterranean', 'East Asian']

export default function DietaryPrefsStep({ onSubmit, onSaveOnly, loading, initialData }: Props) {
  const [dietType, setDietType] = useState(initialData?.dietType ?? '')
  const [allergens, setAllergens] = useState<string[]>(initialData?.allergens ?? [])
  const [cuisines, setCuisines] = useState<string[]>(initialData?.cuisinePreferences ?? [])
  const [disliked, setDisliked] = useState(initialData?.dislikedIngredients?.join(', ') ?? '')
  const initialSnap = useRef({
    dietType: initialData?.dietType ?? '',
    allergens: [...(initialData?.allergens ?? [])].sort().join(','),
    cuisines: [...(initialData?.cuisinePreferences ?? [])].sort().join(','),
    disliked: initialData?.dislikedIngredients?.join(', ') ?? '',
  })
  const isDirty = dietType !== initialSnap.current.dietType ||
    [...allergens].sort().join(',') !== initialSnap.current.allergens ||
    [...cuisines].sort().join(',') !== initialSnap.current.cuisines ||
    disliked !== initialSnap.current.disliked

  function toggleAllergen(a: string) {
    setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }
  function toggleCuisine(c: string) {
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function buildData() {
    return {
      dietType,
      allergens,
      cuisinePreferences: cuisines.length > 0 ? cuisines : ['North Indian'],
      dislikedIngredients: disliked.split(',').map(s => s.trim()).filter(Boolean),
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(buildData())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <label className="label" style={{ marginBottom: 12 }}>Diet type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {DIET_TYPES.map(d => (
            <button key={d.value} type="button" onClick={() => setDietType(d.value)} style={{
              padding: '12px 8px', borderRadius: 10, border: `2px solid ${dietType === d.value ? 'var(--primary)' : 'var(--border)'}`,
              background: dietType === d.value ? 'rgba(45,125,125,0.08)' : 'var(--surface)',
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s',
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{d.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: dietType === d.value ? 'var(--primary)' : 'var(--text)' }}>{d.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" style={{ marginBottom: 12 }}>Allergens to avoid</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALLERGENS.map(a => (
            <button key={a} type="button" onClick={() => toggleAllergen(a)} style={{
              padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${allergens.includes(a) ? 'var(--accent)' : 'var(--border)'}`,
              background: allergens.includes(a) ? 'rgba(232,148,58,0.1)' : 'var(--surface)',
              color: allergens.includes(a) ? '#8B4F00' : 'var(--text-muted)',
              fontWeight: allergens.includes(a) ? 600 : 400, cursor: 'pointer', fontSize: 14, transition: 'all 0.12s',
            }}>{allergens.includes(a) ? '⚠ ' : ''}{a}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" style={{ marginBottom: 12 }}>Cuisine preferences (pick up to 3)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CUISINES.map(c => (
            <button key={c} type="button" onClick={() => cuisines.length < 3 || cuisines.includes(c) ? toggleCuisine(c) : null} style={{
              padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${cuisines.includes(c) ? 'var(--primary)' : 'var(--border)'}`,
              background: cuisines.includes(c) ? 'rgba(45,125,125,0.1)' : 'var(--surface)',
              color: cuisines.includes(c) ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: cuisines.includes(c) ? 600 : 400, cursor: 'pointer', fontSize: 14, transition: 'all 0.12s',
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Ingredients to avoid (comma-separated)</label>
        <input className="input-field" placeholder="e.g. brinjal, bitter gourd, jackfruit" value={disliked} onChange={e => setDisliked(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {onSaveOnly && (
          <button type="button" className="btn-secondary" disabled={!dietType || loading || !isDirty}
            onClick={() => onSaveOnly(buildData())} style={{ flex: 1 }}>
            Save & return to profile
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={!dietType || loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </form>
  )
}
