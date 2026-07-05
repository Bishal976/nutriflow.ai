import { NextRequest, NextResponse } from 'next/server'
import { del, get } from '@vercel/blob'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments, medicalConditions, profiles } from '@/db/schema'
import { classifyRisk } from '@/lib/nutrition/engine'
import { eq, and } from 'drizzle-orm'

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

  // Delete from Vercel Blob
  try {
    await del(doc.storageKey)
  } catch {
    // Non-fatal: blob might already be gone; continue cleaning DB
  }

  // Delete the document record
  await db.delete(medicalDocuments).where(eq(medicalDocuments.id, id))

  // Check if user has any remaining documents
  const remainingDocs = await db.query.medicalDocuments.findMany({
    where: eq(medicalDocuments.userId, session.userId),
  })

  // If no docs remain, delete all unconfirmed (doc-extracted) conditions
  // If docs remain, preserve them (we can't tell which conditions came from which doc)
  if (remainingDocs.length === 0) {
    await db.delete(medicalConditions).where(
      and(eq(medicalConditions.userId, session.userId), eq(medicalConditions.userConfirmed, false))
    )
  }

  // Recompute riskLevel from remaining conditions
  const remaining = await db.query.medicalConditions.findMany({
    where: eq(medicalConditions.userId, session.userId),
  })
  const riskLevel = classifyRisk(remaining.map(c => c.conditionCode))
  await db.update(profiles).set({ riskLevel: riskLevel as any }).where(eq(profiles.userId, session.userId))

  return NextResponse.json({ success: true, riskLevel })
}
