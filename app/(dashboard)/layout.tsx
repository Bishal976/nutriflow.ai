import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import DashboardNav from '@/components/dashboard/DashboardNav'
import EmailVerificationBanner from '@/components/dashboard/EmailVerificationBanner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  const emailVerified = user?.emailVerified ?? true
  const isPro = user?.plan === 'pro' && (!user.planExpiresAt || user.planExpiresAt > new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <DashboardNav isPro={isPro} />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }} className="mobile-pb">
        {!emailVerified && <EmailVerificationBanner />}
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}
