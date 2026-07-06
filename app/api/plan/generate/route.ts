import { NextRequest, NextResponse, after } from 'next/server'
import { createHash } from 'crypto'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { nutritionTargets, profiles, medicalConditions, dailyLogs, deviations } from '@/db/schema'
import { generateDayPlan } from '@/lib/ai/plan-generator'
import { getUserPlan, upgradeRequired } from '@/lib/subscription'
import { computeWeatherAdjustmentNote } from '@/lib/nutrition/engine'
import { eq, and, gte, desc } from 'drizzle-orm'

// Derives weatherAdjustmentNote fresh from the raw reading rather than trusting
// it was persisted — covers rows saved before the note was stored in weatherContext.
function withWeatherNote(ctx: unknown): (Record<string, unknown> & { weatherAdjustmentNote?: string }) | null {
  if (!ctx || typeof ctx !== 'object') return null
  const raw = ctx as { tempC: number; humidity: number; heatIndex?: number }
  return { ...ctx, weatherAdjustmentNote: computeWeatherAdjustmentNote(raw) }
}

// Fingerprints the inputs that actually shape a generated plan. When a user edits
// their diet, allergens, cuisine prefs, or medical conditions mid-day, this changes —
// signalling that the cached plan is stale and should be rebuilt automatically,
// rather than silently serving a plan based on their old preferences.
function computePlanInputHash(input: {
  dietType: string
  allergens: string[]
  cuisinePrefs: string[]
  dislikedIngredients: string[]
  conditionCodes: string[]
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  waterMl: number | null
  weatherNote?: string
}) {
  const normalized = JSON.stringify({
    dietType: input.dietType,
    allergens: [...input.allergens].sort(),
    cuisinePrefs: [...input.cuisinePrefs].sort(),
    dislikedIngredients: [...input.dislikedIngredients].sort(),
    conditionCodes: [...input.conditionCodes].sort(),
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    fiberG: input.fiberG,
    waterMl: input.waterMl,
    weatherNote: input.weatherNote ?? null,
  })
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const forceRegenerate = url.searchParams.get('regenerate') === '1'
  const hint = url.searchParams.get('hint') ?? undefined

  try {
    const userPlan = await getUserPlan(session.userId)
    // Custom hints are always Pro-only
    if (userPlan === 'free' && hint) {
      return upgradeRequired('plan_regeneration',
        'Custom hints are a Pro feature. Upgrade to guide your plan with specific requests.')
    }
    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, session.userId),
      orderBy: [desc(nutritionTargets.createdAt)],
    })

    if (!target) {
      return NextResponse.json({ error: 'No nutrition targets found. Complete onboarding first.' }, { status: 404 })
    }

    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
    const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })
    const conditionCodes = conditions.map(c => c.conditionCode)

    const planInput = {
      calories: target.targetCalories,
      proteinG: target.targetProteinG,
      carbsG: target.targetCarbsG,
      fatG: target.targetFatG,
      fiberG: target.targetFiberG,
      dietType: profile?.dietType ?? 'VEG',
      allergens: profile?.allergens ?? [],
      cuisinePrefs: profile?.cuisinePreferences ?? ['Indian'],
      dislikedIngredients: profile?.dislikedIngredients ?? [],
      conditionCodes,
      waterMl: target.targetWaterMl ?? 2500,
      weatherNote: withWeatherNote(target.weatherContext)?.weatherAdjustmentNote,
    }
    const currentInputHash = computePlanInputHash(planInput)

    // Check for existing daily log with cached plan
    const existingLog = await db.query.dailyLogs.findFirst({
      where: and(
        eq(dailyLogs.userId, session.userId),
        gte(dailyLogs.date, todayUTC),
      ),
      orderBy: [desc(dailyLogs.createdAt)],
    })

    // A cached plan is stale if the user changed something that shapes it
    // (diet type, allergens, conditions, macro targets, etc.) since it was generated.
    // That invalidation is automatic and free — it's a correctness fix, not a
    // user-requested regeneration, so it bypasses the Pro-only regenerate gate.
    const inputChanged = !!existingLog?.planInputHash && existingLog.planInputHash !== currentInputHash

    // Free users get 1 manual regen per day (tracked via _regenerated flag in planData)
    if (userPlan === 'free' && forceRegenerate) {
      const alreadyRegenerated = !!(existingLog?.planData as any)?._regenerated
      if (alreadyRegenerated) {
        return upgradeRequired('plan_regeneration',
          'Free plan includes 1 plan refresh per day. Upgrade to Pro for unlimited regenerations and custom hints.')
      }
    }

    if (existingLog?.planData && !forceRegenerate) {
      // Merge rebalanced meals from latest deviation so dashboard reflects post-log adjustments
      const latestDeviation = await db.query.deviations.findFirst({
        where: eq(deviations.dailyLogId, existingLog.id),
        orderBy: [desc(deviations.createdAt)],
      })

      let planData = existingLog.planData as { meals: Array<{ mealType: string; items: any[]; totalCalories: number; notes?: string }>; hydrationTip: string }

      if (latestDeviation?.rebalancedMeals) {
        const rawMeals = latestDeviation.rebalancedMeals as Array<{ meal_type: string; items: any[]; total_calories: number }>
        const byType = new Map(rawMeals.map(m => [m.meal_type, m]))
        planData = {
          ...planData,
          meals: planData.meals.map(meal => {
            const rb = byType.get(meal.mealType)
            if (!rb) return meal
            return {
              ...meal,
              items: rb.items.map((i: any) => ({
                name: i.name,
                quantity: i.quantity,
                calories: i.calories,
                proteinG: i.protein_g,
                carbsG: i.carbs_g,
                fatG: i.fat_g,
              })),
              totalCalories: rb.total_calories,
              notes: 'Adjusted after meal logging',
            }
          }),
        }
      }

      const baseResponse = {
        plan: planData,
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
        weatherContext: withWeatherNote(existingLog.weatherContext ?? target.weatherContext),
        cached: true,
      }

      // Stale-while-revalidate: inputs changed since last generation → return stale plan
      // immediately so the user sees their content, then regenerate in the background.
      if (inputChanged) {
        const regenInput = { ...planInput }
        const regenHash = currentInputHash
        const logId = existingLog.id
        const targetId = target.id
        const isFree = userPlan === 'free'

        after(async () => {
          try {
            const freshPlan = await generateDayPlan({
              calories: regenInput.calories,
              proteinG: regenInput.proteinG,
              carbsG: regenInput.carbsG,
              fatG: regenInput.fatG,
              dietType: regenInput.dietType,
              allergens: regenInput.allergens,
              cuisinePrefs: regenInput.cuisinePrefs,
              dislikedIngredients: regenInput.dislikedIngredients,
              conditions: regenInput.conditionCodes,
              waterMl: regenInput.waterMl,
              weatherNote: regenInput.weatherNote,
            })
            await db.update(dailyLogs)
              .set({ planData: freshPlan as any, planInputHash: regenHash, nutritionTargetId: targetId, updatedAt: new Date() })
              .where(eq(dailyLogs.id, logId))
          } catch (err) {
            console.error('[plan/generate] background regen failed:', err)
          }
        })

        return NextResponse.json({ ...baseResponse, stale: true })
      }

      return NextResponse.json(baseResponse)
    }

    const plan = await generateDayPlan({
      calories: planInput.calories,
      proteinG: planInput.proteinG,
      carbsG: planInput.carbsG,
      fatG: planInput.fatG,
      dietType: planInput.dietType,
      allergens: planInput.allergens,
      cuisinePrefs: planInput.cuisinePrefs,
      dislikedIngredients: planInput.dislikedIngredients,
      conditions: conditionCodes,
      waterMl: planInput.waterMl,
      weatherNote: planInput.weatherNote,
      userHint: hint,
    })

    // Mark regenerated plans from free users so we can gate the 2nd regen
    const planToStore = (userPlan === 'free' && forceRegenerate)
      ? { ...plan as object, _regenerated: true }
      : plan

    // Always branch explicitly: update existing log or create new one.
    // Never blindly insert — without a real DB unique constraint on (userId, date),
    // onConflictDoNothing never fires and every regeneration creates a duplicate
    // empty row, hiding meal logs that belong to the original daily log.
    if (existingLog) {
      await db.update(dailyLogs)
        .set({ planData: planToStore as any, planInputHash: currentInputHash, nutritionTargetId: target.id, updatedAt: new Date() })
        .where(eq(dailyLogs.id, existingLog.id))
    } else {
      await db.insert(dailyLogs).values({
        userId: session.userId,
        date: todayUTC,
        nutritionTargetId: target.id,
        planData: planToStore as any,
        planInputHash: currentInputHash,
        weatherContext: target.weatherContext as any,
      })
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
      weatherContext: withWeatherNote(target.weatherContext),
      cached: false,
    })
  } catch (err) {
    console.error('[plan/generate]', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
