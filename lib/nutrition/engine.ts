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
// Substring keywords rather than exact codes: onboarding's picker, the profile
// page's "add condition" feature, and document-extraction mapping all need to
// land on the same risk tier even if their exact code differs (e.g.
// "hypothyroidism" vs "hypothyroid", "ibs" vs "ibs_severe", diet-managed
// "hypertension" vs "hypertension_medicated") — an exact-set check silently
// drops any of those variants to LOW risk instead of flagging them.
const MODERATE_KEYWORDS = [
  'diabetes', 'hypertension', 'hypothyroid', 'hyperthyroidism', 'pcos', 'ibs',
  'celiac', 'high_cholesterol', 'fatty_liver', 'anemia', 'ckd_stage1', 'ckd_stage2',
]

export function classifyRisk(conditions: MedicalConditionCode[]): RiskLevel {
  if (conditions.some(c => CRITICAL_CONDITIONS.has(c))) return 'CRITICAL'
  if (conditions.some(c => HIGH_RISK_CONDITIONS.has(c))) return 'HIGH'
  if (conditions.some(c => MODERATE_KEYWORDS.some(k => c.includes(k)))) return 'MODERATE'
  return 'LOW'
}


export interface MacroTargetOptions {
  secondaryGoals?: Goal[]
  currentWeightKg?: number
  targetWeightKg?: number
}

// Tapers a deficit/surplus down linearly as the user nears their target weight,
// rather than a flat rate the whole journey — safer (avoids overshoot) and
// preserves lean mass once there's less fat mass left to lose/gain into. Holds
// at `standardDelta` for gaps >= taperKg (going further from goal never needs
// a bigger push — 500kcal/day is already the safe ceiling regardless of how
// much total weight is involved), tapers linearly down to `minDelta` as the
// gap shrinks toward 0, and drops to exactly 0 (maintenance) once the user has
// reached or passed their goal — continuing to push in that direction no
// longer makes sense.
function pacedDelta(gapKg: number | undefined, standardDelta: number, minDelta: number, taperKg = 5): number {
  if (gapKg === undefined) return standardDelta
  if (gapKg <= 0) return 0
  if (gapKg >= taperKg) return standardDelta
  return Math.round(minDelta + (standardDelta - minDelta) * (gapKg / taperKg))
}

export function computeMacroTargets(
  tdee: number,
  goal: Goal,
  conditions: MedicalConditionCode[],
  opts: MacroTargetOptions = {}
): MacroTargets {
  const { secondaryGoals = [], currentWeightKg, targetWeightKg } = opts
  let calories = tdee

  // No calorie deficit for pregnancy or eating-disorder history — immutable code,
  // not LLM, so this guarantee holds even if the AI prompt is ignored
  const noDeficit = conditions.includes('pregnancy')
    || conditions.some(c => ['eating_disorder', 'anorexia', 'bulimia'].includes(c))

  // Signed gap in the direction of travel for this goal (positive = still has
  // ground to cover). Falls back to the standard pace when no target weight
  // was set (field is optional in onboarding).
  const weightGapKg = currentWeightKg != null && targetWeightKg != null
    ? (goal === 'WEIGHT_LOSS' ? currentWeightKg - targetWeightKg : targetWeightKg - currentWeightKg)
    : undefined

  if (goal === 'WEIGHT_LOSS') {
    const deficit = pacedDelta(weightGapKg, 500, 100)
    calories = Math.max(tdee - deficit, noDeficit ? tdee : 1200)
  } else if (goal === 'WEIGHT_GAIN' || goal === 'MUSCLE_GAIN') {
    const surplus = pacedDelta(weightGapKg, 300, 100)
    calories = tdee + surplus
  }

  // CKD protein restriction — immutable code, not LLM. This medical cap always
  // wins over any lifestyle goal (e.g. muscle gain), so it's checked first and
  // returns early before the muscle-gain protein bump below. Only stage 3+ (or
  // dialysis, or unspecified/unknown stage — err toward caution) restricts
  // protein; stage 1-2 CKD is not a protein-restriction indication in practice
  // and over-restricting early risks malnutrition for no clinical benefit.
  const hasCKDProteinRestriction = conditions.some(c =>
    c === 'dialysis' || c === 'ckd_unspecified' || /ckd_stage[3-9]/.test(c)
  )
  if (hasCKDProteinRestriction) {
    const proteinG = conditions.includes('dialysis')
      ? Math.round((calories * 0.18) / 4)  // dialysis: higher protein 1.2-1.4g/kg
      : Math.min(50, Math.round((calories * 0.08) / 4))  // CKD non-dialysis: restrict
    const carbsG = Math.round((calories * 0.55) / 4)
    const fatG = Math.round((calories - proteinG * 4 - carbsG * 4) / 9)
    return { calories, proteinG, carbsG, fatG, fiberG: 20 }
  }

  // Muscle gain (primary or secondary goal) shifts the split toward protein to
  // support strength training / preserve lean mass during a recomposition cut.
  const wantsMuscleGain = goal === 'MUSCLE_GAIN' || secondaryGoals.includes('MUSCLE_GAIN')
  const proteinPct = wantsMuscleGain ? 0.35 : 0.3
  const carbPct = wantsMuscleGain ? 0.35 : 0.4

  const proteinG = Math.round((calories * proteinPct) / 4)
  const carbsG = Math.round((calories * carbPct) / 4)
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
  const hasAnemia = conditions.some(c => c.includes('anemia'))

  const baseIronMg = isPregnant ? 27 : sex === 'female' ? 18 : 8

  return {
    // Sodium: restrict for hypertension/CKD, standard otherwise
    sodiumMg: hasHypertension || hasCKD ? 1500 : 2300,
    // Potassium: restrict for CKD (hyperkalemia risk)
    potassiumMg: hasCKD ? 2000 : 4700,
    // Phosphorus: restrict for CKD
    phosphorusMg: hasCKD ? 800 : 1250,
    // Iron: bump for pregnancy or anemia (whichever asks for more)
    ironMg: hasAnemia ? Math.max(baseIronMg, 27) : baseIronMg,
    // Calcium: bump for pregnancy
    calciumMg: isPregnant ? 1300 : 1000,
  }
}

function weatherAdjustment(weather: WeatherContext): { waterMl: number; calorieAdjust: number; weatherAdjustmentNote?: string } {
  const effectiveTemp = weather.heatIndex ?? weather.tempC

  if (effectiveTemp >= 38 || (weather.tempC >= 35 && weather.humidity > 60)) {
    return {
      waterMl: 3500, calorieAdjust: -100,
      weatherAdjustmentNote: `Hot & humid conditions (${weather.tempC}°C). Hydration target increased. Lighter meals recommended.`,
    }
  }
  if (effectiveTemp >= 32) {
    return {
      waterMl: 3000, calorieAdjust: -50,
      weatherAdjustmentNote: `Warm conditions (${weather.tempC}°C). Slight calorie reduction and higher hydration.`,
    }
  }
  if (weather.tempC <= 10) {
    return {
      waterMl: 2000, calorieAdjust: +150,
      weatherAdjustmentNote: `Cold conditions (${weather.tempC}°C). Slightly higher calorie target for thermogenesis.`,
    }
  }
  return { waterMl: 2500, calorieAdjust: 0 }
}

// Derives the human-readable weather note straight from the raw reading (tempC/
// humidity/heatIndex), independent of whether it was persisted anywhere. Any
// caller holding a raw WeatherContext — even one saved before this note existed
// in the schema, or one read back without the note ever having been stored —
// can recover the same framing text meal-generation prompts rely on.
export function computeWeatherAdjustmentNote(weather: WeatherContext): string | undefined {
  return weatherAdjustment(weather).weatherAdjustmentNote
}

export function applyWeatherAdjustment(
  targets: MacroTargets & MicroTargets,
  weather: WeatherContext
): DailyTargets {
  const { waterMl, calorieAdjust, weatherAdjustmentNote } = weatherAdjustment(weather)

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
  const calScore = Math.max(0, 1 - Math.abs(targets.calories - actuals.calories) / targets.calories)
  const proteinScore = Math.max(0, 1 - Math.abs(targets.proteinG - actuals.proteinG) / targets.proteinG)
  // Weights sum to 1 (5:3 ratio preserved from calories:protein, no flat bonus) so
  // zero intake truthfully scores 0, not a padded floor.
  const score = (calScore * 0.625 + proteinScore * 0.375) * 100
  return Math.max(0, Math.min(100, Math.round(score)))
}
