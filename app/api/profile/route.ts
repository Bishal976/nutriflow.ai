import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { profiles, medicalConditions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, conditions] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) }),
    db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) }),
  ])
  return NextResponse.json({ profile, email: session.email, conditions })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['firstName', 'lastName', 'dietType', 'allergens', 'cuisinePreferences', 'dislikedIngredients', 'city', 'country']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

  updates.updatedAt = new Date()
  await db.update(profiles).set(updates).where(eq(profiles.userId, session.userId))
  return NextResponse.json({ success: true })
}
