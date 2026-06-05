import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { visionJobs } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import type { VisionStatusResponse, FoodItem } from '@/types/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const job = await db.query.visionJobs.findFirst({
    where: and(eq(visionJobs.id, jobId), eq(visionJobs.userId, session.userId))
  })

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const raw = job.result as any
  const result = raw ? {
    foods: (raw.foods ?? []).map((f: any): FoodItem => ({
      name: f.name,
      householdQuantity: f.household_quantity ?? f.householdQuantity,
      quantityGramsEstimate: f.quantity_grams_estimate ?? f.quantityGramsEstimate ?? 0,
      caloriesEstimate: f.calories_estimate ?? f.caloriesEstimate ?? 0,
      proteinG: f.protein_g ?? f.proteinG ?? 0,
      carbsG: f.carbs_g ?? f.carbsG ?? 0,
      fatG: f.fat_g ?? f.fatG ?? 0,
      confidence: f.confidence ?? 0.5,
      visualCues: f.visual_cues ?? f.visualCues ?? '',
    })),
    mealContext: raw.meal_context ?? raw.mealContext ?? '',
    overallConfidence: raw.overall_confidence ?? raw.overallConfidence ?? 0,
    lightingQuality: raw.lighting_quality ?? raw.lightingQuality ?? 'good',
  } : undefined

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    result,
    error: job.errorMessage ?? undefined,
  } as VisionStatusResponse)
}
