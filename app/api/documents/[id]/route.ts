import { NextRequest, NextResponse } from 'next/server'
import { del, get } from '@vercel/blob'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments, medicalConditions, documentConditions, profiles } from '@/db/schema'
import { classifyRisk } from '@/lib/nutrition/engine'
import { eq, and } from 'drizzle-orm'
import { refreshNutritionTargets } from '@/lib/nutrition/refresh-targets'

// GET: stream blob content to the authenticated owner (never exposes raw blob URL)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const doc = await db.query.medicalDocuments.findFirst({
    where: and(eq(medicalDocuments.id, id), eq(medicalDocuments.userId, session.userId)),
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const blobResult = await get(doc.storageKey, { access: 'private' })
  if (!blobResult || blobResult.statusCode !== 200) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  }

  const contentType = blobResult.blob.contentType ?? 'application/octet-stream'
  return new NextResponse(blobResult.stream as any, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="document-${id}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const doc = await db.query.medicalDocuments.findFirst({
    where: and(eq(medicalDocuments.id, id), eq(medicalDocuments.userId, session.userId)),
  })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Capture what this document uniquely supports before it (and its
  // document_conditions rows, via ON DELETE CASCADE) are gone.
  const attributed = await db.query.documentConditions.findMany({
    where: eq(documentConditions.documentId, id),
  })
  const attributedCodes = attributed.map(r => r.conditionCode)

  // Delete from Vercel Blob
  try {
    await del(doc.storageKey)
  } catch {
    // Non-fatal: blob might already be gone; continue cleaning DB
  }

  // Delete the document record
  await db.delete(medicalDocuments).where(eq(medicalDocuments.id, id))

  let conditionsChanged = false

  // Precise cleanup: for each condition this document supported, remove it
  // only if no other remaining document still backs it, and only if it's
  // still unconfirmed — a user who separately confirmed a condition (via
  // onboarding or the profile page) owns that data regardless of what
  // happens to the document it originally came from.
  for (const code of attributedCodes) {
    const stillBacked = await db.query.documentConditions.findFirst({
      where: and(eq(documentConditions.userId, session.userId), eq(documentConditions.conditionCode, code)),
    })
    if (stillBacked) continue

    const deleted = await db.delete(medicalConditions).where(and(
      eq(medicalConditions.userId, session.userId),
      eq(medicalConditions.conditionCode, code),
      eq(medicalConditions.userConfirmed, false),
    )).returning({ id: medicalConditions.id })
    if (deleted.length > 0) conditionsChanged = true
  }

  // Safety net for conditions with no recorded attribution (documents
  // processed before this feature existed and not yet backfilled) — only
  // fires once every document is gone, same as the original behavior.
  const remainingDocs = await db.query.medicalDocuments.findMany({
    where: eq(medicalDocuments.userId, session.userId),
  })
  if (remainingDocs.length === 0) {
    const swept = await db.delete(medicalConditions).where(
      and(eq(medicalConditions.userId, session.userId), eq(medicalConditions.userConfirmed, false))
    ).returning({ id: medicalConditions.id })
    if (swept.length > 0) conditionsChanged = true
  }

  // Recompute riskLevel from remaining conditions
  const remaining = await db.query.medicalConditions.findMany({
    where: eq(medicalConditions.userId, session.userId),
  })
  const riskLevel = classifyRisk(remaining.map(c => c.conditionCode))
  await db.update(profiles).set({ riskLevel: riskLevel as any }).where(eq(profiles.userId, session.userId))

  // Removed conditions shift macro targets back (e.g. dropping a CKD diagnosis lifts the protein cap)
  if (conditionsChanged) {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
    if (profile?.weightKg && profile?.heightCm && profile?.dateOfBirth) {
      await refreshNutritionTargets(session.userId, {
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        dateOfBirth: profile.dateOfBirth,
        sex: profile.sex ?? 'other',
        activityLevel: profile.activityLevel ?? 'sedentary',
        primaryGoal: profile.primaryGoal ?? 'MAINTENANCE',
        secondaryGoals: profile.secondaryGoals ?? [],
        targetWeightKg: profile.targetWeightKg,
      })
    }
  }

  return NextResponse.json({ success: true, riskLevel })
}
