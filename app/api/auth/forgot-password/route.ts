import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { sendPasswordResetEmail } from '@/lib/email'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
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
      // Token is set — user can retry. Don't expose the error.
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    console.error('[forgot-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
