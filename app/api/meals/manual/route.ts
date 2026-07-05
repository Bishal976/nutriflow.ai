import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { mealLogs, dailyLogs, nutritionTargets, profiles, medicalConditions, deviations } from '@/db/schema'
import { getUserPlan, getDailyMealLogCount, FREE_LIMITS, upgradeRequired } from '@/lib/subscription'
import { computeRemainingBudget, computeDeviationSeverity } from '@/lib/nutrition/engine'
import { generateRebalancedPlan } from '@/lib/ai/rebalancer'
import { eq, and, gte, desc } from 'drizzle-orm'

const MEAL_ORDER = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER']

function conditionToRestrictions(codes: string[]): string[] {
  const r: string[] = []
  if (codes.some(c => c.startsWith('ckd_') || c === 'dialysis')) r.push('Restrict potassium and phosphorus — no bananas, nuts, excessive dairy')
  if (codes.some(c => c.includes('hypertension'))) r.push('Sodium < 800mg remaining in day')
  if (codes.some(c => c.includes('diabetes'))) r.push('Prefer low-GI carbohydrates, avoid refined sugars')
  return r
}

export interface ManualFoodItem {
  name: string
  quantity: string
  caloriesEstimate: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as {
      mealType: string
      dailyLogId: string
      items: ManualFoodItem[]
    }

    if (!body.dailyLogId) return NextResponse.json({ error: 'dailyLogId required' }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one food item required' }, { status: 400 })
    }

    // Enforce daily meal log limit
    const userPlan = await getUserPlan(session.userId)
    if (userPlan === 'free') {
      const count = await getDailyMealLogCount(session.userId)
      if (count >= FREE_LIMITS.dailyMealLogs) {
        return upgradeRequired('meal_log_limit',
          `Free plan allows ${FREE_LIMITS.dailyMealLogs} meal logs per day. Upgrade to Pro for unlimited logging.`)
      }
    }

    const VALID_MEAL_TYPES = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER'] as const
    type MealType = typeof VALID_MEAL_TYPES[number]
    const mealType: MealType = (VALID_MEAL_TYPES.includes(body.mealType as MealType) ? body.mealType : 'LUNCH') as MealType

    // Compute meal totals — apply rough macro split if macros not provided
    const totalCal = body.items.reduce((s, i) => s + (i.caloriesEstimate || 0), 0)
    const totalProtein = body.items.reduce((s, i) => s + (i.proteinG ?? i.caloriesEstimate * 0.075), 0)
    const totalCarbs = body.items.reduce((s, i) => s + (i.carbsG ?? i.caloriesEstimate * 0.125), 0)
    const totalFat = body.items.reduce((s, i) => s + (i.fatG ?? i.caloriesEstimate * 0.033), 0)

    // Verify dailyLog belongs to this user
    const dailyLog = await db.query.dailyLogs.findFirst({
      where: and(eq(dailyLogs.id, body.dailyLogId), eq(dailyLogs.userId, session.userId)),
    })
    if (!dailyLog) return NextResponse.json({ error: 'Daily log not found' }, { status: 404 })

    // Create the meal log
    const [mealLog] = await db.insert(mealLogs).values({
      userId: session.userId,
      dailyLogId: body.dailyLogId,
      mealType,
      sourceType: 'MANUAL',
      foodItems: body.items as any,
      estimatedCalories: Math.round(totalCal),
      estimatedProteinG: Math.round(totalProtein * 10) / 10,
      estimatedCarbsG: Math.round(totalCarbs * 10) / 10,
      estimatedFatG: Math.round(totalFat * 10) / 10,
      userConfirmed: true,
    }).returning()

    // Fetch targets for rebalance
    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, session.userId),
      orderBy: [desc(nutritionTargets.createdAt)],
    })

    // Update daily log actuals
    await db.update(dailyLogs).set({
      actualCalories: (dailyLog.actualCalories ?? 0) + totalCal,
      actualProteinG: (dailyLog.actualProteinG ?? 0) + totalProtein,
      actualCarbsG: (dailyLog.actualCarbsG ?? 0) + totalCarbs,
      actualFatG: (dailyLog.actualFatG ?? 0) + totalFat,
      updatedAt: new Date(),
    }).where(eq(dailyLogs.id, body.dailyLogId))

    if (!target) {
      return NextResponse.json({
        success: true,
        mealLogId: mealLog.id,
        totalCalories: Math.round(totalCal),
        rebalancedMeals: [],
        explanation: 'Meal logged. Complete onboarding to see your daily plan.',
        deviation: null,
      })
    }

    const currentIdx = MEAL_ORDER.indexOf(mealType)
    const remainingSlots = MEAL_ORDER.slice(currentIdx + 1)

    const consumed = {
      calories: dailyLog.actualCalories ?? 0,
      proteinG: dailyLog.actualProteinG ?? 0,
      carbsG: dailyLog.actualCarbsG ?? 0,
      fatG: dailyLog.actualFatG ?? 0,
      fiberG: dailyLog.actualFiberG ?? 0,
    }

    const thisMacros = { calories: totalCal, proteinG: totalProtein, carbsG: totalCarbs, fatG: totalFat, fiberG: 0 }
    const targets = {
      calories: target.targetCalories, proteinG: target.targetProteinG,
      carbsG: target.targetCarbsG, fatG: target.targetFatG, fiberG: target.targetFiberG ?? 25,
    }

    const deltaCalories = (consumed.calories + totalCal) - target.targetCalories

    // Persist deviation
    await db.insert(deviations).values({
      dailyLogId: body.dailyLogId,
      mealLogId: mealLog.id,
      deltaCalories,
      deltaProteinG: (consumed.proteinG + totalProtein) - target.targetProteinG,
      deltaCarbsG: (consumed.carbsG + totalCarbs) - target.targetCarbsG,
      deltaFatG: (consumed.fatG + totalFat) - target.targetFatG,
      rebalancedMeals: [],
      rebalanceExplanation: null,
    })

    if (remainingSlots.length === 0) {
      return NextResponse.json({
        success: true,
        mealLogId: mealLog.id,
        totalCalories: Math.round(totalCal),
        deviation: { deltaCalories, severity: computeDeviationSeverity(deltaCalories) },
        rebalancedMeals: [],
        explanation: "All meals logged for today. Great job staying consistent!",
      })
    }

    const remaining = computeRemainingBudget(targets, consumed, thisMacros)

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
    const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })
    const conditionCodes = conditions.map(c => c.conditionCode)

    const result = await generateRebalancedPlan({
      remainingBudget: { calories: remaining.calories, proteinG: remaining.proteinG, carbsG: remaining.carbsG, fatG: remaining.fatG },
      allergens: profile?.allergens ?? [],
      dietType: profile?.dietType ?? 'VEG',
      cuisinePrefs: profile?.cuisinePreferences ?? ['Indian'],
      remainingMealSlots: remainingSlots,
      conditions: conditionCodes,
      conditionRestrictions: conditionToRestrictions(conditionCodes),
    })

    // Update deviation with rebalance results
    await db.update(deviations)
      .set({ rebalancedMeals: result.rebalanced_meals as any, rebalanceExplanation: result.explanation })
      .where(eq(deviations.mealLogId, mealLog.id))

    return NextResponse.json({
      success: true,
      mealLogId: mealLog.id,
      totalCalories: Math.round(totalCal),
      deviation: {
        deltaCalories,
        deltaProteinG: (consumed.proteinG + totalProtein) - target.targetProteinG,
        severity: computeDeviationSeverity(deltaCalories),
      },
      rebalancedMeals: result.rebalanced_meals.map(m => ({
        mealType: m.meal_type,
        items: m.items.map(i => ({ name: i.name, quantity: i.quantity, calories: i.calories })),
        totalCalories: m.total_calories,
      })),
      explanation: result.explanation,
      complianceNote: result.compliance_note ?? null,
    })
  } catch (err) {
    console.error('[meals/manual]', err)
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 })
  }
}
