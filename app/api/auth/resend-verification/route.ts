import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/email'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.emailVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

  const token = randomBytes(48).toString('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db.update(users)
    .set({ emailVerificationToken: token, emailVerificationExpiry: expiry, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  await sendVerificationEmail(user.email, token)

  return NextResponse.json({ ok: true })
}
