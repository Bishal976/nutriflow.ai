import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14 }}>🌿</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>NutriFlow</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NavLink href="/dashboard" label="Today" />
            <NavLink href="/log" label="Log meal" accent />
            <NavLink href="/history" label="History" />
            <NavLink href="/profile" label="Profile" />
          </div>
        </div>
      </nav>
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, label, accent }: { href: string; label: string; accent?: boolean }) {
  return (
    <Link href={href} style={{
      padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: accent ? 600 : 500,
      textDecoration: 'none',
      background: accent ? 'var(--primary)' : 'transparent',
      color: accent ? 'white' : 'var(--text-muted)',
    }}>
      {label}
    </Link>
  )
}
