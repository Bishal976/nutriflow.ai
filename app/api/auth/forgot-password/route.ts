import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/auth/rate-limit'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many reset requests. Please wait 15 minutes.' }, { status: 429 })
  }

  try {
    const { email } = schema.parse(await req.json())

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })

    // Always return 200 — never reveal whether an email is registered
    if (!user) return NextResponse.json({ ok: true })

    const token = randomBytes(48).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.update(users)
      .set({ passwordResetToken: token, passwordResetExpiry: expiry, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    try {
      await sendPasswordResetEmail(user.email, token)
    } catch (err) {
      console.error('[forgot-password] email send failed:', err)
      return NextResponse.json({ error: 'Could not send reset email. Please try again later.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    console.error('[forgot-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
