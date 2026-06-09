import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createToken, sessionCookieOptions } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/email'
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
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const verificationToken = randomBytes(48).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
    }).returning()

    // Send verification email — non-blocking, signup succeeds regardless
    sendVerificationEmail(email, verificationToken).catch(err =>
      console.error('[signup] Verification email error:', err)
    )

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
