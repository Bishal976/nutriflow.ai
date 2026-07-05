import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, buildRefreshedToken, sessionCookieOptions, COOKIE, REISSUE_AFTER_SECONDS, ABSOLUTE_MAX_SECONDS } from '@/lib/auth/session'

const PUBLIC_PATHS = [
  '/', '/login', '/signup',
  '/forgot-password', '/reset-password',
  '/verify-email',
  '/terms', '/privacy',
]
const ADMIN_PATHS = ['/admin']
// Server-to-server callbacks — no user session, verified via their own signatures
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/razorpay/webhook']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip static assets and public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p)) ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE)?.value

  // No cookie at all — not authenticated
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const session = await getSessionFromRequest(req)

  // Token present but invalid (bad signature, hard-expired, or inactivity exceeded)
  if (!session) {
    const clearCookie = { name: COOKIE, value: '', maxAge: 0, path: '/' }
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Session expired', sessionExpired: true }, { status: 401 })
      res.cookies.set(clearCookie)
      return res
    }
    const res = NextResponse.redirect(new URL('/login?reason=session_expired', req.url))
    res.cookies.set(clearCookie)
    return res
  }

  // Admin route protection
  if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && !session.isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Onboarding redirect (page routes only)
  if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/api')) {
    const onboardingComplete = req.cookies.get('nf_onboarding')?.value === '1'
    if (!onboardingComplete && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/onboarding/1', req.url))
    }
  }

  const res = NextResponse.next()

  // Sliding window: re-issue cookie with updated lastActive at most once per hour
  const now = Math.floor(Date.now() / 1000)
  const lastActive = session.lastActive ?? session.iat ?? 0
  if (now - lastActive > REISSUE_AFTER_SECONDS) {
    try {
      const newToken = await buildRefreshedToken(session)
      const absoluteExp = session.exp ?? (now + ABSOLUTE_MAX_SECONDS)
      res.cookies.set(sessionCookieOptions(newToken, absoluteExp - now))
    } catch {
      // Silent — original token remains valid, no refresh this request
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
