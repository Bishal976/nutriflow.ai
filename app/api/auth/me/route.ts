import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { profiles, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })

  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    onboardingComplete: user?.onboardingComplete ?? false,
    plan: user?.plan ?? 'free',
    planExpiresAt: user?.planExpiresAt ?? null,
    profile: profile ? {
      firstName: profile.firstName,
      lastName: profile.lastName,
      riskLevel: profile.riskLevel,
      dietType: profile.dietType,
    } : null,
  })
}
