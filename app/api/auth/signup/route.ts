import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createToken, sessionCookieOptions } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = schema.parse(body)

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [user] = await db.insert(users).values({ email, passwordHash }).returning()

    const token = await createToken({ userId: user.id, email: user.email, isAdmin: false })
    const res = NextResponse.json({ userId: user.id, onboardingComplete: false }, { status: 201 })
    res.cookies.set(sessionCookieOptions(token))
    return res
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error('[signup]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
