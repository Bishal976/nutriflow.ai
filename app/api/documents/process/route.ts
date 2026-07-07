import { NextRequest, NextResponse } from 'next/server'
import { get, del } from '@vercel/blob'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments, medicalConditions, documentConditions, profiles } from '@/db/schema'
import { classifyRisk } from '@/lib/nutrition/engine'
import { extractMedicalDocument } from '@/lib/ai/document-extractor'
import { eq, and } from 'drizzle-orm'
import { getUserPlan, FREE_LIMITS, PRO_LIMITS, upgradeRequired } from '@/lib/subscription'
import { refreshNutritionTargets } from '@/lib/nutrition/refresh-targets'
import { mapExtractedConditionToCode } from '@/lib/nutrition/condition-mapper'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
type AllowedType = typeof ALLOWED_TYPES[number]

// SSRF guard: only allow URLs from Vercel Blob storage
function isVercelBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { blobUrl, fileType, fileName } = await req.json() as {
    blobUrl: string
    fileType: string
    fileName?: string
  }

  if (!blobUrl) return NextResponse.json({ error: 'blobUrl required' }, { status: 400 })
  if (!isVercelBlobUrl(blobUrl)) return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(fileType as AllowedType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  // Plan limit: re-check in case of race (two simultaneous uploads)
  const userPlan = await getUserPlan(session.userId)
  const maxDocs = userPlan === 'pro' ? PRO_LIMITS.medicalDocuments : FREE_LIMITS.medicalDocuments
  const existingCount = await db.select({ id: medicalDocuments.id })
    .from(medicalDocuments).where(eq(medicalDocuments.userId, session.userId)).limit(maxDocs + 1)

  if (existingCount.length >= maxDocs) {
    // Clean up the orphaned blob since we can't store it
    await del(blobUrl).catch(() => {})
    if (userPlan === 'free') {
      return upgradeRequired('medical_documents',
        'Free plan includes 1 medical report. Upgrade to Pro for unlimited uploads.')
    }
    return NextResponse.json({ error: `Document limit reached (${maxDocs} max).` }, { status: 400 })
  }

  // Download blob content for Gemini extraction
  let fileBase64: string
  try {
    const blobResult = await get(blobUrl, { access: 'private' })
    if (!blobResult || blobResult.statusCode !== 200) {
      return NextResponse.json({ error: 'Could not retrieve uploaded file.' }, { status: 500 })
    }
    const chunks: Uint8Array[] = []
    const reader = blobResult.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)))
    fileBase64 = buffer.toString('base64')
  } catch (err) {
    console.error('[documents/process] blob download failed:', err)
    return NextResponse.json({ error: 'Failed to read uploaded file.' }, { status: 500 })
  }

  // Create pending document record
  const [doc] = await db.insert(medicalDocuments).values({
    userId: session.userId,
    storageKey: blobUrl,
    documentType: 'other',
    jobStatus: 'PROCESSING',
  }).returning()

  // Run Gemini extraction
  try {
    const extracted = await extractMedicalDocument({
      fileBase64,
      mimeType: fileType as AllowedType,
    })

    await db.update(medicalDocuments).set({
      documentType: extracted.documentType,
      extractedData: extracted as any,
      confidenceScore: extracted.confidence,
      jobStatus: 'COMPLETED',
    }).where(eq(medicalDocuments.id, doc.id))

    // Auto-merge extracted conditions. Dedupe by code first — Gemini can
    // mention the same condition twice within one report.
    if (extracted.conditions.length > 0) {
      const mapped = new Map(extracted.conditions.map(label => {
        const m = mapExtractedConditionToCode(label)
        return [m.code, m] as const
      }))

      // Record which condition(s) this specific document supports — independent
      // of whether the medicalConditions row below is new or already existed —
      // so deleting this document later can tell whether a condition is still
      // backed by another remaining document before removing it.
      await db.insert(documentConditions).values(
        [...mapped.keys()].map(code => ({ documentId: doc.id, userId: session.userId, conditionCode: code }))
      ).onConflictDoNothing()

      // Insert only genuinely new conditions. The unique constraint on
      // (userId, conditionCode) means this can never create a duplicate row,
      // and never downgrades an already-confirmed condition back to unconfirmed.
      const inserted = await db.insert(medicalConditions).values(
        [...mapped.values()].map(({ code, label }) => ({
          userId: session.userId,
          conditionCode: code,
          conditionLabel: label,
          userConfirmed: false,
        }))
      ).onConflictDoNothing({ target: [medicalConditions.userId, medicalConditions.conditionCode] }).returning()

      const allConditions = await db.query.medicalConditions.findMany({
        where: eq(medicalConditions.userId, session.userId),
      })
      const riskLevel = classifyRisk(allConditions.map(c => c.conditionCode))
      await db.update(profiles).set({ riskLevel: riskLevel as any }).where(eq(profiles.userId, session.userId))

      // New conditions extracted from the doc shift macro targets (e.g. CKD → protein cap)
      if (inserted.length > 0) {
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
    }

    if (extracted.medications.length > 0) {
      const medNotes = extracted.medications
        .map(m => [m.name, m.dose, m.frequency].filter(Boolean).join(' '))
        .join(', ')
      await db.update(medicalConditions)
        .set({ medicationNotes: medNotes, onMedication: true })
        .where(and(
          eq(medicalConditions.userId, session.userId),
          eq(medicalConditions.onMedication, false),
        ))
    }

    return NextResponse.json({ documentId: doc.id, blobUrl, extracted })
  } catch (err) {
    await db.update(medicalDocuments).set({ jobStatus: 'FAILED' }).where(eq(medicalDocuments.id, doc.id))
    console.error('[documents/process] extraction failed:', err)
    return NextResponse.json({
      documentId: doc.id,
      blobUrl,
      error: 'Extraction failed — document saved but could not parse contents.',
    }, { status: 207 })
  }
}
