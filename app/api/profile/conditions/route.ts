import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalConditions, profiles } from '@/db/schema'
import { classifyRisk } from '@/lib/nutrition/engine'
import { CONDITIONS } from '@/lib/nutrition/conditions'
import { mapExtractedConditionToCode } from '@/lib/nutrition/condition-mapper'
import { eq, and } from 'drizzle-orm'

async function syncRiskLevel(userId: string) {
  const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, userId) })
  const riskLevel = classifyRisk(conditions.map(c => c.conditionCode))
  await db.update(profiles).set({ riskLevel: riskLevel as any }).where(eq(profiles.userId, userId))
  return riskLevel
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conditionCode, conditionLabel, severity } = await req.json()
  if (!conditionCode || !conditionLabel)
    return NextResponse.json({ error: 'conditionCode and conditionLabel required' }, { status: 400 })
  if (typeof conditionCode !== 'string' || conditionCode.length > 100 ||
      typeof conditionLabel !== 'string' || conditionLabel.length > 200)
    return NextResponse.json({ error: 'Invalid input length' }, { status: 400 })

  // The picker sends an already-canonical code. The "add custom condition"
  // free-text path doesn't — run it through the same keyword mapper document
  // extraction uses, so e.g. hand-typing "hypothyroidism" or "high cholesterol"
  // still lands on the canonical code the risk engine and diet restrictions
  // actually check against, instead of an unrecognized naive-slugified string.
  const isCanonical = CONDITIONS.some(c => c.code === conditionCode)
  const { code: resolvedCode, label: resolvedLabel } = isCanonical
    ? { code: conditionCode, label: conditionLabel }
    : mapExtractedConditionToCode(conditionLabel)

  const [condition] = await db.insert(medicalConditions).values({
    userId: session.userId,
    conditionCode: resolvedCode,
    conditionLabel: resolvedLabel,
    severity: severity ?? null,
    userConfirmed: true,
  }).returning()

  const riskLevel = await syncRiskLevel(session.userId)
  return NextResponse.json({ condition, riskLevel })
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
  const riskLevel = await syncRiskLevel(session.userId)
  return NextResponse.json({ success: true, riskLevel })
}
