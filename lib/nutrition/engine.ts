// Deterministic nutrition engine — pure functions, zero LLM dependency.
// All safety-critical calculations live here. Never call AI from this module.

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'
export type Goal = 'WEIGHT_LOSS' | 'WEIGHT_GAIN' | 'MAINTENANCE' | 'MUSCLE_GAIN' | 'CONDITION_MANAGEMENT'
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type MedicalConditionCode = string

export interface BiometricParams {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: 'male' | 'female' | 'other'
}

export interface MacroTargets {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export interface MicroTargets {
  sodiumMg: number
  potassiumMg: number
  phosphorusMg: number
  ironMg: number
  calciumMg: number
}

export interface WeatherContext {
  tempC: number
  humidity: number
  heatIndex?: number
}

export interface DailyTargets extends MacroTargets, MicroTargets {
  waterMl: number
  weatherAdjustmentNote?: string
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

// Mifflin-St Jeor
export function computeBMR(params: BiometricParams): number {
  const { weightKg, heightCm, ageYears, sex } = params
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function computeTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

const CRITICAL_CONDITIONS = new Set([
  'ckd_stage4', 'ckd_stage5', 'dialysis', 'eating_disorder', 'anorexia', 'bulimia',
])
const HIGH_RISK_CONDITIONS = new Set([
  'ckd_stage3', 'type1_diabetes', 'pregnancy', 'severe_allergy_anaphylaxis',
  'liver_cirrhosis', 'heart_failure',
])
const MODERATE_CONDITIONS = new Set([
  'type2_diabetes_medicated', 'hypertension_medicated', 'hypothyroid',
  'pcos', 'ibs_severe', 'celiac',
])

export function classifyRisk(conditions: MedicalConditionCode[]): RiskLevel {
  if (conditions.some(c => CRITICAL_CONDITIONS.has(c))) return 'CRITICAL'
  if (conditions.some(c => HIGH_RISK_CONDITIONS.has(c))) return 'HIGH'
  if (conditions.some(c => MODERATE_CONDITIONS.has(c))) return 'MODERATE'
  return 'LOW'
}

export function requiresClinicianReview(riskLevel: RiskLevel): boolean {
  return riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
}

export function computeMacroTargets(
  tdee: number,
  goal: Goal,
  conditions: MedicalConditionCode[]
): MacroTargets {
  let calories = tdee

  if (goal === 'WEIGHT_LOSS') {
    calories = Math.max(tdee - 500, conditions.includes('pregnancy') ? tdee : 1200)
  } else if (goal === 'WEIGHT_GAIN' || goal === 'MUSCLE_GAIN') {
    calories = tdee + 300
  }

  // CKD: protein restriction — immutable code, not LLM
  const hasCKD = conditions.some(c => c.startsWith('ckd_') || c === 'dialysis')
  if (hasCKD) {
    const proteinG = conditions.includes('dialysis')
      ? Math.round((calories * 0.18) / 4)  // dialysis: higher protein 1.2-1.4g/kg
      : Math.min(50, Math.round((calories * 0.08) / 4))  // CKD non-dialysis: restrict
    const carbsG = Math.round((calories * 0.55) / 4)
    const fatG = Math.round((calories - proteinG * 4 - carbsG * 4) / 9)
    return { calories, proteinG, carbsG, fatG, fiberG: 20 }
  }

  // Standard macro split
  const proteinG = Math.round((calories * 0.3) / 4)
  const carbsG = Math.round((calories * 0.4) / 4)
  const fatG = Math.round((calories * 0.3) / 9)
  const fiberG = Math.round(calories / 100) // ~14g per 1000 kcal

  return { calories, proteinG, carbsG, fatG, fiberG }
}

export function computeMicroTargets(
  sex: 'male' | 'female' | 'other',
  conditions: MedicalConditionCode[]
): MicroTargets {
  const hasHypertension = conditions.some(c => c.includes('hypertension'))
  const hasCKD = conditions.some(c => c.startsWith('ckd_') || c === 'dialysis')
  const isPregnant = conditions.includes('pregnancy')

  return {
    // Sodium: restrict for hypertension/CKD, standard otherwise
    sodiumMg: hasHypertension || hasCKD ? 1500 : 2300,
    // Potassium: restrict for CKD (hyperkalemia risk)
    potassiumMg: hasCKD ? 2000 : 4700,
    // Phosphorus: restrict for CKD
    phosphorusMg: hasCKD ? 800 : 1250,
    // Iron: bump for pregnancy
    ironMg: isPregnant ? 27 : sex === 'female' ? 18 : 8,
    // Calcium: bump for pregnancy
    calciumMg: isPregnant ? 1300 : 1000,
  }
}

export function applyWeatherAdjustment(
  targets: MacroTargets & MicroTargets,
  weather: WeatherContext
): DailyTargets {
  const effectiveTemp = weather.heatIndex ?? weather.tempC
  let waterMl = 2500
  let calorieAdjust = 0
  let weatherAdjustmentNote: string | undefined

  if (effectiveTemp >= 38 || (weather.tempC >= 35 && weather.humidity > 60)) {
    waterMl = 3500
    calorieAdjust = -100
    weatherAdjustmentNote = `Hot & humid conditions (${weather.tempC}°C). Hydration target increased. Lighter meals recommended.`
  } else if (effectiveTemp >= 32) {
    waterMl = 3000
    calorieAdjust = -50
    weatherAdjustmentNote = `Warm conditions (${weather.tempC}°C). Slight calorie reduction and higher hydration.`
  } else if (weather.tempC <= 10) {
    waterMl = 2000
    calorieAdjust = +150
    weatherAdjustmentNote = `Cold conditions (${weather.tempC}°C). Slightly higher calorie target for thermogenesis.`
  }

  return {
    ...targets,
    calories: targets.calories + calorieAdjust,
    waterMl,
    weatherAdjustmentNote,
  }
}

export function computeDeviationSeverity(
  deltaCalories: number
): 'minor' | 'moderate' | 'significant' {
  const abs = Math.abs(deltaCalories)
  if (abs < 100) return 'minor'
  if (abs < 300) return 'moderate'
  return 'significant'
}

export function computeRemainingBudget(
  targets: MacroTargets,
  consumed: MacroTargets,
  loggingMeal: MacroTargets
): MacroTargets {
  return {
    calories: Math.max(0, targets.calories - consumed.calories - loggingMeal.calories),
    proteinG: Math.max(0, targets.proteinG - consumed.proteinG - loggingMeal.proteinG),
    carbsG: Math.max(0, targets.carbsG - consumed.carbsG - loggingMeal.carbsG),
    fatG: Math.max(0, targets.fatG - consumed.fatG - loggingMeal.fatG),
    fiberG: Math.max(0, (targets.fiberG ?? 25) - (consumed.fiberG ?? 0) - (loggingMeal.fiberG ?? 0)),
  }
}

export function computeAdherenceScore(targets: MacroTargets, actuals: MacroTargets): number {
  const calScore = 1 - Math.abs(targets.calories - actuals.calories) / targets.calories
  const proteinScore = 1 - Math.abs(targets.proteinG - actuals.proteinG) / targets.proteinG
  const score = (calScore * 0.5 + proteinScore * 0.3 + 0.2) * 100
  return Math.max(0, Math.min(100, Math.round(score)))
}
