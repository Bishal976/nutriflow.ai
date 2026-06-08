'use client'
import { useRef, useState } from 'react'

interface Props { onSubmit: (data: object) => void; loading: boolean; onSkip: () => void; onSaveOnly?: () => void }

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface ExtractedLabValue { name: string; value: string; unit: string; flag?: string }
interface Extracted {
  documentType: string
  medications: Array<{ name: string; dose?: string; frequency?: string }>
  labValues: ExtractedLabValue[]
  conditions: string[]
  rawSummary: string
}

export default function DocUploadStep({ onSubmit, loading, onSkip, onSaveOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')

  async function handleFile(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setErrorMsg('Only PDF, JPG, PNG, or WebP files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File too large — maximum 10MB.')
      return
    }

    setFileName(file.name)
    setUploadState('uploading')
    setErrorMsg('')
    setExtracted(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok && res.status !== 207) throw new Error(data.error || 'Upload failed')

      setExtracted(data.extracted ?? null)
      setUploadState('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed. Please try again.')
      setUploadState('error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const isDone = uploadState === 'done'
  const isUploading = uploadState === 'uploading'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Optional but powerful.</strong> Uploading a prescription or lab report lets us extract your medications and recent values (e.g. HbA1c, creatinine, lipid panel) to further personalise your targets. All documents are encrypted and never shared.
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {!isDone ? (
        <div
          onClick={() => !isUploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: `2px dashed ${isUploading ? 'var(--primary)' : errorMsg ? '#e05252' : 'var(--border)'}`,
            borderRadius: 12, padding: '40px 24px', textAlign: 'center',
            cursor: isUploading ? 'default' : 'pointer',
            background: 'var(--surface)', transition: 'border-color 0.15s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>{isUploading ? '⏳' : '📄'}</div>
          {isUploading ? (
            <>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Uploading & extracting…</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fileName}</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Upload prescription or lab report</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>PDF, JPG, or PNG — max 10MB</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click or drag & drop</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: 'rgba(45,125,125,0.06)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Document processed</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fileName}</div>
            </div>
            <button
              onClick={() => { setUploadState('idle'); setExtracted(null); setFileName(''); if (inputRef.current) inputRef.current.value = '' }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}
            >✕</button>
          </div>

          {extracted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {extracted.rawSummary && (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>{extracted.rawSummary}</p>
              )}
              {extracted.conditions.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Conditions detected</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {extracted.conditions.map(c => (
                      <span key={c} style={{ background: 'rgba(45,125,125,0.12)', color: 'var(--primary)', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {extracted.medications.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Medications</div>
                  {extracted.medications.map((m, i) => (
                    <div key={i} style={{ color: 'var(--text-muted)' }}>
                      {m.name}{m.dose ? ` — ${m.dose}` : ''}{m.frequency ? `, ${m.frequency}` : ''}
                    </div>
                  ))}
                </div>
              )}
              {extracted.labValues.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Lab values</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                    {extracted.labValues.map((lv, i) => (
                      <div key={i} style={{ color: lv.flag === 'high' || lv.flag === 'low' ? '#c0392b' : 'var(--text-muted)' }}>
                        {lv.name}: <strong>{lv.value} {lv.unit}</strong>
                        {lv.flag && lv.flag !== 'normal' ? ` ↑` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                These have been added to your medical profile. You can review them in Settings.
              </p>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#a33' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {onSaveOnly && (
          <button className="btn-secondary" onClick={onSaveOnly} style={{ flex: 1 }}>
            Back to profile
          </button>
        )}
        <button className="btn-primary" onClick={onSkip} disabled={loading || isUploading} style={{ flex: 2 }}>
          {isDone ? 'Continue →' : 'Skip for now →'}
        </button>
      </div>
    </div>
  )
}
