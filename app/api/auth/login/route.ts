import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createToken, sessionCookieOptions } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
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
