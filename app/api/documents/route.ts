import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docs = await db.query.medicalDocuments.findMany({
    where: eq(medicalDocuments.userId, session.userId),
    orderBy: [desc(medicalDocuments.createdAt)],
  })

  return NextResponse.json({
    documents: docs.map(d => ({
      id: d.id,
      documentType: d.documentType,
      jobStatus: d.jobStatus,
      extractedData: d.extractedData,
      createdAt: d.createdAt,
    })),
  })
}
