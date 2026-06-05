import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { profiles, medicalConditions, users, nutritionTargets, clinicianReviews } from '@/db/schema'
import {
  computeBMR, computeTDEE, computeMacroTargets, computeMicroTargets,
  applyWeatherAdjustment, classifyRisk, requiresClinicianReview
} from '@/lib/nutrition/engine'
import { fetchWeatherByCity } from '@/lib/weather/client'
import { encryptFieldNullable } from '@/lib/crypto/field-encryption'
import { eq } from 'drizzle-orm'
import type { IntakeRequest, IntakeResponse } from '@/types/api'

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
    }

    if (step === 2) {
      const d = data as import('@/types/api').GoalsPayload
      await db.update(profiles).set({ primaryGoal: d.primaryGoal as any, targetWeightKg: d.targetWeightKg ?? null })
        .where(eq(profiles.userId, session.userId))
    }

    if (step === 3) {
      const d = data as import('@/types/api').MedicalContextPayload
      // Delete old conditions then re-insert
      await db.delete(medicalConditions).where(eq(medicalConditions.userId, session.userId))
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
      const needsClinician = requiresClinicianReview(riskLevel)
      await db.update(profiles).set({ riskLevel: riskLevel as any, clinicianReviewRequired: needsClinician })
        .where(eq(profiles.userId, session.userId))

      if (needsClinician) {
        await db.insert(clinicianReviews).values({
          userId: session.userId,
          triggerReason: `Risk level ${riskLevel}: ${d.conditions.map(c => c.conditionLabel).join(', ')}`,
          triggerConditionCodes: d.conditions.map(c => c.conditionCode),
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

      const macros = computeMacroTargets(tdee, (profile.primaryGoal ?? 'MAINTENANCE') as any, conditionCodes)
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
      await db.insert(nutritionTargets).values({
        userId: session.userId,
        date: today,
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
      }).onConflictDoNothing()

      // Mark onboarding complete
      await db.update(users).set({ onboardingComplete: true }).where(eq(users.id, session.userId))

      const riskProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })
      const res = NextResponse.json({
        success: true, onboardingComplete: true,
        riskLevel: riskProfile?.riskLevel ?? 'LOW',
        clinicianReviewRequired: riskProfile?.clinicianReviewRequired ?? false,
        generatedTargets: {
          calories: targets.calories, proteinG: targets.proteinG, carbsG: targets.carbsG,
          fatG: targets.fatG, fiberG: targets.fiberG ?? 25, waterMl: targets.waterMl,
          weatherNote: (targets as any).weatherAdjustmentNote,
        },
        warnings: riskProfile?.clinicianReviewRequired
          ? ['Your plan is being reviewed by a qualified professional.'] : [],
      } as IntakeResponse)
      res.cookies.set({ name: 'nf_onboarding', value: '1', path: '/', maxAge: 60 * 60 * 24 * 365 })
      return res
    }

    return NextResponse.json({ success: true, onboardingComplete: false, nextStep: step + 1, riskLevel: 'LOW', clinicianReviewRequired: false, warnings: [] } as IntakeResponse)
  } catch (err) {
    console.error('[intake]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
