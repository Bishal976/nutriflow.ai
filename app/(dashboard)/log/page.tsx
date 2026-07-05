'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/posthog'
import UpgradeModal from '@/components/ui/UpgradeModal'

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'Breakfast', icon: '🌅' },
  { value: 'MORNING_SNACK', label: 'Morning snack', icon: '🫖' },
  { value: 'LUNCH', label: 'Lunch', icon: '🍱' },
  { value: 'EVENING_SNACK', label: 'Evening snack', icon: '🌰' },
  { value: 'DINNER', label: 'Dinner', icon: '🌙' },
]

interface FoodRow { id: number; name: string; quantity: string; calories: string }

function makeFoodRow(id: number): FoodRow {
  return { id, name: '', quantity: '', calories: '' }
}

function ManualResult({ result, onLogAnother }: {
  result: { totalCalories: number; explanation: string; rebalancedMeals: Array<{ mealType: string; totalCalories: number; items: Array<{ name: string; quantity: string; calories: number }> }> }
  onLogAnother: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Meal logged!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{result.totalCalories} kcal logged{result.rebalancedMeals.length > 0 ? ' · Your remaining day has been adjusted.' : '.'}</p>
      </div>

      {result.explanation && (
        <div style={{ background: 'rgba(45,125,125,0.07)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {result.explanation}
        </div>
      )}

      {result.rebalancedMeals.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Adjusted remaining meals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.rebalancedMeals.map(meal => (
              <div key={meal.mealType} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {meal.mealType.replace('_', ' ')} · {meal.totalCalories} kcal
                </div>
                {meal.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)', paddingBottom: 4 }}>
                    <span>{item.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {item.quantity}</span></span>
                    <span style={{ fontWeight: 600 }}>{item.calories} kcal</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={onLogAnother} style={{ flex: 1 }}>
          Log another meal
        </button>
        <a className="btn-primary" href="/dashboard" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '13px', fontWeight: 700, fontSize: 15 }}>
          Back to dashboard
        </a>
      </div>
    </div>
  )
}

export default function LogMealPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'photo' | 'manual'>('photo')
  const [mealType, setMealType] = useState('LUNCH')

  // Photo tab state
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Manual tab state
  const [rows, setRows] = useState<FoodRow[]>([makeFoodRow(1)])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualResult, setManualResult] = useState<any>(null)
  const [wantRebalance, setWantRebalance] = useState(false)

  // Upgrade modal
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>()

  function showUpgrade(reason: string) {
    setUpgradeReason(reason)
    setUpgradeOpen(true)
  }

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

  async function handlePhotoSubmit() {
    if (!file) return
    setPhotoError(''); setPhotoUploading(true)
    let navigated = false
    try {
      const planRes = await fetch('/api/plan/generate')
      const planData = await planRes.json()
      if (!planData?.dailyLogId) {
        setPhotoError("Couldn't create today's log. Make sure you've completed onboarding.")
        return
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('mealType', mealType)
      formData.append('dailyLogId', planData.dailyLogId)

      const res = await fetch('/api/vision/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.status === 402 && data.upgrade) {
        showUpgrade(data.feature ?? 'meal_log_limit')
        return
      }
      if (!res.ok) { setPhotoError(data.error ?? 'Upload failed'); return }

      track('meal_photo_uploaded', { mealType })
      router.push(`/log/${data.jobId}?mealLogId=${data.mealLogId}`)
      navigated = true
    } catch { setPhotoError('Network error. Please try again.') }
    finally { if (!navigated) setPhotoUploading(false) }
  }

  function updateRow(id: number, field: keyof FoodRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, makeFoodRow(Date.now())])
  }

  function removeRow(id: number) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  const totalCal = rows.reduce((s, r) => s + (parseFloat(r.calories) || 0), 0)

  async function handleManualSubmit() {
    const validRows = rows.filter(r => r.name.trim() && parseFloat(r.calories) > 0)
    if (validRows.length === 0) {
      setManualError('Add at least one food item with a name and calories.')
      return
    }

    setManualError(''); setManualLoading(true)
    try {
      const planRes = await fetch('/api/plan/generate')
      const planData = await planRes.json()
      if (!planData?.dailyLogId) {
        setManualError("Couldn't create today's log. Make sure you've completed onboarding.")
        return
      }

      const res = await fetch('/api/meals/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealType,
          dailyLogId: planData.dailyLogId,
          rebalance: wantRebalance,
          items: validRows.map(r => ({
            name: r.name.trim(),
            quantity: r.quantity.trim() || '1 serving',
            caloriesEstimate: parseFloat(r.calories) || 0,
          })),
        }),
      })

      const data = await res.json()
      if (res.status === 402 && data.upgrade) {
        showUpgrade(data.feature ?? 'meal_log_limit')
        return
      }
      if (!res.ok) { setManualError(data.error ?? 'Failed to log meal'); return }

      track('meal_manual_logged', { mealType, items: validRows.length })
      setManualResult(data)
    } catch { setManualError('Network error. Please try again.') }
    finally { setManualLoading(false) }
  }

  function resetManual() {
    setRows([makeFoodRow(1)])
    setManualResult(null)
    setManualError('')
  }

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '10px 0', fontWeight: active ? 700 : 500,
    fontSize: 14, cursor: 'pointer', border: 'none',
    background: active ? 'var(--primary)' : 'var(--surface-2)',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s',
  } as React.CSSProperties)

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Log a meal</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {tab === 'photo'
            ? "Take a photo of your plate and we'll estimate the nutrition and adjust your remaining day."
            : "Enter what you ate and we'll update your remaining day's plan."}
        </p>
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

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <button style={tabStyle(tab === 'photo')} onClick={() => setTab('photo')}>📸 Take photo</button>
        <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>✏️ Enter manually</button>
      </div>

      {/* ---- Photo tab ---- */}
      {tab === 'photo' && (
        <>
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

          {photoError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>
              {photoError}
            </div>
          )}

          <button className="btn-primary" onClick={handlePhotoSubmit} disabled={!file || photoUploading} style={{ padding: '14px', fontSize: 15 }}>
            {photoUploading
              ? <><span className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> Analysing your plate…</>
              : '🔍 Analyse meal'}
          </button>
        </>
      )}

      {/* ---- Manual tab ---- */}
      {tab === 'manual' && (
        manualResult ? (
          <ManualResult result={manualResult} onLogAnother={resetManual} />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 28px', gap: 8, paddingLeft: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Food item</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantity</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kcal</span>
                <span />
              </div>

              {rows.map(row => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 28px', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="e.g. Dal tadka"
                    value={row.name}
                    onChange={e => updateRow(row.id, 'name', e.target.value)}
                    style={{ fontSize: 13, padding: '10px 12px' }}
                  />
                  <input
                    className="input"
                    placeholder="1 bowl"
                    value={row.quantity}
                    onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                    style={{ fontSize: 13, padding: '10px 12px' }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="250"
                    value={row.calories}
                    onChange={e => updateRow(row.id, 'calories', e.target.value)}
                    style={{ fontSize: 13, padding: '10px 12px' }}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 4 }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                style={{
                  background: 'none', border: `1.5px dashed var(--border)`, borderRadius: 10,
                  cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                  padding: '10px', width: '100%',
                }}
              >
                + Add food item
              </button>
            </div>

            {totalCal > 0 && (
              <div style={{ background: 'rgba(45,125,125,0.07)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total for this meal</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{Math.round(totalCal)} kcal</span>
              </div>
            )}

            {/* Rebalance opt-in */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${wantRebalance ? 'var(--primary)' : 'var(--border)'}`, background: wantRebalance ? 'rgba(45,125,125,0.05)' : 'var(--surface)', transition: 'all 0.12s' }}>
              <input type="checkbox" checked={wantRebalance} onChange={e => setWantRebalance(e.target.checked)} style={{ accentColor: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Rebalance my remaining meals</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>NutriFlow will adjust your upcoming meal suggestions to compensate for what you logged. Useful when logging in real-time, not needed if logging after the fact.</div>
              </div>
            </label>

            {manualError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)' }}>
                {manualError}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleManualSubmit}
              disabled={manualLoading || totalCal === 0}
              style={{ padding: '14px', fontSize: 15 }}
            >
              {manualLoading
                ? <><span className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} /> Logging meal…</>
                : '✓ Log this meal'}
            </button>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Don't know the exact calories? Use rough estimates — NutriFlow will adjust your plan accordingly.
            </p>
          </>
        )
      )}

      {tab === 'photo' && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          AI estimates are approximate. You can review and edit the results before confirming.
        </p>
      )}
    </div>
  )
}
