'use client'
import { useState } from 'react'

interface Props { onSubmit: (data: object) => void; loading: boolean }

const CONDITIONS = [
  { code: 'type2_diabetes_medicated', label: 'Type 2 Diabetes (on medication)', group: 'Metabolic' },
  { code: 'type1_diabetes', label: 'Type 1 Diabetes', group: 'Metabolic' },
  { code: 'hypertension_medicated', label: 'High Blood Pressure (on medication)', group: 'Cardiovascular' },
  { code: 'hypertension', label: 'High Blood Pressure (diet-managed)', group: 'Cardiovascular' },
  { code: 'ckd_stage3', label: 'Chronic Kidney Disease Stage 3', group: 'Kidney' },
  { code: 'ckd_stage4', label: 'Chronic Kidney Disease Stage 4', group: 'Kidney' },
  { code: 'ckd_stage5', label: 'Chronic Kidney Disease Stage 5', group: 'Kidney' },
  { code: 'dialysis', label: 'On Dialysis', group: 'Kidney' },
  { code: 'pregnancy', label: 'Pregnant', group: 'Reproductive' },
  { code: 'hypothyroid', label: 'Hypothyroidism', group: 'Hormonal' },
  { code: 'pcos', label: 'PCOS', group: 'Hormonal' },
  { code: 'celiac', label: 'Coeliac Disease', group: 'Digestive' },
  { code: 'ibs_severe', label: 'Irritable Bowel Syndrome (severe)', group: 'Digestive' },
  { code: 'severe_allergy_anaphylaxis', label: 'Severe Allergy (anaphylaxis history)', group: 'Allergy' },
  { code: 'eating_disorder', label: 'Eating Disorder (history or current)', group: 'Mental Health' },
]

const RISK_MESSAGES: Record<string, { msg: string; color: string }> = {
  CRITICAL: { msg: '⚠️ Your profile requires clinician review. Your plan will be in conservative mode until a qualified professional approves it. This typically takes 24 hours.', color: '#FEF2F2' },
  HIGH: { msg: '⚕️ Based on your conditions, certain planning features are restricted for your safety. A clinical review has been queued.', color: '#FFFBEB' },
}

export default function MedicalContextStep({ onSubmit, loading }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [noConditions, setNoConditions] = useState(false)

  const groups = Array.from(new Set(CONDITIONS.map(c => c.group)))

  function toggle(code: string) {
    setNoConditions(false)
    setSelected(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n })
  }

  function getRiskPreview(): string {
    const codes = Array.from(selected)
    const CRITICAL = ['ckd_stage4', 'ckd_stage5', 'dialysis', 'eating_disorder']
    const HIGH = ['ckd_stage3', 'type1_diabetes', 'pregnancy', 'severe_allergy_anaphylaxis']
    if (codes.some(c => CRITICAL.includes(c))) return 'CRITICAL'
    if (codes.some(c => HIGH.includes(c))) return 'HIGH'
    return 'LOW'
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (noConditions) { onSubmit({ conditions: [] }); return }
    const conditions = Array.from(selected).map(code => ({
      conditionCode: code,
      conditionLabel: CONDITIONS.find(c => c.code === code)!.label,
      onMedication: code.includes('_medicated'),
    }))
    onSubmit({ conditions })
  }

  const risk = selected.size > 0 ? getRiskPreview() : null
  const riskMsg = risk && RISK_MESSAGES[risk]

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>This is context, not diagnosis.</strong> We use this information to set safe nutrient targets and avoid harmful recommendations. Your data is encrypted and never shared.
      </div>

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

      {riskMsg && (
        <div style={{ background: riskMsg.color, border: `1px solid ${risk === 'CRITICAL' ? '#FECACA' : '#FDE68A'}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.6 }}>
          {riskMsg.msg}
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={(!noConditions && selected.size === 0) || loading}>
        {loading ? 'Saving…' : 'Continue →'}
      </button>
    </form>
  )
}
