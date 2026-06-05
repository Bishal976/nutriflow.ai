import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { profiles, medicalConditions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) return null

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
  const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })

  const riskColors: Record<string, string> = { LOW: '#4CAF7D', MODERATE: '#F5A623', HIGH: '#E8943A', CRITICAL: '#E05A5A' }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Profile</h1>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Email" value={session.email} />
          <Row label="Name" value={profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || '—' : '—'} />
          <Row label="Diet type" value={profile?.dietType ?? '—'} />
          <Row label="Location" value={profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : '—'} />
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Health profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Risk level</span>
            <span style={{
              fontWeight: 700, fontSize: 13,
              color: riskColors[profile?.riskLevel ?? 'LOW'],
              background: `${riskColors[profile?.riskLevel ?? 'LOW']}18`,
              padding: '3px 10px', borderRadius: 10,
            }}>{profile?.riskLevel ?? 'LOW'}</span>
          </div>
          {profile?.clinicianReviewRequired && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)' }}>
              ⚕️ Your profile is awaiting clinician review. Your plan is in conservative mode.
            </div>
          )}
          {conditions.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Conditions on file:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {conditions.map(c => (
                  <span key={c.id} style={{ fontSize: 12, background: 'var(--surface-2)', padding: '4px 10px', borderRadius: 10, color: 'var(--text)' }}>
                    {c.conditionLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="btn-secondary" style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)' }}>
          Sign out
        </button>
      </form>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Your medical data is encrypted with AES-256 and stored securely. NutriFlow never sells or shares your personal health information.
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
