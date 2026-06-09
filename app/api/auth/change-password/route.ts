import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { currentPassword, newPassword } = schema.parse(await req.json())

    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    if (currentPassword === newPassword)
      return NextResponse.json({ error: 'New password must be different from your current one' }, { status: 400 })

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, session.userId))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    console.error('[change-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
