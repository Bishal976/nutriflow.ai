import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = schema.parse(await req.json())

    const user = await db.query.users.findFirst({ where: eq(users.passwordResetToken, token) })

    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return NextResponse.json({ error: 'Reset link is invalid or has expired. Please request a new one.' }, { status: 400 })
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.update(users).set({
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    console.error('[reset-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
