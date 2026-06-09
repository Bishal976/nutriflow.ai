import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments, medicalConditions, profiles } from '@/db/schema'
import { classifyRisk } from '@/lib/nutrition/engine'
import { extractMedicalDocument } from '@/lib/ai/document-extractor'
import { eq, and, sql } from 'drizzle-orm'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
type AllowedType = typeof ALLOWED_TYPES[number]

function isAllowedType(t: string): t is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(t)
}

const MAX_DOCS_PER_USER = 20

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Enforce per-user document limit
  const existingDocCount = await db.select({ id: medicalDocuments.id })
    .from(medicalDocuments)
    .where(eq(medicalDocuments.userId, session.userId))
    .limit(MAX_DOCS_PER_USER + 1)
  if (existingDocCount.length >= MAX_DOCS_PER_USER) {
    return NextResponse.json({ error: `Document limit reached (${MAX_DOCS_PER_USER} max). Please contact support.` }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!isAllowedType(file.type))
    return NextResponse.json({ error: 'Only PDF, JPG, PNG, or WebP allowed' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })

  // Read buffer once — used for both blob upload and base64 extraction
  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  const fileBase64 = fileBuffer.toString('base64')

  // Upload to Vercel Blob
  let blob: Awaited<ReturnType<typeof put>>
  try {
    blob = await put(`medical/${session.userId}/${Date.now()}-${file.name}`, fileBuffer, {
      access: 'private',
      contentType: file.type,
    })
  } catch (blobErr) {
    console.error('[document-upload] blob put failed:', blobErr)
    return NextResponse.json({ error: 'File storage failed. Please try again.' }, { status: 500 })
  }

  // Create pending document record
  const [doc] = await db.insert(medicalDocuments).values({
    userId: session.userId,
    storageKey: blob.url,
    documentType: 'other',
    jobStatus: 'PROCESSING',
  }).returning()

  // Extract synchronously (same pattern as vision/analyze)
  try {

    const extracted = await extractMedicalDocument({
      fileBase64,
      mimeType: file.type as AllowedType,
    })


    await db.update(medicalDocuments).set({
      documentType: extracted.documentType,
      extractedData: extracted as any,
      confidenceScore: extracted.confidence,
      jobStatus: 'COMPLETED',
    }).where(eq(medicalDocuments.id, doc.id))

    // Auto-merge extracted conditions — skip any (userId, conditionCode) that already exist
    if (extracted.conditions.length > 0) {
      const existing = await db.query.medicalConditions.findMany({
        where: eq(medicalConditions.userId, session.userId),
      })
      const existingCodes = new Set(existing.map(c => c.conditionCode))

      const toInsert = extracted.conditions
        .map(label => ({ code: label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), label }))
        .filter(({ code }) => !existingCodes.has(code))

      if (toInsert.length > 0) {
        await db.insert(medicalConditions).values(
          toInsert.map(({ code, label }) => ({
            userId: session.userId,
            conditionCode: code,
            conditionLabel: label,
            userConfirmed: false,
          }))
        )
        toInsert.forEach(({ code }) => existingCodes.add(code))
      }

      const allConditions = await db.query.medicalConditions.findMany({
        where: eq(medicalConditions.userId, session.userId),
      })
      const riskLevel = classifyRisk(allConditions.map(c => c.conditionCode))
      await db.update(profiles).set({ riskLevel: riskLevel as any }).where(eq(profiles.userId, session.userId))
    }

    // Store medication notes on conditions that have no notes yet
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

    return NextResponse.json({
      documentId: doc.id,
      blobUrl: blob.url,
      extracted,
    })
  } catch (err) {
    await db.update(medicalDocuments).set({ jobStatus: 'FAILED' }).where(eq(medicalDocuments.id, doc.id))
    console.error('[document-extractor] failed:', err)
    return NextResponse.json({
      documentId: doc.id,
      blobUrl: blob.url,
      error: 'Extraction failed — document saved but could not parse contents.',
    }, { status: 207 })
  }
}
