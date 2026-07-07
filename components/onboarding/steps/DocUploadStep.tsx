'use client'
import { useRef, useState, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'

interface ExistingDoc {
  id: string
  documentType: string | null
  jobStatus: string
  extractedData: any
  createdAt: string | Date
}

interface Props { onSubmit: (data: object) => void; loading: boolean; onSkip: () => void; onSaveOnly?: () => void; existingDocs?: ExistingDoc[] }

interface ExtractedLabValue { name: string; value: string; unit: string; flag?: string }
interface Extracted {
  documentType: string
  medications: Array<{ name: string; dose?: string; frequency?: string }>
  labValues: ExtractedLabValue[]
  conditions: string[]
  rawSummary: string
}

interface UploadItem {
  id: string
  fileName: string
  state: 'uploading' | 'done' | 'error'
  extracted?: Extracted
  errorMsg?: string
}

export default function DocUploadStep({ onSubmit, loading, onSkip, onSaveOnly, existingDocs = [] }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dropError, setDropError] = useState('')
  const [hitUpgradeLimit, setHitUpgradeLimit] = useState(false)
  const [savedDocs, setSavedDocs] = useState<ExistingDoc[]>(existingDocs)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => { setSavedDocs(existingDocs) }, [existingDocs])

  const isUploading = items.some(i => i.state === 'uploading')
  const hasSuccess = items.some(i => i.state === 'done')

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  async function handleFile(file: File) {
    if (inputRef.current) inputRef.current.value = ''
    setDropError('')

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setDropError('Only PDF, JPG, PNG, or WebP files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setDropError('File too large — maximum 10MB.')
      return
    }

    const id = `${Date.now()}-${Math.random()}`
    setItems(prev => [...prev, { id, fileName: file.name, state: 'uploading' }])

    try {
      // Step 1: preflight — check plan limit before starting upload
      const checkRes = await fetch('/api/documents/upload', { method: 'GET' })
      const checkData = await checkRes.json()
      if (checkRes.status === 402 && checkData.upgrade) {
        setItems(prev => prev.filter(i => i.id !== id))
        setHitUpgradeLimit(true)
        return
      }
      if (!checkRes.ok) throw new Error(checkData.error || 'Upload check failed')

      // Step 2: upload directly from browser to Vercel Blob (bypasses 4.5MB function limit)
      const blob = await upload(file.name, file, {
        access: 'private',
        handleUploadUrl: '/api/documents/upload',
        multipart: true,
      })

      // Step 3: server-side extraction from stored blob
      const res = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: blob.url, fileType: file.type, fileName: file.name }),
      })
      const data = await res.json()
      if (res.status === 402 && data.upgrade) {
        setItems(prev => prev.filter(i => i.id !== id))
        setHitUpgradeLimit(true)
        return
      }
      if (!res.ok && res.status !== 207) throw new Error(data.error || 'Processing failed')
      updateItem(id, { state: 'done', extracted: data.extracted ?? undefined })
    } catch (e) {
      updateItem(id, {
        state: 'error',
        errorMsg: e instanceof Error ? e.message : 'Upload failed. Please try again.',
      })
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (isUploading) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function deleteSavedDoc(id: string) {
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedDocs(prev => prev.filter(d => d.id !== id))
      }
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(45,125,125,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Optional but powerful.</strong> Upload prescriptions or lab reports to extract medications and values (HbA1c, creatinine, lipid panel) for personalised targets. All documents are encrypted and never shared.
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Previously saved documents (edit mode) */}
      {savedDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previously uploaded</div>
          {savedDocs.map(doc => {
            const label = doc.documentType
              ? doc.documentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
              : 'Medical document'
            const deleting = deletingIds.has(doc.id)
            return (
              <div key={doc.id} style={{ background: 'rgba(45,125,125,0.06)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, opacity: deleting ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {doc.jobStatus === 'DONE' ? 'Processed' : 'Processing'} · {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', flexShrink: 0, padding: '4px 10px', border: '1px solid var(--primary)', borderRadius: 6 }}
                >
                  View
                </a>
                <button
                  onClick={() => deleteSavedDoc(doc.id)}
                  disabled={deleting}
                  style={{ background: 'none', border: 'none', cursor: deleting ? 'default' : 'pointer', color: '#c0392b', fontSize: 13, fontWeight: 600, flexShrink: 0, padding: '4px 8px' }}
                >
                  {deleting ? '…' : 'Delete'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed / failed items list */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <UploadCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
        </div>
      )}

      {/* Upgrade banner — shown when free user hits the 1-doc limit */}
      {hitUpgradeLimit ? (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(45,125,125,0.3)' }}>
          <div style={{ background: 'rgba(45,125,125,0.07)', padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>Upload unlimited reports with Pro</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Free plan includes 1 medical report. Upgrade to upload all your prescriptions and lab reports for personalised targets.
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push('/upgrade?reason=medical_documents')}
              style={{ width: '100%', padding: '12px', fontSize: 14 }}
            >
              Upgrade to Pro →
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone — shown when not at upgrade limit */
        <div
          onClick={() => !isUploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: `2px dashed ${isUploading ? 'var(--border)' : dropError ? '#e05252' : 'var(--border)'}`,
            borderRadius: 12, padding: hasSuccess ? '20px 24px' : '40px 24px',
            textAlign: 'center', cursor: isUploading ? 'default' : 'pointer',
            background: 'var(--surface)', transition: 'border-color 0.15s',
            opacity: isUploading ? 0.5 : 1,
          }}
        >
          <div style={{ fontSize: hasSuccess ? 24 : 36, marginBottom: 8 }}>📄</div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: hasSuccess ? 13 : 15 }}>
            {hasSuccess ? 'Upload another document' : 'Upload prescription or lab report'}
          </p>
          {!hasSuccess && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>PDF, JPG, or PNG — max 10MB</p>}
          {hasSuccess && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Free plan: 1 report included</p>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isUploading ? 'Processing current file…' : 'Click or drag & drop'}
          </p>
        </div>
      )}

      {dropError && (
        <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#a33' }}>
          {dropError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {onSaveOnly && (
          <button className="btn-secondary" onClick={onSaveOnly} disabled={loading || isUploading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" style={{ width: 12, height: 12, border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: 'var(--text)', borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />Saving…</> : 'Back to profile'}
          </button>
        )}
        <button className="btn-primary" onClick={onSkip} disabled={loading || isUploading} style={{ flex: 2 }}>
          {hasSuccess ? 'Continue →' : 'Skip for now →'}
        </button>
      </div>
    </div>
  )
}

function UploadCard({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  // Auto-expand when a condition was detected — that's the safety-relevant
  // case (it already adjusted calorie/macro targets) and shouldn't be hidden
  // behind a toggle the user has no reason to know to click.
  const [expanded, setExpanded] = useState(() => !!item.extracted && item.extracted.conditions.length > 0)
  const { fileName, state, extracted, errorMsg } = item

  if (state === 'uploading') {
    return (
      <div style={{ background: 'rgba(45,125,125,0.04)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Uploading & extracting…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fileName}</div>
        </div>
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ background: 'rgba(220,80,80,0.06)', border: '1.5px solid rgba(220,80,80,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#a33' }}>Upload failed</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
          {errorMsg && <div style={{ fontSize: 12, color: '#a33', marginTop: 2 }}>{errorMsg}</div>}
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}>✕</button>
      </div>
    )
  }

  // done
  const hasDetails = extracted && (extracted.conditions.length > 0 || extracted.medications.length > 0 || extracted.labValues.length > 0)

  return (
    <div style={{ background: 'rgba(45,125,125,0.06)', border: '1.5px solid var(--primary)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Document processed</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
        </div>
        {hasDetails && (
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
            {expanded ? 'Hide ▲' : 'View ▼'}
          </button>
        )}
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}>✕</button>
      </div>

      {expanded && extracted && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {extracted.rawSummary && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{extracted.rawSummary}</p>}
          {extracted.conditions.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Conditions</div>
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
                    {lv.name}: <strong>{lv.value} {lv.unit}</strong>{lv.flag && lv.flag !== 'normal' ? ' ↑' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
          {extracted.conditions.length > 0 ? (
            <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
              ⚡ Your calorie and macro targets have already been adjusted for the condition(s) above. Review them in Settings — remove anything that isn't correct.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Added to your medical profile. Review in Settings.</p>
          )}
        </div>
      )}
    </div>
  )
}
