import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { nutritionTargets, profiles, medicalConditions, dailyLogs } from '@/db/schema'
import { generateDayPlan } from '@/lib/ai/plan-generator'
import { eq, and, gte, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const forceRegenerate = url.searchParams.get('regenerate') === '1'
  const hint = url.searchParams.get('hint') ?? undefined

  try {
    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, session.userId),
      orderBy: [desc(nutritionTargets.createdAt)],
    })

    if (!target) {
      return NextResponse.json({ error: 'No nutrition targets found. Complete onboarding first.' }, { status: 404 })
    }

    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)

    // Check for existing daily log with cached plan
    const existingLog = await db.query.dailyLogs.findFirst({
      where: and(
        eq(dailyLogs.userId, session.userId),
        gte(dailyLogs.date, todayUTC),
      ),
      orderBy: [desc(dailyLogs.createdAt)],
    })

    if (existingLog?.planData && !forceRegenerate) {
      return NextResponse.json({
        plan: existingLog.planData,
        target: {
          targetCalories: target.targetCalories,
          targetProteinG: target.targetProteinG,
          targetCarbsG: target.targetCarbsG,
          targetFatG: target.targetFatG,
          targetFiberG: target.targetFiberG,
          targetWaterMl: target.targetWaterMl,
        },
        actuals: {
          calories: existingLog.actualCalories ?? 0,
          proteinG: existingLog.actualProteinG ?? 0,
          carbsG: existingLog.actualCarbsG ?? 0,
          fatG: existingLog.actualFatG ?? 0,
        },
        waterMl: existingLog.waterMl ?? 0,
        planGeneratedAt: existingLog.updatedAt,
        dailyLogId: existingLog.id,
        weatherContext: existingLog.weatherContext ?? target.weatherContext,
        cached: true,
      })
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
      userHint: hint,
    })

    // Upsert daily log with cached plan
    await db.insert(dailyLogs).values({
      userId: session.userId,
      date: todayUTC,
      nutritionTargetId: target.id,
      planData: plan as any,
      weatherContext: target.weatherContext as any,
    }).onConflictDoNothing()

    // If conflict (log already exists), update it with new plan
    if (existingLog) {
      await db.update(dailyLogs)
        .set({ planData: plan as any, updatedAt: new Date() })
        .where(eq(dailyLogs.id, existingLog.id))
    }

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
      actuals: {
        calories: dailyLog?.actualCalories ?? 0,
        proteinG: dailyLog?.actualProteinG ?? 0,
        carbsG: dailyLog?.actualCarbsG ?? 0,
        fatG: dailyLog?.actualFatG ?? 0,
      },
      waterMl: dailyLog?.waterMl ?? 0,
      planGeneratedAt: dailyLog?.updatedAt ?? new Date(),
      dailyLogId: dailyLog?.id,
      weatherContext: target.weatherContext,
      cached: false,
    })
  } catch (err) {
    console.error('[plan/generate]', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
