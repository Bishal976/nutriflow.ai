'use client'
import { useState } from 'react'

interface Props { onSubmit: (data: object) => void; loading: boolean }

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Other']

export default function LocationStep({ onSubmit, loading }: Props) {
  const [city, setCity] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [country, setCountry] = useState('India')
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalCity = city === 'Other' ? customCity : city
    onSubmit({ city: finalCity, country, timezone })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        🌤️ Your location helps us adjust your hydration and calorie targets based on local weather conditions. Your city name is used to fetch weather — no GPS access required.
      </div>

      <div>
        <label className="label">City</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
