import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { visionJobs, mealLogs, profiles } from '@/db/schema'
import { analyzeImage } from '@/lib/ai/vision-analyzer'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const mealType = (formData.get('mealType') as string) ?? 'LUNCH'
    const dailyLogId = formData.get('dailyLogId') as string

    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type))
      return NextResponse.json({ error: 'Invalid image type. Use JPG, PNG, or WebP.' }, { status: 400 })

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'Image too large. Maximum 10MB.' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const imageBase64 = Buffer.from(arrayBuffer).toString('base64')

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.userId),
    })

    // Create job record
    const [job] = await db.insert(visionJobs).values({
      userId: session.userId,
      imageStorageKey: `vision/${session.userId}/${Date.now()}`,
      status: 'PROCESSING',
    }).returning()

    // Create meal log stub
    const [mealLog] = await db.insert(mealLogs).values({
      dailyLogId,
      userId: session.userId,
      mealType: mealType as any,
      sourceType: 'photo',
      photoJobId: job.id,
      foodItems: [],
      userConfirmed: false,
    }).returning()

    // Process synchronously (Vercel serverless compatible)
    const start = Date.now()
    try {
      const result = await analyzeImage({
        imageBase64,
        mediaType: file.type as any,
        cuisinePreference: profile?.cuisinePreferences ?? ['Indian'],
        country: profile?.country ?? 'India',
        region: profile?.city ?? undefined,
      })

      await db.update(visionJobs).set({
        status: 'COMPLETED',
        result: result as any,
        processingTimeMs: Date.now() - start,
        modelUsed: 'gemini-flash-latest',
        completedAt: new Date(),
      }).where(eq(visionJobs.id, job.id))
    } catch (aiErr) {
      await db.update(visionJobs).set({
        status: 'FAILED',
        errorMessage: aiErr instanceof Error ? aiErr.message : 'AI analysis failed',
      }).where(eq(visionJobs.id, job.id))
    }

    return NextResponse.json({
      jobId: job.id,
      mealLogId: mealLog.id,
      status: 'COMPLETED',
      estimatedCompletionMs: 0,
    }, { status: 202 })
  } catch (err) {
    console.error('[vision/analyze]', err)
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
