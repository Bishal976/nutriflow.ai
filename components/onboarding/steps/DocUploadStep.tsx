'use client'
interface Props { onSubmit: (data: object) => void; loading: boolean; onSkip: () => void }

export default function DocUploadStep({ onSubmit, loading, onSkip }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Optional but powerful.</strong> Uploading a prescription or lab report lets us extract your medications and recent values (e.g., HbA1c, creatinine, lipid panel) to further personalise your targets. All documents are encrypted with AES-256 and never shared.
      </div>

      <div style={{
        border: '2px dashed var(--border)', borderRadius: 12, padding: '40px 24px',
        textAlign: 'center', cursor: 'pointer', background: 'var(--surface)',
        transition: 'border-color 0.15s',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
        <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Upload prescription or lab report</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>PDF, JPG, or PNG — max 10MB</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Document upload coming in the next release. For now, you can add medical context manually in the previous step.
        </p>
      </div>

      <button className="btn-primary" onClick={onSkip} style={{ width: '100%' }}>
        Continue to next step →
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: -8 }}>
        Document upload will be available in a future release.
      </p>
    </div>
  )
}
