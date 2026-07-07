'use client'
import { useState, useRef } from 'react'
import { CONDITIONS } from '@/lib/nutrition/conditions'

interface Props {
  onSubmit: (data: object) => void
  onSaveOnly?: (data: object) => void
  loading: boolean
  initialData?: { conditions?: { code: string; label: string }[] }
}

export default function MedicalContextStep({ onSubmit, onSaveOnly, loading, initialData }: Props) {
  const initialConditions = initialData?.conditions ?? []
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(initialConditions.map(c => c.code))
  )
  const [noConditions, setNoConditions] = useState(() =>
    initialData?.conditions !== undefined && initialConditions.length === 0
  )
  const initialSelected = useRef(initialConditions.map(c => c.code).sort().join(','))
  const initialNoConditions = useRef(initialData?.conditions !== undefined && initialConditions.length === 0)
  const isDirty = [...selected].sort().join(',') !== initialSelected.current || noConditions !== initialNoConditions.current

  // A condition can come from the picker (canonical, has a CONDITIONS entry)
  // or from the profile page's free-text "custom condition" feature / a
  // document extraction that didn't map onto a canonical code — those have no
  // CONDITIONS entry at all. Keep their original label so re-submitting this
  // step unchanged doesn't crash trying to look up a label that doesn't exist,
  // and doesn't silently drop or rename what the user actually typed.
  const labelByCode = useRef(new Map(initialConditions.map(c => [c.code, c.label])))

  const groups = Array.from(new Set(CONDITIONS.map(c => c.group)))

  // Conditions added elsewhere (profile page's free-text "custom condition"
  // feature, or an unmapped document extraction) have no entry in the
  // canonical picker below, so they'd otherwise be invisible here — carried
  // forward silently with no way to see or remove them from this screen.
  // Derived from live `selected` state (not just initialData) so removing one
  // updates the list immediately, and it empties out if "none of the above"
  // is checked.
  const otherConditions = [...selected]
    .filter(code => !CONDITIONS.some(c => c.code === code))
    .map(code => ({ code, label: labelByCode.current.get(code) ?? code }))

  function toggle(code: string) {
    setNoConditions(false)
    setSelected(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n })
  }

  function buildData() {
    if (noConditions) return { conditions: [] }
    return {
      conditions: Array.from(selected).map(code => ({
        conditionCode: code,
        conditionLabel: CONDITIONS.find(c => c.code === code)?.label ?? labelByCode.current.get(code) ?? code,
        onMedication: code.includes('_medicated'),
      }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(buildData())
  }

  const canSubmit = noConditions || selected.size > 0

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>This is context, not diagnosis.</strong> We use this information to set safe nutrient targets and avoid harmful recommendations. Your data is encrypted and never shared.
      </div>

      {otherConditions.length > 0 && (
        <div>
          <label className="label" style={{ marginBottom: 8, display: 'block' }}>Already on your profile</label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Added elsewhere (e.g. your profile page) — not part of the checklist below, but still factored into your targets. Remove here if no longer accurate.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {otherConditions.map(c => (
              <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(224,90,90,0.08)', border: '1.5px solid rgba(224,90,90,0.3)', fontSize: 13, fontWeight: 600, color: 'var(--error)' }}>
                {c.label}
                <button type="button" onClick={() => toggle(c.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.map(group => (
        <div key={group}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CONDITIONS.filter(c => c.group === group).map(c => (
              <label key={c.code} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 8, border: `1.5px solid ${selected.has(c.code) ? 'var(--primary)' : 'var(--border)'}`,
                background: selected.has(c.code) ? 'rgba(45,125,125,0.06)' : 'var(--surface)',
                cursor: 'pointer', transition: 'all 0.12s', fontSize: 14,
              }}>
                <input type="checkbox" checked={selected.has(c.code)} onChange={() => toggle(c.code)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                <span style={{ color: 'var(--text)' }}>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', background: noConditions ? 'rgba(76,175,125,0.06)' : 'var(--surface)' }}>
        <input type="checkbox" checked={noConditions} onChange={e => { setNoConditions(e.target.checked); if (e.target.checked) setSelected(new Set()) }} style={{ accentColor: 'var(--success)', width: 16, height: 16 }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>I have none of the above conditions</span>
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {onSaveOnly && (
          <button type="button" className="btn-secondary" disabled={!canSubmit || loading || !isDirty}
            onClick={() => onSaveOnly(buildData())} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" style={{ width: 12, height: 12, border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: 'var(--text)', borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />Saving…</> : 'Save & return to profile'}
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={!canSubmit || loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </form>
  )
}
