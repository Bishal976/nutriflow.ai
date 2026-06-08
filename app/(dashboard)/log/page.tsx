'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/posthog'

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'Breakfast', icon: '🌅' },
  { value: 'MORNING_SNACK', label: 'Morning snack', icon: '🫖' },
  { value: 'LUNCH', label: 'Lunch', icon: '🍱' },
  { value: 'EVENING_SNACK', label: 'Evening snack', icon: '🌰' },
  { value: 'DINNER', label: 'Dinner', icon: '🌙' },
]

export default function LogMealPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mealType, setMealType] = useState('LUNCH')
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit() {
    if (!file) return
    setError(''); setUploading(true)
    let navigated = false
    try {
      const planRes = await fetch('/api/plan/generate')
      const planData = await planRes.json()

      if (!planData?.dailyLogId) {
        setError("Couldn't create today's log. Make sure you've completed onboarding.")
        return
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('mealType', mealType)
      formData.append('dailyLogId', planData.dailyLogId)

      const res = await fetch('/api/vision/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.status === 402 && data.upgrade) {
        router.push(`/upgrade?reason=${data.feature ?? 'meal_log_limit'}`)
        navigated = true
        return
      }
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }

      track('meal_photo_uploaded', { mealType })
      router.push(`/log/${data.jobId}?mealLogId=${data.mealLogId}`)
      navigated = true
    } catch { setError('Network error. Please try again.') }
    finally { if (!navigated) setUploading(false) }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Log a meal</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Take a photo of your plate and we&apos;ll estimate the nutrition and adjust your remaining day.</p>
      </div>

      {/* Meal type selector */}
      <div>
        <label className="label">Which meal is this?</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MEAL_TYPES.map(m => (
            <button key={m.value} type="button" onClick={() => setMealType(m.value)} style={{
              padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${mealType === m.value ? 'var(--primary)' : 'var(--border)'}`,
              background: mealType === m.value ? 'rgba(45,125,125,0.1)' : 'var(--surface)',
              color: mealType === m.value ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: mealType === m.value ? 600 : 400, cursor: 'pointer', fontSize: 13, transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        style={{
          border: `2px dashed ${preview ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
          background: 'var(--surface)', position: 'relative',
          minHeight: preview ? 'auto' : 220,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s',
        }}>
        {preview ? (
          <img src={preview} alt="Meal preview" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📸</div>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Tap to take a photo or upload</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Or drag & drop your image here</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>JPG, PNG, WebP — max 10MB</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {preview && (
        <button className="btn-secondary" onClick={() => { setPreview(null); setFile(null) }} style={{ fontSize: 13 }}>
          ✕ Remove photo
        </button>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>{error}</div>
      )}

      <button className="btn-primary" onClick={handleSubmit} disabled={!file || uploading} style={{ padding: '14px', fontSize: 15 }}>
        {uploading
          ? <><span className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> Analysing your plate…</>
          : '🔍 Analyse meal'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        AI estimates are approximate. You can review and edit the results before confirming.
      </p>
    </div>
  )
}
