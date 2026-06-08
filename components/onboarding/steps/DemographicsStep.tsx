'use client'
import { useState } from 'react'

interface Props {
  onSubmit: (data: object) => void
  onSaveOnly?: (data: object) => void
  loading: boolean
  initialData?: {
    firstName?: string | null; lastName?: string | null
    dateOfBirth?: string | null; sex?: string | null
    heightCm?: number | null; weightKg?: number | null; activityLevel?: string | null
  }
}

export default function DemographicsStep({ onSubmit, onSaveOnly, loading, initialData }: Props) {
  const [form, setForm] = useState({
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    dateOfBirth: initialData?.dateOfBirth
      ? new Date(initialData.dateOfBirth).toISOString().split('T')[0]
      : '',
    sex: initialData?.sex ?? '',
    heightCm: initialData?.heightCm ? String(initialData.heightCm) : '',
    weightKg: initialData?.weightKg ? String(initialData.weightKg) : '',
    activityLevel: initialData?.activityLevel ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function buildData() {
    return { ...form, heightCm: parseFloat(form.heightCm), weightKg: parseFloat(form.weightKg) }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(buildData())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-2">
        <div>
          <label className="label">First name</label>
          <input className="input-field" placeholder="Aarav" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input-field" placeholder="Sharma" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label className="label">Date of birth</label>
          <input className="input-field" type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required />
        </div>
        <div>
          <label className="label">Biological sex</label>
          <select className="input-field" value={form.sex} onChange={e => set('sex', e.target.value)} required>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Prefer not to say</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label className="label">Height (cm)</label>
          <input className="input-field" type="number" placeholder="170" min={100} max={250} value={form.heightCm} onChange={e => set('heightCm', e.target.value)} required />
        </div>
        <div>
          <label className="label">Weight (kg)</label>
          <input className="input-field" type="number" placeholder="70" min={30} max={300} value={form.weightKg} onChange={e => set('weightKg', e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="label">Activity level</label>
        <select className="input-field" value={form.activityLevel} onChange={e => set('activityLevel', e.target.value)} required>
          <option value="">Select your activity level</option>
          <option value="sedentary">Sedentary (desk job, minimal movement)</option>
          <option value="lightly_active">Lightly active (walk 1–3x/week)</option>
          <option value="moderately_active">Moderately active (exercise 3–5x/week)</option>
          <option value="very_active">Very active (hard exercise 6–7x/week)</option>
          <option value="extra_active">Extra active (physical job + daily training)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {onSaveOnly && (
          <button type="button" className="btn-secondary" disabled={loading}
            onClick={() => onSaveOnly(buildData())} style={{ flex: 1 }}>
            Save & return to profile
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </form>
  )
}
