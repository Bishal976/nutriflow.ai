'use client'
import { useState } from 'react'

interface Props { onSubmit: (data: object) => void; loading: boolean }

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

export default function LocationStep({ onSubmit, loading }: Props) {
  const [city, setCity] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [country, setCountry] = useState('India')
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalCity = city === 'Other' ? customCity : city
    const coords = CITY_COORDS[finalCity] ?? {}
    onSubmit({ city: finalCity, country, timezone, lat: coords.lat ?? null, lon: coords.lon ?? null })
  }

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

      <button className="btn-primary" type="submit" disabled={(!city || (city === 'Other' && !customCity)) || loading} style={{ marginTop: 8 }}>
        {loading ? 'Generating your plan…' : '🚀 Build my plan'}
      </button>
    </form>
  )
}
