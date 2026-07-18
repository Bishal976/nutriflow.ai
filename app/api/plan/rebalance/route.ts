import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs, mealLogs, nutritionTargets, profiles, medicalConditions, deviations } from '@/db/schema'
import { generateRebalancedPlan } from '@/lib/ai/rebalancer'
import { computeDeviationSeverity, computeRemainingBudget, computeWeatherAdjustmentNote } from '@/lib/nutrition/engine'
import { conditionToRestrictions } from '@/lib/nutrition/condition-restrictions'
import { eq, and, desc } from 'drizzle-orm'
import type { RebalanceRequest, RebalanceResponse } from '@/types/api'

const MEAL_ORDER = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER']

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: RebalanceRequest = await req.json()

  try {
    const dailyLog = await db.query.dailyLogs.findFirst({
      where: and(eq(dailyLogs.id, body.dailyLogId), eq(dailyLogs.userId, session.userId))
    })
    if (!dailyLog) return NextResponse.json({ error: 'Daily log not found' }, { status: 404 })

    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, session.userId),
      orderBy: [desc(nutritionTargets.createdAt)],
    })
    if (!target) return NextResponse.json({ error: 'No nutrition targets found. Please complete onboarding first.' }, { status: 404 })

    if (!Array.isArray(body.confirmedFoods)) {
      return NextResponse.json({ error: 'confirmedFoods must be an array' }, { status: 400 })
    }

    // Compute total consumed so far (including this meal)
    const thisCalories = body.confirmedFoods.reduce((s, f) => s + f.caloriesEstimate, 0)
    const thisProtein = body.confirmedFoods.reduce((s, f) => s + f.proteinG, 0)
    const thisCarbs = body.confirmedFoods.reduce((s, f) => s + f.carbsG, 0)
    const thisFat = body.confirmedFoods.reduce((s, f) => s + f.fatG, 0)

    const loggedMeal = await db.query.mealLogs.findFirst({ where: eq(mealLogs.id, body.mealLogId) })
    const currentMealType = loggedMeal?.mealType ?? 'LUNCH'

    // Remaining meal slots after this meal, excluding any slot that already has a
    // confirmed log today — otherwise logging an earlier meal (e.g. breakfast) after
    // a later one (e.g. lunch) redundantly re-suggests the meal already eaten, since
    // position-in-MEAL_ORDER alone doesn't reflect what's actually been logged.
    const currentIdx = MEAL_ORDER.indexOf(currentMealType)
    const confirmedLogs = await db.query.mealLogs.findMany({
      where: and(eq(mealLogs.dailyLogId, body.dailyLogId), eq(mealLogs.userConfirmed, true)),
    })
    const loggedMealTypes = new Set<string>(confirmedLogs.map(m => m.mealType))
    loggedMealTypes.add(currentMealType)
    const remainingSlots = MEAL_ORDER.slice(currentIdx + 1).filter(slot => !loggedMealTypes.has(slot))

    const consumed = {
      calories: dailyLog.actualCalories ?? 0,
      proteinG: dailyLog.actualProteinG ?? 0,
      carbsG: dailyLog.actualCarbsG ?? 0,
      fatG: dailyLog.actualFatG ?? 0,
      fiberG: dailyLog.actualFiberG ?? 0,
    }

    const thisMacros = { calories: thisCalories, proteinG: thisProtein, carbsG: thisCarbs, fatG: thisFat, fiberG: 0 }
    const targets = { calories: target.targetCalories, proteinG: target.targetProteinG, carbsG: target.targetCarbsG, fatG: target.targetFatG, fiberG: target.targetFiberG ?? 25 }

    const remaining = computeRemainingBudget(targets, consumed, thisMacros)

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
    const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })
    const conditionCodes = conditions.map(c => c.conditionCode)

    const deltaCalories = (consumed.calories + thisCalories) - target.targetCalories
    const deltaProteinG = (consumed.proteinG + thisProtein) - target.targetProteinG
    const deltaCarbsG = (consumed.carbsG + thisCarbs) - target.targetCarbsG
    const deltaFatG = (consumed.fatG + thisFat) - target.targetFatG

    // Shared: persist confirmed foods + update actuals regardless of rebalance flag
    await db.update(mealLogs).set({
      foodItems: body.confirmedFoods as any,
      estimatedCalories: Math.round(thisCalories),
      estimatedProteinG: Math.round(thisProtein * 10) / 10,
      estimatedCarbsG: Math.round(thisCarbs * 10) / 10,
      estimatedFatG: Math.round(thisFat * 10) / 10,
      userConfirmed: true,
    }).where(eq(mealLogs.id, body.mealLogId))

    await db.update(dailyLogs).set({
      actualCalories: (dailyLog.actualCalories ?? 0) + thisCalories,
      actualProteinG: (dailyLog.actualProteinG ?? 0) + thisProtein,
      actualCarbsG: (dailyLog.actualCarbsG ?? 0) + thisCarbs,
      actualFatG: (dailyLog.actualFatG ?? 0) + thisFat,
      updatedAt: new Date(),
    }).where(eq(dailyLogs.id, body.dailyLogId))

    if (body.skipRebalance || remainingSlots.length === 0) {
      await db.insert(deviations).values({
        dailyLogId: body.dailyLogId, mealLogId: body.mealLogId,
        deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG,
        rebalancedMeals: [], rebalanceExplanation: null,
      })
      return NextResponse.json({
        success: true,
        deviation: { deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG, severity: computeDeviationSeverity(deltaCalories) },
        rebalancedMeals: [],
        explanation: remainingSlots.length === 0
          ? "You've logged all meals for today. Great job staying consistent!"
          : "Meal logged. Your remaining meals are unchanged.",
        complianceNote: null,
      } as RebalanceResponse)
    }

    const result = await generateRebalancedPlan({
      remainingBudget: { calories: remaining.calories, proteinG: remaining.proteinG, carbsG: remaining.carbsG, fatG: remaining.fatG },
      allergens: profile?.allergens ?? [],
      dietType: profile?.dietType ?? 'VEG',
      cuisinePrefs: profile?.cuisinePreferences ?? ['Indian'],
      dislikedIngredients: profile?.dislikedIngredients ?? [],
      remainingMealSlots: remainingSlots,
      conditions: conditionCodes,
      conditionRestrictions: conditionToRestrictions(conditionCodes),
      weatherNote: target.weatherContext ? computeWeatherAdjustmentNote(target.weatherContext as any) : undefined,
    })

    // Hard violations (allergens, diet-type, medical conditions) survived every
    // retry inside generateRebalancedPlan — don't serve a plan we know is unsafe.
    // The meal the user just ate is already logged above regardless; only the
    // suggested remaining meals are withheld.
    if (result.hardViolations.length > 0) {
      console.error('[rebalance] Serving no rebalanced meals — hard violations persisted after retries:', result.hardViolations)
      await db.insert(deviations).values({
        dailyLogId: body.dailyLogId, mealLogId: body.mealLogId,
        deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG,
        rebalancedMeals: [], rebalanceExplanation: null,
      })
      return NextResponse.json({
        success: true,
        deviation: { deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG, severity: computeDeviationSeverity(deltaCalories) },
        rebalancedMeals: [],
        explanation: "Meal logged. We couldn't generate a safe rebalance for your remaining meals right now — your existing plan stays as is.",
        complianceNote: null,
      } as RebalanceResponse)
    }

    await db.insert(deviations).values({
      dailyLogId: body.dailyLogId, mealLogId: body.mealLogId,
      deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG,
      rebalancedMeals: result.rebalanced_meals,
      rebalanceExplanation: result.explanation,
    })

    return NextResponse.json({
      success: true,
      deviation: { deltaCalories, deltaProteinG, deltaCarbsG, deltaFatG, severity: computeDeviationSeverity(deltaCalories) },
      rebalancedMeals: result.rebalanced_meals.map(m => ({
        mealType: m.meal_type,
        items: m.items.map(i => ({ name: i.name, quantity: i.quantity, calories: i.calories, proteinG: i.protein_g, carbsG: i.carbs_g, fatG: i.fat_g })),
        totalCalories: m.total_calories,
      })),
      explanation: result.explanation,
      complianceNote: result.compliance_note,
    } as RebalanceResponse)
  } catch (err) {
    console.error('[rebalance]', err)
    return NextResponse.json({ error: 'Failed to rebalance' }, { status: 500 })
  }
}
