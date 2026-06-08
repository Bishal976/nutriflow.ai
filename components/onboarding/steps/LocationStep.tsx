'use client'
import { useState } from 'react'

interface Props {
  onSubmit: (data: object) => void
  onSaveOnly?: (data: object) => void
  loading: boolean
  initialData?: { city?: string | null; country?: string | null; timezone?: string | null }
}

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Other']

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Mumbai':     { lat: 19.076,  lon: 72.877 },
  'Delhi':      { lat: 28.679,  lon: 77.069 },
  'Bengaluru':  { lat: 12.972,  lon: 77.594 },
  'Chennai':    { lat: 13.085,  lon: 80.270 },
  'Hyderabad':  { lat: 17.387,  lon: 78.480 },
  'Kolkata':    { lat: 22.573,  lon: 88.364 },
  'Pune':       { lat: 18.520,  lon: 73.856 },
  'Ahmedabad':  { lat: 23.023,  lon: 72.572 },
  'Jaipur':     { lat: 26.912,  lon: 75.787 },
  'Chandigarh': { lat: 30.740,  lon: 76.788 },
}

export default function LocationStep({ onSubmit, onSaveOnly, loading, initialData }: Props) {
  const [city, setCity] = useState(() => {
    if (!initialData?.city) return ''
    return CITIES.includes(initialData.city) ? initialData.city : 'Other'
  })
  const [customCity, setCustomCity] = useState(() => {
    if (!initialData?.city || CITIES.includes(initialData.city)) return ''
    return initialData.city
  })
  const [country, setCountry] = useState(initialData?.country ?? 'India')
  const [timezone, setTimezone] = useState(initialData?.timezone ?? 'Asia/Kolkata')

  function buildData() {
    const finalCity = city === 'Other' ? customCity : city
    const coords = CITY_COORDS[finalCity] ?? {}
    return { city: finalCity, country, timezone, lat: coords.lat ?? null, lon: coords.lon ?? null }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(buildData())
  }

  const canSubmit = city && (city !== 'Other' || customCity)

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        🌤️ Your location helps us adjust your hydration and calorie targets based on local weather conditions. Your city name is used to fetch weather — no GPS access required.
      </div>

      <div>
        <label className="label">City</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 10 }}>
          {CITIES.map(c => (
            <button key={c} type="button" onClick={() => setCity(c)} style={{
              padding: '10px 8px', borderRadius: 8, border: `1.5px solid ${city === c ? 'var(--primary)' : 'var(--border)'}`,
              background: city === c ? 'rgba(45,125,125,0.08)' : 'var(--surface)',
              cursor: 'pointer', fontSize: 13, fontWeight: city === c ? 600 : 400,
              color: city === c ? 'var(--primary)' : 'var(--text)', transition: 'all 0.12s',
            }}>{c}</button>
          ))}
        </div>
        {city === 'Other' && (
          <input className="input-field" placeholder="Enter your city" value={customCity} onChange={e => setCustomCity(e.target.value)} required />
        )}
      </div>

      <div className="grid-2">
        <div>
          <label className="label">Country</label>
          <input className="input-field" value={country} onChange={e => setCountry(e.target.value)} required />
        </div>
        <div>
          <label className="label">Timezone</label>
          <select className="input-field" value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Dubai">UAE (GST)</option>
            <option value="America/New_York">US Eastern</option>
            <option value="Europe/London">UK (GMT/BST)</option>
            <option value="Asia/Singapore">Singapore (SGT)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {onSaveOnly && (
          <button type="button" className="btn-secondary" disabled={!canSubmit || loading}
            onClick={() => onSaveOnly(buildData())} style={{ flex: 1 }}>
            Save & return to profile
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={!canSubmit || loading} style={{ flex: 2 }}>
          {loading ? 'Generating your plan…' : onSaveOnly ? 'Continue →' : '🚀 Build my plan'}
        </button>
      </div>
    </form>
  )
}
