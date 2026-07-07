/**
 * Layer 1: Pure-function deterministic tests
 * Run: npx tsx scripts/test-layer1.ts
 */
import {
  computeBMR, computeTDEE, computeMacroTargets, computeMicroTargets,
  applyWeatherAdjustment, computeWeatherAdjustmentNote, classifyRisk, computeAdherenceScore,
  computeRemainingBudget, computeDeviationSeverity,
} from '@/lib/nutrition/engine'
import {
  validateRebalancedPlan, sanitizeExplanation,
} from '@/lib/nutrition/safety-validator'
import { mapExtractedConditionToCode } from '@/lib/nutrition/condition-mapper'

let pass = 0, fail = 0

function assert(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✅ ${name}`)
    pass++
  } else {
    console.error(`  ❌ ${name}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     actual  : ${JSON.stringify(actual)}`)
    fail++
  }
}

function assertRange(name: string, val: number, min: number, max: number) {
  const ok = val >= min && val <= max
  if (ok) {
    console.log(`  ✅ ${name} = ${val} (in [${min}, ${max}])`)
    pass++
  } else {
    console.error(`  ❌ ${name} = ${val} (expected in [${min}, ${max}])`)
    fail++
  }
}

function assertTrue(name: string, val: boolean) {
  if (val) { console.log(`  ✅ ${name}`); pass++ }
  else { console.error(`  ❌ ${name}`); fail++ }
}

// ─── BMR / TDEE ───────────────────────────────────────────────────────────────
console.log('\n── BMR / TDEE ─────────────────────────────────────────────')

{
  // Mifflin: 10*80 + 6.25*175 - 5*30 + 5 = 800+1093.75-150+5 = 1748.75 → 1749
  const bmr = computeBMR({ weightKg: 80, heightCm: 175, ageYears: 30, sex: 'male' })
  assert('Male BMR 80kg/175cm/30y', bmr, 1749)
}
{
  // 10*60 + 6.25*160 - 5*25 - 161 = 600+1000-125-161 = 1314
  const bmr = computeBMR({ weightKg: 60, heightCm: 160, ageYears: 25, sex: 'female' })
  assert('Female BMR 60kg/160cm/25y', bmr, 1314)
}
{
  const bmr = computeBMR({ weightKg: 80, heightCm: 175, ageYears: 30, sex: 'male' })
  // 1749 * 1.55 = 2710.95 → 2711
  const tdee = computeTDEE(bmr, 'moderately_active')
  assert('TDEE moderately_active (1749 bmr)', tdee, 2711)
}
{
  const bmr = computeBMR({ weightKg: 80, heightCm: 175, ageYears: 30, sex: 'male' })
  const tdee = computeTDEE(bmr, 'sedentary')
  // 1749 * 1.2 = 2098.8 → 2099
  assert('TDEE sedentary', tdee, 2099)
}

// ─── classifyRisk ──────────────────────────────────────────────────────────────
console.log('\n── classifyRisk ───────────────────────────────────────────')
assert('No conditions → LOW', classifyRisk([]), 'LOW')
assert('type2_diabetes_medicated → MODERATE', classifyRisk(['type2_diabetes_medicated']), 'MODERATE')
assert('type1_diabetes → HIGH', classifyRisk(['type1_diabetes']), 'HIGH')
assert('ckd_stage5 → CRITICAL', classifyRisk(['ckd_stage5']), 'CRITICAL')
assert('dialysis → CRITICAL', classifyRisk(['dialysis']), 'CRITICAL')
assert('pregnancy → HIGH', classifyRisk(['pregnancy']), 'HIGH')
assert('Mixed: hypertension+ckd_stage4 → CRITICAL', classifyRisk(['hypertension_medicated', 'ckd_stage4']), 'CRITICAL')

// ─── computeMacroTargets ──────────────────────────────────────────────────────
console.log('\n── computeMacroTargets ───────────────────────────────────')
{
  // Standard WEIGHT_LOSS: tdee=2000, deficit → 1500 (tdee-500), no special conditions
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [])
  assert('WEIGHT_LOSS deficit from 2000', m.calories, 1500)
  // protein 30% of 1500 / 4 = 112
  assert('WEIGHT_LOSS protein ~112g', m.proteinG, Math.round((1500 * 0.3) / 4))
}
{
  // WEIGHT_LOSS floor: tdee=1300, should not go below 1200
  const m = computeMacroTargets(1300, 'WEIGHT_LOSS', [])
  assert('WEIGHT_LOSS calorie floor at 1200', m.calories, 1200)
}
{
  // Pregnancy + WEIGHT_LOSS → no deficit (noDeficit guard)
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', ['pregnancy'])
  assert('Pregnancy + WEIGHT_LOSS → no deficit', m.calories, 2000)
}
{
  // Eating disorder + WEIGHT_LOSS → no deficit
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', ['eating_disorder'])
  assert('Eating disorder + WEIGHT_LOSS → no deficit', m.calories, 2000)
}
{
  // CKD non-dialysis: protein capped at 50g
  const m = computeMacroTargets(2000, 'MAINTENANCE', ['ckd_stage3'])
  assertTrue('CKD non-dialysis protein ≤ 50g', m.proteinG <= 50)
  assert('CKD fiber = 20g', m.fiberG, 20)
}
{
  // Dialysis: higher protein (18% of cal / 4)
  const m = computeMacroTargets(2000, 'MAINTENANCE', ['dialysis'])
  assert('Dialysis protein', m.proteinG, Math.round((2000 * 0.18) / 4))
}
{
  // MUSCLE_GAIN / WEIGHT_GAIN: +300
  const m = computeMacroTargets(2000, 'MUSCLE_GAIN', [])
  assert('MUSCLE_GAIN +300 kcal', m.calories, 2300)
}
{
  // MUSCLE_GAIN bumps protein to 35% (vs standard 30%)
  const m = computeMacroTargets(2000, 'MUSCLE_GAIN', [])
  assert('MUSCLE_GAIN protein 35%', m.proteinG, Math.round((2300 * 0.35) / 4))
}
{
  // MUSCLE_GAIN as a secondary goal (e.g. recomposition: primary WEIGHT_LOSS) also bumps protein
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { secondaryGoals: ['MUSCLE_GAIN'] })
  assert('Secondary MUSCLE_GAIN protein 35%', m.proteinG, Math.round((1500 * 0.35) / 4))
}
{
  // CKD protein cap always wins over muscle-gain goal — medical safety can't be overridden
  const m = computeMacroTargets(2000, 'MUSCLE_GAIN', ['ckd_stage3'])
  assertTrue('CKD cap overrides muscle-gain protein bump', m.proteinG <= 50)
}
{
  // targetWeightKg close to current (<5kg gap) → gentler deficit (250 instead of 500)
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 70, targetWeightKg: 67 })
  assert('Small weight gap → gentler 250 deficit', m.calories, 1750)
}
{
  // targetWeightKg far from current (>=5kg gap) → standard 500 deficit, unchanged
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 90, targetWeightKg: 70 })
  assert('Large weight gap → standard 500 deficit', m.calories, 1500)
}
{
  // No targetWeightKg provided (optional field skipped) → standard pace, unchanged behavior
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [])
  assert('No target weight → standard 500 deficit', m.calories, 1500)
}
{
  // Small weight gap + WEIGHT_GAIN → gentler surplus (150 instead of 300)
  const m = computeMacroTargets(2000, 'WEIGHT_GAIN', [], { currentWeightKg: 58, targetWeightKg: 60 })
  assert('Small weight gap → gentler 150 surplus', m.calories, 2150)
}

// ─── computeMicroTargets ─────────────────────────────────────────────────────
console.log('\n── computeMicroTargets ───────────────────────────────────')
{
  const micro = computeMicroTargets('female', [])
  assert('Standard female sodium', micro.sodiumMg, 2300)
  assert('Standard female iron', micro.ironMg, 18)
  assert('Standard potassium', micro.potassiumMg, 4700)
}
{
  const micro = computeMicroTargets('female', ['hypertension_medicated'])
  assert('Hypertension sodium 1500', micro.sodiumMg, 1500)
}
{
  const micro = computeMicroTargets('female', ['ckd_stage4'])
  assert('CKD potassium 2000', micro.potassiumMg, 2000)
  assert('CKD phosphorus 800', micro.phosphorusMg, 800)
  assert('CKD sodium 1500', micro.sodiumMg, 1500)
}
{
  const micro = computeMicroTargets('female', ['pregnancy'])
  assert('Pregnancy iron 27', micro.ironMg, 27)
  assert('Pregnancy calcium 1300', micro.calciumMg, 1300)
}
{
  const micro = computeMicroTargets('male', [])
  assert('Male iron 8', micro.ironMg, 8)
}

// ─── applyWeatherAdjustment ───────────────────────────────────────────────────
console.log('\n── applyWeatherAdjustment ────────────────────────────────')
{
  const base = computeMacroTargets(2000, 'MAINTENANCE', [])
  const micro = computeMicroTargets('male', [])
  const targets = { ...base, ...micro }
  const result = applyWeatherAdjustment(targets, { tempC: 40, humidity: 70 })
  assert('Extreme heat: water 3500ml', result.waterMl, 3500)
  assert('Extreme heat: calorie -100', result.calories, targets.calories - 100)
  assertTrue('Extreme heat: note set', !!result.weatherAdjustmentNote)
}
{
  const base = computeMacroTargets(2000, 'MAINTENANCE', [])
  const micro = computeMicroTargets('male', [])
  const targets = { ...base, ...micro }
  const result = applyWeatherAdjustment(targets, { tempC: 5, humidity: 50 })
  assert('Cold: water 2000ml', result.waterMl, 2000)
  assert('Cold: calorie +150', result.calories, targets.calories + 150)
}
{
  const base = computeMacroTargets(2000, 'MAINTENANCE', [])
  const micro = computeMicroTargets('male', [])
  const targets = { ...base, ...micro }
  const result = applyWeatherAdjustment(targets, { tempC: 22, humidity: 50 })
  assert('Mild weather: water 2500ml', result.waterMl, 2500)
  assert('Mild weather: no calorie change', result.calories, targets.calories)
}
{
  // computeWeatherAdjustmentNote must be derivable from a raw weather reading alone
  // (e.g. one read back from a DB row that never had the note persisted) and agree
  // exactly with what applyWeatherAdjustment would have produced inline.
  const base = computeMacroTargets(2000, 'MAINTENANCE', [])
  const micro = computeMicroTargets('male', [])
  const targets = { ...base, ...micro }
  const hotWeather = { tempC: 40, humidity: 70 }
  assert('computeWeatherAdjustmentNote matches applyWeatherAdjustment for hot weather',
    computeWeatherAdjustmentNote(hotWeather), applyWeatherAdjustment(targets, hotWeather).weatherAdjustmentNote)
  const mildWeather = { tempC: 22, humidity: 50 }
  assertTrue('computeWeatherAdjustmentNote is undefined for mild weather', computeWeatherAdjustmentNote(mildWeather) === undefined)
}

// ─── computeDeviationSeverity ─────────────────────────────────────────────────
console.log('\n── computeDeviationSeverity ──────────────────────────────')
assert('delta 50 → minor', computeDeviationSeverity(50), 'minor')
assert('delta -80 → minor', computeDeviationSeverity(-80), 'minor')
assert('delta 150 → moderate', computeDeviationSeverity(150), 'moderate')
assert('delta -299 → moderate', computeDeviationSeverity(-299), 'moderate')
assert('delta 300 → significant', computeDeviationSeverity(300), 'significant')
assert('delta -500 → significant', computeDeviationSeverity(-500), 'significant')

// ─── computeRemainingBudget ───────────────────────────────────────────────────
console.log('\n── computeRemainingBudget ────────────────────────────────')
{
  const targets = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30 }
  const consumed = { calories: 600, proteinG: 40, carbsG: 70, fatG: 20, fiberG: 10 }
  const logging = { calories: 200, proteinG: 15, carbsG: 20, fatG: 5, fiberG: 3 }
  const rem = computeRemainingBudget(targets, consumed, logging)
  assert('Remaining calories', rem.calories, 1200)
  assert('Remaining protein', rem.proteinG, 95)
}
{
  // Floor at 0 — no negative remaining
  const targets = { calories: 200, proteinG: 20, carbsG: 20, fatG: 10, fiberG: 5 }
  const consumed = { calories: 300, proteinG: 25, carbsG: 30, fatG: 15, fiberG: 8 }
  const logging = { calories: 100, proteinG: 5, carbsG: 10, fatG: 3, fiberG: 2 }
  const rem = computeRemainingBudget(targets, consumed, logging)
  assert('Remaining floors at 0 (no negative)', rem.calories, 0)
  assert('Protein floors at 0', rem.proteinG, 0)
}

// ─── computeAdherenceScore ────────────────────────────────────────────────────
console.log('\n── computeAdherenceScore ─────────────────────────────────')
{
  // Perfect adherence
  const t = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30 }
  const score = computeAdherenceScore(t, t)
  // calScore=1, proteinScore=1 → (1*0.625 + 1*0.375)*100 = 100
  assert('Perfect adherence = 100', score, 100)
}
{
  // 50% off on calories, 50% off on protein
  const t = { calories: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }
  const a = { calories: 1000, proteinG: 50, carbsG: 200, fatG: 60, fiberG: 30 }
  const score = computeAdherenceScore(t, a)
  // calScore=(1-1000/2000)=0.5, proteinScore=(1-50/100)=0.5 → (0.5*0.625+0.5*0.375)*100 = 50
  assert('50% deviation score = 50 (no more flat bonus)', score, 50)
}
{
  // Zero intake must score 0 — no free points for not eating
  const t = { calories: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }
  const a = { calories: 0, proteinG: 0, carbsG: 200, fatG: 60, fiberG: 30 }
  const score = computeAdherenceScore(t, a)
  // calScore=0, proteinScore=0 → 0
  assert('Zero intake scores 0 (inflation bug fixed)', score, 0)
}
{
  // Massive overeating on calories alone shouldn't erase a perfect protein score
  const t = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30 }
  const a = { calories: 6000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30 }
  const score = computeAdherenceScore(t, a)
  // calScore clamped to 0 (would be -1 unclamped), proteinScore=1 → (0*0.625+1*0.375)*100 = 37.5 → 38
  assert('Overshoot clamps calScore at 0 instead of going negative', score, 38)
}

// ─── validateRebalancedPlan ───────────────────────────────────────────────────
console.log('\n── validateRebalancedPlan ────────────────────────────────')
{
  // Valid plan
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Dal rice', quantity: '1 bowl', calories: 400, proteinG: 15, carbsG: 60, fatG: 8 }], totalCalories: 400 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 500, proteinG: 50, carbsG: 80, fatG: 20 }, [], [], 'Stay hydrated today.')
  assert('Valid plan passes', result.passed, true)
  assert('No violations', result.violations.length, 0)
}
{
  // Calorie budget exceeded (>5%)
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Biryani', quantity: '2 plates', calories: 1000, proteinG: 30, carbsG: 100, fatG: 40 }], totalCalories: 1000 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 800, proteinG: 50, carbsG: 80, fatG: 30 }, [], [], '')
  assertTrue('Budget exceeded → violation', !result.passed)
  assertTrue('Budget violation message present', result.violations[0].includes('calorie budget'))
}
{
  // Allergen: nuts banned, almond in meal
  const meals = [
    { mealType: 'SNACK', items: [{ name: 'Almond shake', quantity: '1 glass', calories: 200, proteinG: 8, carbsG: 20, fatG: 10 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 30, fatG: 15 }, ['nuts'], [], '')
  assertTrue('Allergen (almond/nuts) → violation', !result.passed)
  assertTrue('Allergen violation message', result.violations.some(v => v.includes('Allergen')))
}
{
  // Allergen: gluten, roti in meal
  const meals = [
    { mealType: 'DINNER', items: [{ name: 'Whole wheat roti', quantity: '2', calories: 200, proteinG: 6, carbsG: 40, fatG: 3 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 50, fatG: 15 }, ['gluten'], [], '')
  assertTrue('Allergen (wheat roti/gluten) → violation', !result.passed)
}
{
  // Allergen: dairy, paneer in meal
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Palak paneer', quantity: '1 bowl', calories: 200, proteinG: 10, carbsG: 8, fatG: 12 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, ['dairy'], [], '')
  assertTrue('Allergen (paneer/dairy) → violation', !result.passed)
}
{
  // Medical language in explanation
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Dal rice', quantity: '1 bowl', calories: 300, proteinG: 12, carbsG: 50, fatG: 5 }], totalCalories: 300 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 400, proteinG: 20, carbsG: 60, fatG: 15 }, [], [], 'You may have diabetes based on your symptoms.')
  assertTrue('Medical diagnostic language → violation', !result.passed)
  assertTrue('Medical violation message present', result.violations.some(v => v.includes('medical language')))
}
{
  // High-sodium food for hypertension patient
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Aloo pickle', quantity: '2 tsp', calories: 30, proteinG: 0, carbsG: 5, fatG: 1 }], totalCalories: 30 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 100, proteinG: 5, carbsG: 10, fatG: 5 }, [], ['hypertension_medicated'], '')
  assertTrue('High-sodium food (pickle) + hypertension → violation', !result.passed)
}
{
  // Zero-calorie meal
  const meals = [
    { mealType: 'SNACK', items: [{ name: 'Water', quantity: '1 glass', calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }], totalCalories: 0 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 200, proteinG: 10, carbsG: 20, fatG: 8 }, [], [], '')
  assertTrue('Zero-calorie meal → violation', !result.passed)
}
{
  // Multiple violations stacked
  const meals = [
    { mealType: 'LUNCH', items: [
      { name: 'Almond milk', quantity: '1 cup', calories: 600, proteinG: 5, carbsG: 20, fatG: 5 },
    ], totalCalories: 600 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 15, carbsG: 30, fatG: 10 }, ['nuts', 'dairy'], [], '')
  assertTrue('Multiple violations: budget + allergens', result.violations.length >= 2)
}

// ─── sanitizeExplanation ─────────────────────────────────────────────────────
console.log('\n── sanitizeExplanation ───────────────────────────────────')
{
  const clean = sanitizeExplanation('You have high blood sugar based on your symptoms.')
  assertTrue('Medical language stripped from explanation', !clean.includes('You have'))
}
{
  const clean = sanitizeExplanation('Great nutrition today. Stay consistent!')
  assert('Clean text passes through unchanged', clean, 'Great nutrition today. Stay consistent!')
}

// ─── mapExtractedConditionToCode ─────────────────────────────────────────────
console.log('\n── mapExtractedConditionToCode (doc-extraction → canonical code) ──')
{
  assert('"Type 2 Diabetes" → canonical code', mapExtractedConditionToCode('Type 2 Diabetes').code, 'type2_diabetes_medicated')
  assert('"Type 1 Diabetes" → canonical code', mapExtractedConditionToCode('Type 1 Diabetes').code, 'type1_diabetes')
  assert('"Chronic Kidney Disease Stage 3" → staged CKD code', mapExtractedConditionToCode('Chronic Kidney Disease Stage 3').code, 'ckd_stage3')
  assert('"CKD" (no stage) → ckd_unspecified', mapExtractedConditionToCode('CKD').code, 'ckd_unspecified')
  assert('"On Dialysis" → dialysis', mapExtractedConditionToCode('On Dialysis').code, 'dialysis')
  assert('"Hypertension" → hypertension_medicated', mapExtractedConditionToCode('Hypertension').code, 'hypertension_medicated')
  assert('"Pregnancy" → pregnancy', mapExtractedConditionToCode('Pregnancy').code, 'pregnancy')
  assert('"Hypothyroidism" → hypothyroid', mapExtractedConditionToCode('Hypothyroidism').code, 'hypothyroid')
  assert('"PCOS" → pcos', mapExtractedConditionToCode('PCOS').code, 'pcos')
  assert('"Celiac Disease" → celiac', mapExtractedConditionToCode('Celiac Disease').code, 'celiac')
  assert('"Irritable Bowel Syndrome" → ibs_severe', mapExtractedConditionToCode('Irritable Bowel Syndrome').code, 'ibs_severe')
  assert('Unrecognized condition falls back to slug', mapExtractedConditionToCode('Some Rare Condition').code, 'some_rare_condition')

  // The whole point of this mapper: the mapped code must actually trigger the
  // deterministic engine's condition-specific logic, unlike a naive slugify.
  const ckdCode = mapExtractedConditionToCode('Chronic Kidney Disease Stage 4').code
  assertTrue('Mapped CKD code is classified CRITICAL by the risk engine', classifyRisk([ckdCode]) === 'CRITICAL')
  const diabetesCode = mapExtractedConditionToCode('Type 2 Diabetes').code
  assertTrue('Mapped diabetes code is classified MODERATE by the risk engine', classifyRisk([diabetesCode]) === 'MODERATE')
  const naiveSlug = 'type_2_diabetes' // what the old naive slugify produced — must NOT match
  assertTrue('Naive slugify of the same label would have been LOW risk (the bug this replaces)', classifyRisk([naiveSlug]) === 'LOW')
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`)
console.log(`  Layer 1 results: ${pass} passed, ${fail} failed`)
console.log(`═══════════════════════════════════════\n`)
if (fail > 0) process.exit(1)
