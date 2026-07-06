import { db } from '@/db/client'
import { nutritionTargets, medicalConditions } from '@/db/schema'
import {
  computeBMR, computeTDEE, computeMacroTargets, computeMicroTargets, applyWeatherAdjustment,
} from '@/lib/nutrition/engine'
import { eq, and, gte, desc } from 'drizzle-orm'

// Recompute macro/micro targets in-place when demographics, goals, or conditions
// change post-onboarding. Reuses existing weather context — no extra HTTP call.
export async function refreshNutritionTargets(userId: string, params: {
  weightKg: number; heightCm: number; dateOfBirth: Date
  sex: string; activityLevel: string; primaryGoal: string
  secondaryGoals?: string[]; targetWeightKg?: number | null
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const existingTarget = await db.query.nutritionTargets.findFirst({
    where: and(eq(nutritionTargets.userId, userId), gte(nutritionTargets.date, today)),
    orderBy: [desc(nutritionTargets.createdAt)],
  })
  if (!existingTarget) return

  const ageYears = Math.floor((Date.now() - params.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000))
  const bmr = computeBMR({ weightKg: params.weightKg, heightCm: params.heightCm, ageYears, sex: params.sex as 'male' | 'female' | 'other' })
  const tdee = computeTDEE(bmr, params.activityLevel as any)

  const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, userId) })
  const conditionCodes = conditions.map(c => c.conditionCode)
  const macros = computeMacroTargets(tdee, params.primaryGoal as any, conditionCodes, {
    secondaryGoals: (params.secondaryGoals ?? []) as any,
    currentWeightKg: params.weightKg,
    targetWeightKg: params.targetWeightKg ?? undefined,
  })
  const micros = computeMicroTargets(params.sex as any, conditionCodes)

  const weather = existingTarget.weatherContext as any
  const targets = weather
    ? applyWeatherAdjustment({ ...macros, ...micros }, weather)
    : { ...macros, ...micros, waterMl: 2500 }

  await db.update(nutritionTargets).set({
    targetCalories: targets.calories,
    targetProteinG: targets.proteinG,
    targetCarbsG: targets.carbsG,
    targetFatG: targets.fatG,
    targetFiberG: targets.fiberG,
    targetSodiumMg: targets.sodiumMg,
    targetPotassiumMg: targets.potassiumMg,
    targetPhosphorusMg: targets.phosphorusMg,
    targetIronMg: targets.ironMg,
    targetCalciumMg: targets.calciumMg,
    targetWaterMl: targets.waterMl,
    tdeeKcal: tdee,
    bmrKcal: bmr,
  }).where(eq(nutritionTargets.id, existingTarget.id))
}
