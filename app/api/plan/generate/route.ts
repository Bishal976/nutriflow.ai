import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { nutritionTargets, profiles, medicalConditions, dailyLogs } from '@/db/schema'
import { generateDayPlan } from '@/lib/ai/plan-generator'
import { eq, and, gte, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Use most recent target — avoids UTC/local timezone mismatch on date queries
    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, session.userId),
      orderBy: [desc(nutritionTargets.createdAt)],
    })

    if (!target) {
      return NextResponse.json({ error: 'No nutrition targets found. Complete onboarding first.' }, { status: 404 })
    }

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
    const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })
    const conditionCodes = conditions.map(c => c.conditionCode)

    const plan = await generateDayPlan({
      calories: target.targetCalories,
      proteinG: target.targetProteinG,
      carbsG: target.targetCarbsG,
      fatG: target.targetFatG,
      dietType: profile?.dietType ?? 'VEG',
      allergens: profile?.allergens ?? [],
      cuisinePrefs: profile?.cuisinePreferences ?? ['Indian'],
      dislikedIngredients: profile?.dislikedIngredients ?? [],
      conditions: conditionCodes,
      waterMl: target.targetWaterMl ?? 2500,
      weatherNote: (target.weatherContext as any)?.weatherAdjustmentNote,
    })

    // Use UTC date for daily log to stay consistent
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)

    await db.insert(dailyLogs).values({
      userId: session.userId,
      date: todayUTC,
      nutritionTargetId: target.id,
    }).onConflictDoNothing()

    const dailyLog = await db.query.dailyLogs.findFirst({
      where: and(
        eq(dailyLogs.userId, session.userId),
        gte(dailyLogs.date, todayUTC),
      ),
      orderBy: [desc(dailyLogs.createdAt)],
    })

    return NextResponse.json({
      plan,
      target: {
        targetCalories: target.targetCalories,
        targetProteinG: target.targetProteinG,
        targetCarbsG: target.targetCarbsG,
        targetFatG: target.targetFatG,
        targetFiberG: target.targetFiberG,
        targetWaterMl: target.targetWaterMl,
      },
      dailyLogId: dailyLog?.id,
      weatherContext: target.weatherContext,
    })
  } catch (err) {
    console.error('[plan/generate]', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
