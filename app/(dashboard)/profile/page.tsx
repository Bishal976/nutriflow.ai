'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/dashboard/LogoutButton'
import { useToast } from '@/components/ui/Toast'

const DIET_LABELS: Record<string, string> = {
  VEG: 'Vegetarian', VEGAN: 'Vegan', EGGETARIAN: 'Eggetarian',
  NON_VEG: 'Non-vegetarian', JAIN: 'Jain', PESCATARIAN: 'Pescatarian',
}
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
  riskLevel: string | null
}

interface MedicalCondition {
  id: string; conditionCode: string; conditionLabel: string
  severity: string | null; onMedication: boolean | null; userConfirmed: boolean | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [conditions, setConditions] = useState<MedicalCondition[]>([])
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingCondition, setAddingCondition] = useState(false)
  const [conditionSearch, setConditionSearch] = useState('')
  const [customCondition, setCustomCondition] = useState('')
  const [addingConditionCode, setAddingConditionCode] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(''); setDeleteLoading(true)
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePw }),
      })
      const d = await res.json()
      if (!res.ok) { setDeleteError(d.error ?? 'Failed'); return }
      router.push('/?deleted=1')
    } catch { setDeleteError('Network error. Please try again.') }
    finally { setDeleteLoading(false) }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const d = await res.json()
      if (!res.ok) { setPwError(d.error ?? 'Failed to update password'); return }
      toast('Password updated successfully')
      setShowPasswordForm(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch { setPwError('Network error. Please try again.') }
    finally { setPwLoading(false) }
  }

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile)
        setEmail(d.email ?? '')
        setConditions(d.conditions ?? [])
        setPlan(d.plan ?? 'free')
        setPlanExpiresAt(d.planExpiresAt ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function addCondition(code: string, label: string) {
    if (conditions.find(c => c.conditionCode === code)) { toast('Already added', 'error'); return }
    setAddingConditionCode(code)
    try {
      const res = await fetch('/api/profile/conditions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionCode: code, conditionLabel: label }),
      })
      if (res.ok) {
        const d = await res.json()
        setConditions(prev => [...prev, d.condition])
        setProfile(prev => prev ? { ...prev, riskLevel: d.riskLevel } : prev)
        setAddingCondition(false)
        setConditionSearch('')
        setCustomCondition('')
        toast('Condition added')
      } else { toast('Failed to add condition', 'error') }
    } finally { setAddingConditionCode(null) }
  }

  async function removeCondition(id: string) {
    setRemovingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/profile/conditions', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionId: id }),
      })
      if (res.ok) {
        const d = await res.json()
        setConditions(prev => prev.filter(c => c.id !== id))
        setProfile(prev => prev ? { ...prev, riskLevel: d.riskLevel } : prev)
        toast('Condition removed')
      } else { toast('Failed to remove', 'error') }
    } finally { setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s }) }
  }

  const riskColors: Record<string, string> = { LOW: '#4CAF7D', MODERATE: '#F5A623', HIGH: '#E8943A', CRITICAL: '#E05A5A' }

  const filteredConditions = COMMON_CONDITIONS.filter(c =>
    !conditions.find(ec => ec.conditionCode === c.code) &&
    (conditionSearch === '' || c.label.toLowerCase().includes(conditionSearch.toLowerCase()))
  )

  const sk = { background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' } as const

  if (loading) return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page title */}
      <div style={{ width: 90, height: 26, borderRadius: 6, ...sk }} />

      {/* Account card — label short, value wide, anchored to right via marginLeft:auto */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ width: 80, height: 16, borderRadius: 5, ...sk, marginBottom: 18 }} />
        {[240, 180, 200].map((vw, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface-2)' }}>
            <div style={{ width: 58, height: 14, borderRadius: 4, ...sk }} />
            <div style={{ width: vw, height: 14, borderRadius: 4, ...sk, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>

      {/* Diet preferences card */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ width: 140, height: 16, borderRadius: 5, ...sk, marginBottom: 18 }} />
        {[52, 210, 240].map((vw, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface-2)' }}>
            <div style={{ width: 64, height: 14, borderRadius: 4, ...sk }} />
            <div style={{ width: vw, height: 14, borderRadius: 4, ...sk, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>

      {/* Health profile card */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ width: 120, height: 16, borderRadius: 5, ...sk }} />
          <div style={{ width: 74, height: 26, borderRadius: 10, ...sk }} />
        </div>
        <div style={{ width: 160, height: 13, borderRadius: 4, ...sk, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[130, 156, 112].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 20, ...sk }} />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Profile</h1>

      {/* Plan status card */}
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: plan === 'pro' ? 'linear-gradient(135deg,#2d7d7d,#4aa8a8)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>{plan === 'pro' ? '⚡' : '🌱'}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {plan === 'pro' ? 'NutriFlow Pro' : 'Free plan'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: plan === 'pro' ? 'linear-gradient(135deg,#2d7d7d,#4aa8a8)' : 'var(--surface-2)',
                color: plan === 'pro' ? 'white' : 'var(--text-muted)',
                border: plan === 'pro' ? 'none' : '1px solid var(--border)',
              }}>
                {plan === 'pro' ? 'PRO' : 'FREE'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {plan === 'pro'
                ? planExpiresAt ? `Renews ${new Date(planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Active'
                : '3 meal logs/day · 7-day history'}
            </div>
          </div>
        </div>
        {plan === 'free' && (
          <Link href="/upgrade">
            <button className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>⚡ Upgrade to Pro</button>
          </Link>
        )}
      </div>

      {/* Account info */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Email" value={email} />
          <Row label="Name" value={profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || '—' : '—'} />
          <Row label="Location" value={profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : '—'} />
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Password</h2>
          <button onClick={() => { setShowPasswordForm(v => !v); setPwError('') }} className="btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}>
            {showPasswordForm ? 'Cancel' : 'Change'}
          </button>
        </div>
        {!showPasswordForm && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>••••••••</p>}
        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="input-field" required autoComplete="current-password" />
            <input type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} className="input-field" required minLength={8} autoComplete="new-password" />
            <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input-field" required autoComplete="new-password" />
            {pwError && <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{pwError}</p>}
            <button type="submit" className="btn-primary" disabled={pwLoading} style={{ fontSize: 13 }}>
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>

      {/* Diet preferences */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Diet preferences</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Diet type" value={profile?.dietType ? (DIET_LABELS[profile.dietType] ?? profile.dietType) : '—'} />
          <Row label="Allergens" value={profile?.allergens?.length ? profile.allergens.join(', ') : 'None'} />
          <Row label="Cuisines" value={profile?.cuisinePreferences?.length ? profile.cuisinePreferences.join(', ') : '—'} />
        </div>
      </div>

      {/* Health profile */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Health profile</h2>
          <span style={{ fontWeight: 700, fontSize: 13, color: riskColors[profile?.riskLevel ?? 'LOW'], background: `${riskColors[profile?.riskLevel ?? 'LOW']}18`, padding: '3px 10px', borderRadius: 10 }}>
            {profile?.riskLevel ?? 'LOW'} risk
          </span>
        </div>

        {/* Conditions list */}
        <div style={{ marginBottom: 12 }}>
          <label className="label" style={{ marginBottom: 10, display: 'block' }}>Medical conditions</label>
          {conditions.length === 0 && !addingCondition && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No conditions added.</p>
          )}
          {conditions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {conditions.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(224,90,90,0.08)', border: '1.5px solid rgba(224,90,90,0.3)', fontSize: 13, fontWeight: 600, color: 'var(--error)', opacity: removingIds.has(c.id) ? 0.5 : 1 }}>
                  {c.conditionLabel}
                  <button
                    onClick={() => removeCondition(c.id)}
                    disabled={removingIds.has(c.id)}
                    style={{ background: 'none', border: 'none', cursor: removingIds.has(c.id) ? 'default' : 'pointer', color: 'var(--error)', padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700 }}
                  >
                    {removingIds.has(c.id) ? '…' : '×'}
                  </button>
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
                    disabled={!!addingConditionCode}
                    style={{ padding: '8px 12px', background: 'var(--surface-2)', border: 'none', borderRadius: 8, fontSize: 14, color: 'var(--text)', cursor: addingConditionCode ? 'default' : 'pointer', textAlign: 'left', fontWeight: 500, opacity: addingConditionCode && addingConditionCode !== c.code ? 0.5 : 1 }}>
                    {addingConditionCode === c.code ? 'Adding…' : c.label}
                  </button>
                ))}
                {filteredConditions.length === 0 && conditionSearch && (
                  <div style={{ padding: '6px 0' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Not in list? Add &quot;{conditionSearch}&quot; as custom:</p>
                    <button onClick={() => addCondition(conditionSearch.toLowerCase().replace(/\s+/g, '_'), conditionSearch)}
                      disabled={!!addingConditionCode}
                      className="btn-secondary" style={{ fontSize: 12, padding: '6px 14px', opacity: addingConditionCode ? 0.6 : 1 }}>
                      {addingConditionCode ? 'Adding…' : `+ Add "${conditionSearch}"`}
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

      {/* Onboarding re-edit */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Update onboarding data</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>Got new test results? Changed your goal? Re-run any section.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ONBOARDING_STEPS.map(({ step, icon, label, subtitle }) => (
            <Link key={step} href={`/onboarding/${step}?from=profile`} style={{ textDecoration: 'none' }}>
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

      {/* Danger zone */}
      <div className="card" style={{ padding: 24, border: '1px solid rgba(220,80,80,0.25)', background: 'rgba(220,80,80,0.03)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--error)', marginBottom: 6 }}>Danger zone</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Permanently delete your account and all associated data — meal logs, health profile, documents. This cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 13, padding: '8px 18px', background: 'none', border: '1px solid rgba(220,80,80,0.5)', borderRadius: 8, color: 'var(--error)', cursor: 'pointer', fontWeight: 600 }}>
            Delete my account
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--error)', margin: 0 }}>Enter your password to confirm:</p>
            <input type="password" placeholder="Your current password" value={deletePw} onChange={e => setDeletePw(e.target.value)} className="input-field" required autoFocus />
            {deleteError && <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={deleteLoading} style={{ fontSize: 13, padding: '8px 18px', background: 'var(--error)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePw(''); setDeleteError('') }} className="btn-secondary" style={{ fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Medical data is encrypted with AES-256. NutriFlow never sells or shares your health information.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderBottom: '1px solid var(--surface-2)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
