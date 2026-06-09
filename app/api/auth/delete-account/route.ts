import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users, mealLogs, visionJobs } from '@/db/schema'
import { getSession, sessionCookieOptions } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { password } = await req.json()
    if (!password) return NextResponse.json({ error: 'Password required to confirm deletion' }, { status: 400 })

    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 400 })

    // Delete tables without CASCADE first, then let CASCADE handle the rest
    await db.delete(mealLogs).where(eq(mealLogs.userId, session.userId))
    await db.delete(visionJobs).where(eq(visionJobs.userId, session.userId))
    await db.delete(users).where(eq(users.id, session.userId))

    const res = NextResponse.json({ ok: true })
    res.cookies.set({ ...sessionCookieOptions(''), maxAge: 0 })
    return res
  } catch (err) {
    console.error('[delete-account]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
