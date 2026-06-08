import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createToken, sessionCookieOptions } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// In-memory rate limiter — 5 attempts per IP per 15 minutes.
// Note: resets on serverless cold start. Use Redis for production persistence.
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  try {
    const body = await req.json()
    const { email, password } = schema.parse(body)

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Reset rate limit on successful login
    attempts.delete(ip)

    const token = await createToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin ?? false })
    const res = NextResponse.json({ userId: user.id, onboardingComplete: user.onboardingComplete })
    res.cookies.set(sessionCookieOptions(token))
    if (user.onboardingComplete) {
      res.cookies.set({ name: 'nf_onboarding', value: '1', path: '/', maxAge: 60 * 60 * 24 * 365 })
    }
    return res
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
