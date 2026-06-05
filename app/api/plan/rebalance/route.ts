import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs, mealLogs, nutritionTargets, profiles, medicalConditions, deviations } from '@/db/schema'
import { generateRebalancedPlan } from '@/lib/ai/rebalancer'
import { computeDeviationSeverity, computeRemainingBudget } from '@/lib/nutrition/engine'
import { eq, and, gte, lte } from 'drizzle-orm'
import type { RebalanceRequest, RebalanceResponse } from '@/types/api'

const MEAL_ORDER = ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER']

function conditionToRestrictions(codes: string[]): string[] {
  const r: string[] = []
  if (codes.some(c => c.startsWith('ckd_') || c === 'dialysis')) r.push('Restrict potassium and phosphorus — no bananas, nuts, excessive dairy')
  if (codes.some(c => c.includes('hypertension'))) r.push('Sodium < 800mg remaining in day')
  if (codes.some(c => c.includes('diabetes'))) r.push('Prefer low-GI carbohydrates, avoid refined sugars')
  return r
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: RebalanceRequest = await req.json()

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const dailyLog = await db.query.dailyLogs.findFirst({
      where: and(eq(dailyLogs.id, body.dailyLogId), eq(dailyLogs.userId, session.userId))
    })
    if (!dailyLog) return NextResponse.json({ error: 'Daily log not found' }, { status: 404 })

    const target = await db.query.nutritionTargets.findFirst({
      where: and(eq(nutritionTargets.userId, session.userId), gte(nutritionTargets.date, today), lte(nutritionTargets.date, tomorrow))
    })
    if (!target) return NextResponse.json({ error: 'No targets found' }, { status: 404 })

    // Compute total consumed so far (including this meal)
    const thisCalories = body.confirmedFoods.reduce((s, f) => s + f.caloriesEstimate, 0)
    const thisProtein = body.confirmedFoods.reduce((s, f) => s + f.proteinG, 0)
    const thisCarbs = body.confirmedFoods.reduce((s, f) => s + f.carbsG, 0)
    const thisFat = body.confirmedFoods.reduce((s, f) => s + f.fatG, 0)

    const loggedMeal = await db.query.mealLogs.findFirst({ where: eq(mealLogs.id, body.mealLogId) })
    const currentMealType = loggedMeal?.mealType ?? 'LUNCH'

    // Remaining meal slots after this meal
    const currentIdx = MEAL_ORDER.indexOf(currentMealType)
    const remainingSlots = MEAL_ORDER.slice(currentIdx + 1)

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

    if (remainingSlots.length === 0) {
      const delta = thisCalories + (consumed.calories) - target.targetCalories
      return NextResponse.json({
        success: true,
        deviation: { deltaCalories: delta, deltaProteinG: 0, deltaCarbsG: 0, deltaFatG: 0, severity: computeDeviationSeverity(delta) },
        rebalancedMeals: [],
        explanation: "You've logged all meals for today. Great job staying consistent!",
        complianceNote: null,
      } as RebalanceResponse)
    }

    const result = await generateRebalancedPlan({
      remainingBudget: { calories: remaining.calories, proteinG: remaining.proteinG, carbsG: remaining.carbsG, fatG: remaining.fatG },
      allergens: profile?.allergens ?? [],
      dietType: profile?.dietType ?? 'VEG',
      cuisinePrefs: profile?.cuisinePreferences ?? ['Indian'],
      remainingMealSlots: remainingSlots,
      conditions: conditionCodes,
      conditionRestrictions: conditionToRestrictions(conditionCodes),
    })

    // Persist deviation record
    const deltaCalories = (consumed.calories + thisCalories) - target.targetCalories
    await db.insert(deviations).values({
      dailyLogId: body.dailyLogId,
      mealLogId: body.mealLogId,
      deltaCalories,
      deltaProteinG: (consumed.proteinG + thisProtein) - target.targetProteinG,
      deltaCarbsG: (consumed.carbsG + thisCarbs) - target.targetCarbsG,
      deltaFatG: (consumed.fatG + thisFat) - target.targetFatG,
      rebalancedMeals: result.rebalanced_meals,
      rebalanceExplanation: result.explanation,
    })

    // Update daily log actuals
    await db.update(dailyLogs).set({
      actualCalories: (dailyLog.actualCalories ?? 0) + thisCalories,
      actualProteinG: (dailyLog.actualProteinG ?? 0) + thisProtein,
      actualCarbsG: (dailyLog.actualCarbsG ?? 0) + thisCarbs,
      actualFatG: (dailyLog.actualFatG ?? 0) + thisFat,
      updatedAt: new Date(),
    }).where(eq(dailyLogs.id, body.dailyLogId))

    return NextResponse.json({
      success: true,
      deviation: {
        deltaCalories,
        deltaProteinG: (consumed.proteinG + thisProtein) - target.targetProteinG,
        deltaCarbsG: (consumed.carbsG + thisCarbs) - target.targetCarbsG,
        deltaFatG: (consumed.fatG + thisFat) - target.targetFatG,
        severity: computeDeviationSeverity(deltaCalories),
      },
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
