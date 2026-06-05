'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Today', icon: '🏠' },
  { href: '/log', label: 'Log meal', icon: '📸', accent: true },
  { href: '/history', label: 'History', icon: '📊' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

export default function DashboardNav() {
  const pathname = usePathname()

  return (
    <>
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14 }}>🌿</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }} className="mobile-hide">NutriFlow</span>
          </Link>
          <div className="top-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {links.map(({ href, label, icon, accent }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link key={href} href={href} style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: accent
                    ? (isActive ? 'var(--primary)' : 'transparent')
                    : (isActive ? 'rgba(45,125,125,0.12)' : 'transparent'),
                  color: accent
                    ? (isActive ? 'white' : 'var(--primary)')
                    : (isActive ? 'var(--primary)' : 'var(--text-muted)'),
                  border: accent ? '1.5px solid var(--primary)' : 'none',
                  borderBottom: !accent ? (isActive ? '2px solid var(--primary)' : '2px solid transparent') : undefined,
                }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="bottom-nav">
        {links.map(({ href, label, icon, accent }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, flex: 1, textDecoration: 'none', padding: '6px 4px', borderRadius: 10,
              color: accent ? (isActive ? 'white' : 'var(--primary)') : (isActive ? 'var(--primary)' : 'var(--text-muted)'),
              background: accent ? (isActive ? 'var(--primary)' : 'rgba(45,125,125,0.08)') : (isActive ? 'rgba(45,125,125,0.1)' : 'transparent'),
              border: accent ? '1.5px solid var(--primary)' : 'none',
              margin: accent ? '0 4px' : '0 2px',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
