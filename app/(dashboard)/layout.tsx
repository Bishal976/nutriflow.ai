import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <DashboardNav />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }} className="mobile-pb">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}
