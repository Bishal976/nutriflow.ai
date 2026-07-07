import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { profiles, medicalConditions, users, nutritionTargets } from '@/db/schema'
import {
  computeBMR, computeTDEE, computeMacroTargets, computeMicroTargets,
  applyWeatherAdjustment, classifyRisk
} from '@/lib/nutrition/engine'
import { fetchWeatherByCity } from '@/lib/weather/client'
import { encryptFieldNullable } from '@/lib/crypto/field-encryption'
import { eq, and, desc } from 'drizzle-orm'
import type { IntakeRequest, IntakeResponse } from '@/types/api'
import { refreshNutritionTargets } from '@/lib/nutrition/refresh-targets'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: IntakeRequest = await req.json()
  const { step, data } = body

  try {
    // Upsert profile row on every step
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.userId)
    })

    const profileBase = { userId: session.userId, updatedAt: new Date() }

    if (step === 1) {
      const d = data as import('@/types/api').DemographicsPayload
      const dob = new Date(d.dateOfBirth)
      if (existingProfile) {
        await db.update(profiles).set({ ...profileBase, firstName: d.firstName, lastName: d.lastName,
          dateOfBirth: dob, sex: d.sex, heightCm: d.heightCm, weightKg: d.weightKg, activityLevel: d.activityLevel as any
        }).where(eq(profiles.userId, session.userId))
      } else {
        await db.insert(profiles).values({ ...profileBase, firstName: d.firstName, lastName: d.lastName,
          dateOfBirth: dob, sex: d.sex, heightCm: d.heightCm, weightKg: d.weightKg, activityLevel: d.activityLevel as any
        })
      }
      // If onboarding is done, refresh targets so the plan hash changes on next dashboard load
      await refreshNutritionTargets(session.userId, {
        weightKg: d.weightKg, heightCm: d.heightCm, dateOfBirth: dob,
        sex: d.sex, activityLevel: d.activityLevel,
        primaryGoal: existingProfile?.primaryGoal ?? 'MAINTENANCE',
        secondaryGoals: existingProfile?.secondaryGoals ?? [],
        targetWeightKg: existingProfile?.targetWeightKg,
      })
    }

    if (step === 2) {
      const d = data as import('@/types/api').GoalsPayload
      await db.update(profiles).set({
        primaryGoal: d.primaryGoal as any,
        secondaryGoals: (d.secondaryGoals ?? []) as string[],
        targetWeightKg: d.targetWeightKg ?? null,
      }).where(eq(profiles.userId, session.userId))
      // Refresh targets: goal change shifts macro split (deficit/surplus/maintenance,
      // muscle-gain protein bump, target-weight-paced deficit)
      if (existingProfile?.weightKg && existingProfile?.heightCm && existingProfile?.dateOfBirth) {
        await refreshNutritionTargets(session.userId, {
          weightKg: existingProfile.weightKg,
          heightCm: existingProfile.heightCm,
          dateOfBirth: existingProfile.dateOfBirth,
          sex: existingProfile.sex ?? 'other',
          activityLevel: existingProfile.activityLevel ?? 'sedentary',
          primaryGoal: d.primaryGoal,
          secondaryGoals: d.secondaryGoals ?? [],
          targetWeightKg: d.targetWeightKg,
        })
      }
    }

    if (step === 3) {
      const d = data as import('@/types/api').MedicalContextPayload
      // Only delete user-confirmed conditions so doc-extracted ones (userConfirmed=false) are preserved
      await db.delete(medicalConditions).where(
        and(eq(medicalConditions.userId, session.userId), eq(medicalConditions.userConfirmed, true))
      )
      if (d.conditions.length > 0) {
        await db.insert(medicalConditions).values(
          d.conditions.map(c => ({
            userId: session.userId,
            conditionCode: c.conditionCode,
            conditionLabel: c.conditionLabel,
            onMedication: c.onMedication,
            severity: c.severity ?? null,
            medicationNotes: encryptFieldNullable(null),
            userConfirmed: true,
          }))
        )
      }
      const riskLevel = classifyRisk(d.conditions.map(c => c.conditionCode))
      await db.update(profiles).set({ riskLevel: riskLevel as any })
        .where(eq(profiles.userId, session.userId))
      // Refresh targets: conditions affect macro split (e.g. diabetes → lower carbs)
      if (existingProfile?.weightKg && existingProfile?.heightCm && existingProfile?.dateOfBirth) {
        await refreshNutritionTargets(session.userId, {
          weightKg: existingProfile.weightKg,
          heightCm: existingProfile.heightCm,
          dateOfBirth: existingProfile.dateOfBirth,
          sex: existingProfile.sex ?? 'other',
          activityLevel: existingProfile.activityLevel ?? 'sedentary',
          primaryGoal: existingProfile.primaryGoal ?? 'MAINTENANCE',
          secondaryGoals: existingProfile.secondaryGoals ?? [],
          targetWeightKg: existingProfile.targetWeightKg,
        })
      }
    }

    if (step === 4) {
      // Doc upload step handled separately via /api/ocr/upload
    }

    if (step === 5) {
      const d = data as import('@/types/api').DietaryPrefsPayload
      await db.update(profiles).set({
        dietType: d.dietType as any,
        allergens: d.allergens,
        cuisinePreferences: d.cuisinePreferences,
        dislikedIngredients: d.dislikedIngredients,
      }).where(eq(profiles.userId, session.userId))
    }

    if (step === 6) {
      const d = data as import('@/types/api').LocationPayload
      await db.update(profiles).set({ city: d.city, country: d.country, timezone: d.timezone, lat: d.lat, lon: d.lon })
        .where(eq(profiles.userId, session.userId))

      // Final step: compute and persist nutrition targets
      const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
      if (!profile?.heightCm || !profile?.weightKg || !profile?.dateOfBirth) {
        return NextResponse.json({ error: 'Profile incomplete' }, { status: 422 })
      }

      const ageYears = Math.floor((Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000))
      const bmr = computeBMR({ weightKg: profile.weightKg, heightCm: profile.heightCm, ageYears, sex: profile.sex as 'male' | 'female' | 'other' ?? 'other' })
      const tdee = computeTDEE(bmr, (profile.activityLevel ?? 'sedentary') as any)

      const conditions = await db.query.medicalConditions.findMany({ where: eq(medicalConditions.userId, session.userId) })
      const conditionCodes = conditions.map(c => c.conditionCode)

      const macros = computeMacroTargets(tdee, (profile.primaryGoal ?? 'MAINTENANCE') as any, conditionCodes, {
        secondaryGoals: (profile.secondaryGoals ?? []) as any,
        currentWeightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg ?? undefined,
      })
      const micros = computeMicroTargets((profile.sex ?? 'other') as any, conditionCodes)

      let weather = null
      let weatherData = null
      try {
        weatherData = await fetchWeatherByCity(d.city, d.country)
        weather = weatherData
      } catch { /* weather is optional */ }

      const targets = weather
        ? applyWeatherAdjustment({ ...macros, ...micros }, weather)
        : { ...macros, ...micros, waterMl: 2500 }

      const today = new Date(); today.setHours(0, 0, 0, 0)

      const targetData = {
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
        weatherContext: weather ? { ...weatherData } : null,
        tdeeKcal: tdee,
        bmrKcal: bmr,
      }

      // No date filter: there's one evolving target row per user (see
      // lib/nutrition/refresh-targets.ts), not a fresh row per calendar day —
      // filtering by date here duplicated rows on every edit-mode re-save
      // that happened after the day it was created.
      const existingTarget = await db.query.nutritionTargets.findFirst({
        where: eq(nutritionTargets.userId, session.userId),
        orderBy: [desc(nutritionTargets.createdAt)],
      })

      if (existingTarget) {
        await db.update(nutritionTargets).set(targetData).where(eq(nutritionTargets.id, existingTarget.id))
      } else {
        await db.insert(nutritionTargets).values({ userId: session.userId, date: today, ...targetData })
      }

      // Mark onboarding complete
      await db.update(users).set({ onboardingComplete: true }).where(eq(users.id, session.userId))

      const riskProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
      const res = NextResponse.json({
        success: true, onboardingComplete: true,
        riskLevel: riskProfile?.riskLevel ?? 'LOW',
        generatedTargets: {
          calories: targets.calories, proteinG: targets.proteinG, carbsG: targets.carbsG,
          fatG: targets.fatG, fiberG: targets.fiberG ?? 25, waterMl: targets.waterMl,
          weatherNote: (targets as any).weatherAdjustmentNote,
        },
        warnings: [],
      } as IntakeResponse)
      res.cookies.set({ name: 'nf_onboarding', value: '1', path: '/', maxAge: 60 * 60 * 24 * 365 })
      return res
    }

    return NextResponse.json({ success: true, onboardingComplete: false, nextStep: step + 1, riskLevel: 'LOW', warnings: [] } as IntakeResponse)
  } catch (err) {
    console.error('[intake]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
