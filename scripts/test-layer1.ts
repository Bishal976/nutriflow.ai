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
import { conditionToRestrictions } from '@/lib/nutrition/condition-restrictions'

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
// Diet-managed hypertension (no "_medicated" suffix) was previously missed
// entirely by the exact-set check and silently classified LOW
assert('hypertension (diet-managed, no suffix) → MODERATE', classifyRisk(['hypertension']), 'MODERATE')
// Conditions added via the profile page's "Add condition" feature — previously
// its own divergent code list the risk engine never recognized at all
assert('high_cholesterol → MODERATE', classifyRisk(['high_cholesterol']), 'MODERATE')
assert('fatty_liver → MODERATE', classifyRisk(['fatty_liver']), 'MODERATE')
assert('anemia → MODERATE', classifyRisk(['anemia']), 'MODERATE')
assert('hyperthyroidism → MODERATE', classifyRisk(['hyperthyroidism']), 'MODERATE')
assert('ckd_stage1 → MODERATE (not HIGH/CRITICAL — early stage)', classifyRisk(['ckd_stage1']), 'MODERATE')
assert('gerd → LOW (lifestyle/textural, not a risk-tier condition)', classifyRisk(['gerd']), 'LOW')
assert('lactose_intolerance → LOW (dietary restriction, not a risk-tier condition)', classifyRisk(['lactose_intolerance']), 'LOW')

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
  // Stage 1-2 CKD is not a protein-restriction indication in practice — only
  // stage 3+/dialysis/unspecified should trigger the cap
  const restricted = computeMacroTargets(2000, 'MAINTENANCE', ['ckd_stage3'])
  const unrestricted = computeMacroTargets(2000, 'MAINTENANCE', ['ckd_stage1'])
  assertTrue('ckd_stage1 does NOT trigger protein restriction', unrestricted.proteinG > restricted.proteinG)
  assertTrue('ckd_stage3 DOES trigger protein restriction', restricted.proteinG <= 50)
}
{
  // Unknown/unspecified CKD stage errs toward caution and restricts
  const m = computeMacroTargets(2000, 'MAINTENANCE', ['ckd_unspecified'])
  assertTrue('ckd_unspecified triggers protein restriction (errs toward caution)', m.proteinG <= 50)
}
{
  // 3kg gap (within the 5kg taper window) → linear taper: 100 + (500-100)*(3/5) = 340 deficit
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 70, targetWeightKg: 67 })
  assert('3kg gap → tapered 340 deficit', m.calories, 1660)
}
{
  // 1kg gap → tapers further down: 100 + 400*(1/5) = 180 deficit
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 68, targetWeightKg: 67 })
  assert('1kg gap → tapered 180 deficit (less than 3kg-gap deficit)', m.calories, 1820)
}
{
  // Already at/past goal (gap <= 0) → no deficit, pure maintenance
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 67, targetWeightKg: 67 })
  assert('At goal weight → maintenance, no deficit', m.calories, 2000)
}
{
  // Direction matters: WEIGHT_LOSS goal but current weight already below the
  // "target" (misconfigured or already-surpassed goal) → still maintenance, not a surplus
  const m = computeMacroTargets(2000, 'WEIGHT_LOSS', [], { currentWeightKg: 65, targetWeightKg: 70 })
  assert('Past weight-loss goal → maintenance, not negative deficit', m.calories, 2000)
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
  // 2kg gap + WEIGHT_GAIN → tapered surplus: 100 + (300-100)*(2/5) = 180
  const m = computeMacroTargets(2000, 'WEIGHT_GAIN', [], { currentWeightKg: 58, targetWeightKg: 60 })
  assert('2kg gap → tapered 180 surplus', m.calories, 2180)
}
{
  // Already at/past weight-gain goal → maintenance, no surplus
  const m = computeMacroTargets(2000, 'WEIGHT_GAIN', [], { currentWeightKg: 62, targetWeightKg: 60 })
  assert('Past weight-gain goal → maintenance, no surplus', m.calories, 2000)
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
{
  const micro = computeMicroTargets('male', ['anemia'])
  assert('Anemia bumps male iron to 27', micro.ironMg, 27)
}
{
  const micro = computeMicroTargets('female', ['anemia'])
  assert('Anemia does not lower an already-higher target (female pregnancy-level 27)', micro.ironMg, 27)
}

// ─── conditionToRestrictions (single merged implementation) ──────────────────
console.log('\n── conditionToRestrictions ───────────────────────────────')
{
  // Regression: this used to be two separately-maintained copies, and the one
  // used by the post-meal-log rebalance path was missing these two entirely —
  // meaning a pregnant user or someone with an eating-disorder history lost
  // this safety framing the moment they logged a meal and got rebalanced.
  const r = conditionToRestrictions(['pregnancy'])
  assertTrue('pregnancy → no-deficit + folate rule present', r.some(x => x.includes('No calorie deficit') && x.includes('folate')))
}
{
  const r = conditionToRestrictions(['eating_disorder'])
  assertTrue('eating_disorder → no restriction-language rule present', r.some(x => x.includes('cutting')))
  assertTrue('eating_disorder → no-deficit rule present', r.some(x => x.includes('No calorie deficit')))
}
{
  const r = conditionToRestrictions(['high_cholesterol'])
  assertTrue('high_cholesterol → fried/ghee avoidance rule present', r.some(x => x.includes('deep-fried')))
}
{
  const r = conditionToRestrictions(['fatty_liver'])
  assertTrue('fatty_liver → same low-saturated-fat rule as high_cholesterol', r.some(x => x.includes('deep-fried')))
}
{
  const r = conditionToRestrictions(['lactose_intolerance'])
  assertTrue('lactose_intolerance → dairy avoidance rule present', r.some(x => x.toLowerCase().includes('dairy')))
}
{
  const r = conditionToRestrictions(['gerd'])
  assertTrue('gerd → spice/caffeine/meal-timing rule present', r.some(x => x.includes('caffeine')))
}
{
  const r = conditionToRestrictions(['anemia'])
  assertTrue('anemia → iron-rich food rule present', r.some(x => x.includes('iron')))
}
{
  const r = conditionToRestrictions([])
  assert('No conditions → no restrictions', r.length, 0)
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
  const result = validateRebalancedPlan(meals, { calories: 500, proteinG: 50, carbsG: 80, fatG: 20 }, [], 'VEG', [], 'Stay hydrated today.')
  assert('Valid plan passes', result.passed, true)
  assert('No violations', result.violations.length, 0)
}
{
  // Calorie budget exceeded (>5%)
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Biryani', quantity: '2 plates', calories: 1000, proteinG: 30, carbsG: 100, fatG: 40 }], totalCalories: 1000 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 800, proteinG: 50, carbsG: 80, fatG: 30 }, [], 'VEG', [], '')
  assertTrue('Budget exceeded → violation', !result.passed)
  assertTrue('Budget violation message present', result.violations[0].includes('calorie budget'))
}
{
  // Allergen: nuts banned, almond in meal
  const meals = [
    { mealType: 'SNACK', items: [{ name: 'Almond shake', quantity: '1 glass', calories: 200, proteinG: 8, carbsG: 20, fatG: 10 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 30, fatG: 15 }, ['nuts'], 'VEG', [], '')
  assertTrue('Allergen (almond/nuts) → violation', !result.passed)
  assertTrue('Allergen violation message', result.violations.some(v => v.includes('Allergen')))
}
{
  // Allergen: gluten, roti in meal
  const meals = [
    { mealType: 'DINNER', items: [{ name: 'Whole wheat roti', quantity: '2', calories: 200, proteinG: 6, carbsG: 40, fatG: 3 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 50, fatG: 15 }, ['gluten'], 'VEG', [], '')
  assertTrue('Allergen (wheat roti/gluten) → violation', !result.passed)
}
{
  // Allergen: dairy, paneer in meal
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Palak paneer', quantity: '1 bowl', calories: 200, proteinG: 10, carbsG: 8, fatG: 12 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, ['dairy'], 'VEG', [], '')
  assertTrue('Allergen (paneer/dairy) → violation', !result.passed)
}
{
  // Medical language in explanation
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Dal rice', quantity: '1 bowl', calories: 300, proteinG: 12, carbsG: 50, fatG: 5 }], totalCalories: 300 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 400, proteinG: 20, carbsG: 60, fatG: 15 }, [], 'VEG', [], 'You may have diabetes based on your symptoms.')
  assertTrue('Medical diagnostic language → violation', !result.passed)
  assertTrue('Medical violation message present', result.violations.some(v => v.includes('medical language')))
}
{
  // High-sodium food for hypertension patient
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Aloo pickle', quantity: '2 tsp', calories: 30, proteinG: 0, carbsG: 5, fatG: 1 }], totalCalories: 30 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 100, proteinG: 5, carbsG: 10, fatG: 5 }, [], 'VEG', ['hypertension_medicated'], '')
  assertTrue('High-sodium food (pickle) + hypertension → violation', !result.passed)
}
{
  // Zero-calorie meal
  const meals = [
    { mealType: 'SNACK', items: [{ name: 'Water', quantity: '1 glass', calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }], totalCalories: 0 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 200, proteinG: 10, carbsG: 20, fatG: 8 }, [], 'VEG', [], '')
  assertTrue('Zero-calorie meal → violation', !result.passed)
}
{
  // Multiple violations stacked
  const meals = [
    { mealType: 'LUNCH', items: [
      { name: 'Almond milk', quantity: '1 cup', calories: 600, proteinG: 5, carbsG: 20, fatG: 5 },
    ], totalCalories: 600 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 15, carbsG: 30, fatG: 10 }, ['nuts', 'dairy'], 'VEG', [], '')
  assertTrue('Multiple violations: budget + allergens', result.violations.length >= 2)
}
{
  // Diet-type hard block — previously only allergens were pattern-checked here,
  // so a VEGAN user could silently get paneer/egg with nothing catching it
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Palak paneer', quantity: '1 bowl', calories: 200, proteinG: 10, carbsG: 8, fatG: 12 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, [], 'VEGAN', [], '')
  assertTrue('Paneer for VEGAN diet → hard violation', result.hardViolations.length > 0)
}
{
  // VEG (standard Indian convention) allows dairy — only meat/fish/egg blocked
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Palak paneer', quantity: '1 bowl', calories: 200, proteinG: 10, carbsG: 8, fatG: 12 }], totalCalories: 200 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, [], 'VEG', [], '')
  assertTrue('Paneer for VEG diet → no violation (dairy allowed)', result.hardViolations.length === 0)
}
{
  const meals = [
    { mealType: 'DINNER', items: [{ name: 'Chicken curry', quantity: '1 bowl', calories: 300, proteinG: 25, carbsG: 8, fatG: 15 }], totalCalories: 300 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 400, proteinG: 30, carbsG: 20, fatG: 20 }, [], 'VEG', [], '')
  assertTrue('Chicken for VEG diet → hard violation', result.hardViolations.length > 0)
}
{
  // Pescatarian allows fish, blocks meat
  const meals = [
    { mealType: 'DINNER', items: [{ name: 'Grilled fish', quantity: '1 fillet', calories: 250, proteinG: 30, carbsG: 0, fatG: 10 }], totalCalories: 250 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 400, proteinG: 30, carbsG: 20, fatG: 20 }, [], 'PESCATARIAN', [], '')
  assertTrue('Fish for PESCATARIAN diet → no violation', result.hardViolations.length === 0)
}
{
  // JAIN blocks root vegetables in addition to meat/fish/egg
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Onion garlic curry', quantity: '1 bowl', calories: 150, proteinG: 4, carbsG: 20, fatG: 6 }], totalCalories: 150 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, [], 'JAIN', [], '')
  assertTrue('Onion/garlic for JAIN diet → hard violation', result.hardViolations.length > 0)
}
{
  // Lactose intolerance is a physical intolerance — hard block, not a soft preference
  const meals = [
    { mealType: 'BREAKFAST', items: [{ name: 'Paneer bhurji', quantity: '1 bowl', calories: 220, proteinG: 15, carbsG: 5, fatG: 15 }], totalCalories: 220 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 20, carbsG: 20, fatG: 20 }, [], 'VEG', ['lactose_intolerance'], '')
  assertTrue('Paneer for lactose-intolerant user → hard violation', result.hardViolations.length > 0)
}
{
  // High cholesterol / fatty liver hard-blocks fried/organ-meat/ghee-heavy foods
  const meals = [
    { mealType: 'DINNER', items: [{ name: 'Deep-fried pakora', quantity: '6 pieces', calories: 350, proteinG: 8, carbsG: 30, fatG: 22 }], totalCalories: 350 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 400, proteinG: 20, carbsG: 40, fatG: 15 }, [], 'VEG', ['high_cholesterol'], '')
  assertTrue('Deep-fried food for high-cholesterol user → hard violation', result.hardViolations.length > 0)
}
{
  // Sesame is offered as an allergen option in the onboarding picker — was the
  // only one of the 7 offered allergens with no hard-block pattern at all
  const meals = [
    { mealType: 'BREAKFAST', items: [{ name: 'Til laddu', quantity: '2 pieces', calories: 180, proteinG: 4, carbsG: 20, fatG: 9 }], totalCalories: 180 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 300, proteinG: 15, carbsG: 30, fatG: 12 }, ['sesame'], 'VEG', [], '')
  assertTrue('Sesame (til) allergen → hard violation', result.hardViolations.length > 0)
}
{
  // Soft violations (mild calorie overage) must NOT count as hard — retrying
  // generation over a 5% budget overage would be wasteful, not safety-critical
  const meals = [
    { mealType: 'LUNCH', items: [{ name: 'Dal rice', quantity: '1 bowl', calories: 850, proteinG: 15, carbsG: 60, fatG: 8 }], totalCalories: 850 },
  ]
  const result = validateRebalancedPlan(meals, { calories: 800, proteinG: 50, carbsG: 80, fatG: 30 }, [], 'VEG', [], '')
  assertTrue('Budget-only overage is a violation...', !result.passed)
  assertTrue('...but NOT a hard violation (not retry-worthy)', result.hardViolations.length === 0)
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
  // classifyRisk now uses substring keywords (e.g. "diabetes", "hypothyroid") so several
  // naive slugs get caught anyway as a bonus — but a full-phrase slug like this CKD
  // example still misses the "ckd_" prefix entirely, so the mapper still matters.
  const naiveSlug = 'chronic_kidney_disease_stage_4' // what a naive slugify produces — must NOT match
  assertTrue('Naive slugify of the same label would have been LOW risk (the bug this replaces)', classifyRisk([naiveSlug]) === 'LOW')
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`)
console.log(`  Layer 1 results: ${pass} passed, ${fail} failed`)
console.log(`═══════════════════════════════════════\n`)
if (fail > 0) process.exit(1)
