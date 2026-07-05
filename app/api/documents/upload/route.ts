import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { medicalDocuments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserPlan, FREE_LIMITS, PRO_LIMITS, upgradeRequired } from '@/lib/subscription'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

async function checkPlanLimit(userId: string, userPlan: string) {
  const maxDocs = userPlan === 'pro' ? PRO_LIMITS.medicalDocuments : FREE_LIMITS.medicalDocuments
  const existing = await db.select({ id: medicalDocuments.id })
    .from(medicalDocuments)
    .where(eq(medicalDocuments.userId, userId))
    .limit(maxDocs + 1)
  return { allowed: existing.length < maxDocs, maxDocs, count: existing.length }
}

// GET: preflight plan-limit check before client starts upload
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userPlan = await getUserPlan(session.userId)
  const { allowed } = await checkPlanLimit(session.userId, userPlan)

  if (!allowed) {
    if (userPlan === 'free') {
      return upgradeRequired('medical_documents',
        'Free plan includes 1 medical report. Upgrade to Pro to upload unlimited reports.')
    }
    return NextResponse.json({ error: 'Document limit reached.' }, { status: 400 })
  }

  return NextResponse.json({ canUpload: true })
}

// POST: handleUpload protocol — handles both token generation and upload completion
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => {
        const session = await getSession()
        if (!session) throw new Error('Unauthorized')

        const userPlan = await getUserPlan(session.userId)
        const { allowed } = await checkPlanLimit(session.userId, userPlan)
        if (!allowed) throw new Error('UPGRADE_REQUIRED')

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.userId }),
        }
      },
      onUploadCompleted: async () => {
        // Client calls /api/documents/process for extraction
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upload failed'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'UPGRADE_REQUIRED') {
      return NextResponse.json({ upgrade: true, reason: 'medical_documents',
        error: 'Free plan includes 1 medical report. Upgrade to Pro for unlimited uploads.' }, { status: 402 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
