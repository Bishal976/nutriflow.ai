import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const KEY = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-production')
export const COOKIE = 'nutriflow_session'

// --- Session timing ---
// Active users stay logged in indefinitely (sliding window).
// 30-day inactivity: if no request is made for 30 days, session expires.
// 90-day absolute max: even active users must re-login every 90 days.
// Cookie is re-issued at most once per hour to avoid churn on fast navigation.
export const INACTIVITY_SECONDS = 30 * 24 * 60 * 60   // 30 days
export const ABSOLUTE_MAX_SECONDS = 90 * 24 * 60 * 60  // 90 days
export const REISSUE_AFTER_SECONDS = 60 * 60            // 1 hour

export interface SessionPayload {
  userId: string
  email: string
  lastActive?: number    // unix seconds — updated on each re-issue
  sessionStart?: number  // unix seconds — fixed at session creation (for absolute max)
  iat?: number
  exp?: number
}

export async function createToken(payload: Omit<SessionPayload, 'iat' | 'exp' | 'lastActive' | 'sessionStart'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...payload, lastActive: now, sessionStart: now })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${Math.floor(ABSOLUTE_MAX_SECONDS / 86400)}d`)
    .sign(KEY)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, KEY)
    const now = Math.floor(Date.now() / 1000)
    // Backward compat: old tokens lack lastActive, use iat instead
    const lastActive = (payload.lastActive as number | undefined) ?? (payload.iat as number ?? 0)
    if (now - lastActive > INACTIVITY_SECONDS) return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function sessionCookieOptions(token: string, maxAge?: number) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAge ?? ABSOLUTE_MAX_SECONDS,
    path: '/',
  }
}

// Re-issues the token with an updated lastActive while preserving the original absolute expiry.
export async function buildRefreshedToken(session: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const absoluteExp = session.exp ?? (now + ABSOLUTE_MAX_SECONDS)
  return new SignJWT({
    userId: session.userId,
    email: session.email,
    lastActive: now,
    sessionStart: session.sessionStart ?? session.iat ?? now,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(absoluteExp * 1000))
    .sign(KEY)
}
