import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalConditions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conditionCode, conditionLabel, severity } = await req.json()
  if (!conditionCode || !conditionLabel)
    return NextResponse.json({ error: 'conditionCode and conditionLabel required' }, { status: 400 })

  const [condition] = await db.insert(medicalConditions).values({
    userId: session.userId,
    conditionCode,
    conditionLabel,
    severity: severity ?? null,
    userConfirmed: true,
  }).returning()

  return NextResponse.json({ condition })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conditionId } = await req.json()
  if (!conditionId)
    return NextResponse.json({ error: 'conditionId required' }, { status: 400 })

  await db.delete(medicalConditions).where(
    and(eq(medicalConditions.id, conditionId), eq(medicalConditions.userId, session.userId))
  )
  return NextResponse.json({ success: true })
}
