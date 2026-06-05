'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/dashboard/LogoutButton'
import { useToast } from '@/components/ui/Toast'
import { track } from '@/lib/posthog'

const DIET_TYPES = ['VEG', 'VEGAN', 'EGGETARIAN', 'NON_VEG', 'JAIN', 'PESCATARIAN']
const CUISINES = ['Indian', 'South Indian', 'Punjabi', 'Bengali', 'Gujarati', 'Mediterranean', 'Continental', 'Chinese', 'Thai']
const COMMON_ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Soy', 'Eggs', 'Shellfish', 'Fish']
const COMMON_CONDITIONS = [
  { code: 'type2_diabetes', label: 'Type 2 Diabetes' },
  { code: 'hypertension', label: 'Hypertension' },
  { code: 'hypothyroidism', label: 'Hypothyroidism' },
  { code: 'hyperthyroidism', label: 'Hyperthyroidism' },
  { code: 'pcos', label: 'PCOS / PCOD' },
  { code: 'ckd_stage1', label: 'Kidney Disease (CKD Stage 1-2)' },
  { code: 'ckd_stage3', label: 'Kidney Disease (CKD Stage 3+)' },
  { code: 'dialysis', label: 'On Dialysis' },
  { code: 'anemia', label: 'Anemia' },
  { code: 'ibs', label: 'IBS (Irritable Bowel Syndrome)' },
  { code: 'celiac', label: 'Celiac / Gluten Intolerance' },
  { code: 'lactose_intolerance', label: 'Lactose Intolerance' },
  { code: 'gerd', label: 'GERD / Acid Reflux' },
  { code: 'high_cholesterol', label: 'High Cholesterol' },
  { code: 'fatty_liver', label: 'Fatty Liver (NAFLD)' },
]

const ONBOARDING_STEPS = [
  { step: 1, icon: '📏', label: 'Body & measurements', subtitle: 'Height, weight, age, activity' },
  { step: 2, icon: '🎯', label: 'Goals', subtitle: 'Weight loss, muscle gain, etc.' },
  { step: 3, icon: '🏥', label: 'Health conditions', subtitle: 'Medical context & medications' },
  { step: 4, icon: '📋', label: 'Medical documents', subtitle: 'Lab reports & prescriptions' },
  { step: 5, icon: '🥗', label: 'Food preferences', subtitle: 'Diet type, allergens, cuisines' },
  { step: 6, icon: '📍', label: 'Location', subtitle: 'For weather-aware plans' },
]

interface Profile {
  firstName: string | null; lastName: string | null
  dietType: string | null; city: string | null; country: string | null
  allergens: string[]; cuisinePreferences: string[]; dislikedIngredients: string[]
  riskLevel: string | null; clinicianReviewRequired: boolean | null
}

interface MedicalCondition {
  id: string; conditionCode: string; conditionLabel: string
  severity: string | null; onMedication: boolean | null; userConfirmed: boolean | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [conditions, setConditions] = useState<MedicalCondition[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addingCondition, setAddingCondition] = useState(false)
  const [conditionSearch, setConditionSearch] = useState('')
  const [customCondition, setCustomCondition] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile)
        setEmail(d.email ?? '')
        setConditions(d.conditions ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function startEdit() {
    if (!profile) return
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      dietType: profile.dietType ?? 'VEG',
      city: profile.city ?? '',
      country: profile.country ?? '',
      allergens: profile.allergens ?? [],
      cuisinePreferences: profile.cuisinePreferences ?? [],
      dislikedIngredients: profile.dislikedIngredients ?? [],
    })
    setEditing(true)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setProfile(prev => prev ? { ...prev, ...form } as Profile : prev)
        setEditing(false)
        toast('Profile updated')
        track('profile_updated')
      } else {
        toast('Failed to save changes', 'error')
      }
    } finally { setSaving(false) }
  }

  function toggleArray(field: 'allergens' | 'cuisinePreferences', value: string) {
    setForm(f => {
      const arr = (f[field] ?? []) as string[]
      return { ...f, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
    })
  }

  async function addCondition(code: string, label: string) {
    if (conditions.find(c => c.conditionCode === code)) { toast('Already added', 'error'); return }
    const res = await fetch('/api/profile/conditions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditionCode: code, conditionLabel: label }),
    })
    if (res.ok) {
      const d = await res.json()
      setConditions(prev => [...prev, d.condition])
      setAddingCondition(false)
      setConditionSearch('')
      setCustomCondition('')
      toast('Condition added')
    } else { toast('Failed to add condition', 'error') }
  }

  async function removeCondition(id: string) {
    const res = await fetch('/api/profile/conditions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditionId: id }),
    })
    if (res.ok) {
      setConditions(prev => prev.filter(c => c.id !== id))
      toast('Condition removed')
    } else { toast('Failed to remove', 'error') }
  }

  const riskColors: Record<string, string> = { LOW: '#4CAF7D', MODERATE: '#F5A623', HIGH: '#E8943A', CRITICAL: '#E05A5A' }

  const filteredConditions = COMMON_CONDITIONS.filter(c =>
    !conditions.find(ec => ec.conditionCode === c.code) &&
    (conditionSearch === '' || c.label.toLowerCase().includes(conditionSearch.toLowerCase()))
  )

  if (loading) return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 160, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Profile</h1>
        {!editing && <button className="btn-secondary" style={{ fontSize: 13, padding: '7px 16px' }} onClick={startEdit}>✏️ Edit</button>}
      </div>

      {/* Account info */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Account</h2>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div>
                <label className="label">First name</label>
                <input className="input-field" value={form.firstName ?? ''} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input-field" value={form.lastName ?? ''} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
              </div>
            </div>
            <Row label="Email" value={email} />
            <div className="grid-2">
              <div>
                <label className="label">City</label>
                <input className="input-field" value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Mumbai" />
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input-field" value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. India" />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Email" value={email} />
            <Row label="Name" value={profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || '—' : '—'} />
            <Row label="Location" value={profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : '—'} />
          </div>
        )}
      </div>

      {/* Diet preferences */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Diet preferences</h2>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Diet type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {DIET_TYPES.map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, dietType: d }))}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${form.dietType === d ? 'var(--primary)' : 'var(--border)'}`, background: form.dietType === d ? 'rgba(45,125,125,0.1)' : 'var(--surface)', color: form.dietType === d ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Allergens to exclude</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {COMMON_ALLERGENS.map(a => {
                  const selected = (form.allergens ?? []).includes(a)
                  return (
                    <button key={a} type="button" onClick={() => toggleArray('allergens', a)}
                      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'rgba(232,148,58,0.1)' : 'var(--surface)', color: selected ? '#8B4F00' : 'var(--text-muted)' }}>
                      {selected ? '⚠ ' : ''}{a}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="label">Cuisine preferences</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {CUISINES.map(c => {
                  const selected = (form.cuisinePreferences ?? []).includes(c)
                  return (
                    <button key={c} type="button" onClick={() => toggleArray('cuisinePreferences', c)}
                      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, background: selected ? 'rgba(45,125,125,0.1)' : 'var(--surface)', color: selected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Diet type" value={profile?.dietType ?? '—'} />
            <Row label="Allergens" value={profile?.allergens?.length ? profile.allergens.join(', ') : 'None'} />
            <Row label="Cuisines" value={profile?.cuisinePreferences?.length ? profile.cuisinePreferences.join(', ') : '—'} />
          </div>
        )}
      </div>

      {/* Health profile */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Health profile</h2>
          <span style={{ fontWeight: 700, fontSize: 13, color: riskColors[profile?.riskLevel ?? 'LOW'], background: `${riskColors[profile?.riskLevel ?? 'LOW']}18`, padding: '3px 10px', borderRadius: 10 }}>
            {profile?.riskLevel ?? 'LOW'} risk
          </span>
        </div>

        {profile?.clinicianReviewRequired && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
            ⚕️ Your profile is awaiting clinician review. Plan is in conservative mode.
          </div>
        )}

        {/* Conditions list */}
        <div style={{ marginBottom: 12 }}>
          <label className="label" style={{ marginBottom: 10, display: 'block' }}>Medical conditions</label>
          {conditions.length === 0 && !addingCondition && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No conditions added.</p>
          )}
          {conditions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {conditions.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(224,90,90,0.08)', border: '1.5px solid rgba(224,90,90,0.3)', fontSize: 13, fontWeight: 600, color: 'var(--error)' }}>
                  {c.conditionLabel}
                  <button onClick={() => removeCondition(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {addingCondition ? (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <input
                className="input-field"
                placeholder="Search conditions…"
                value={conditionSearch}
                onChange={e => setConditionSearch(e.target.value)}
                style={{ marginBottom: 10 }}
                autoFocus
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                {filteredConditions.map(c => (
                  <button key={c.code} onClick={() => addCondition(c.code, c.label)}
                    style={{ padding: '8px 12px', background: 'var(--surface-2)', border: 'none', borderRadius: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                    {c.label}
                  </button>
                ))}
                {filteredConditions.length === 0 && conditionSearch && (
                  <div style={{ padding: '6px 0' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Not in list? Add &quot;{conditionSearch}&quot; as custom:</p>
                    <button onClick={() => addCondition(conditionSearch.toLowerCase().replace(/\s+/g, '_'), conditionSearch)}
                      className="btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}>
                      + Add &quot;{conditionSearch}&quot;
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => { setAddingCondition(false); setConditionSearch('') }} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingCondition(true)} className="btn-secondary" style={{ fontSize: 13, padding: '7px 16px' }}>
              + Add condition
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}

      {/* Onboarding re-edit */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Update onboarding data</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>Got new test results? Changed your goal? Re-run any section.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ONBOARDING_STEPS.map(({ step, icon, label, subtitle }) => (
            <Link key={step} href={`/onboarding/${step}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,125,125,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <LogoutButton />

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Medical data is encrypted with AES-256. NutriFlow never sells or shares your health information.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-2)' }}>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
