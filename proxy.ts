import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/session'

const PUBLIC_PATHS = ['/', '/login', '/signup']
const ADMIN_PATHS = ['/admin']
// Server-to-server callbacks — no user session, verified via their own signatures
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/razorpay/webhook']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public assets and unauthenticated API routes (auth + signed webhooks)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p)) ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(req)

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Admin route protection
  if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && !session.isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Redirect to onboarding if incomplete (except if already there)
  if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/api')) {
    // We check onboarding status via a custom header set after login
    const onboardingComplete = req.cookies.get('nf_onboarding')?.value === '1'
    if (!onboardingComplete && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/onboarding/1', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
