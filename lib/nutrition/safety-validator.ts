// Post-LLM constraint validator.
// Every LLM-generated plan MUST pass through this before being returned to the user.
// `hardViolations` are enforced by the caller (retry generation, then fail safely
// rather than serve the plan) — see lib/ai/plan-generator.ts and lib/ai/rebalancer.ts.
// `violations` is the full list (hard + soft/heuristic) for logging and display.

import type { MedicalConditionCode } from './engine'

export interface FoodItem {
  name: string
  householdQuantity: string
  quantityGramsEstimate: number
  caloriesEstimate: number
  proteinG: number
  carbsG: number
  fatG: number
  confidence: number
}

export interface RebalancedMeal {
  mealType: string
  items: Array<{
    name: string
    quantity: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
  totalCalories: number
}

export interface ValidationResult {
  passed: boolean
  violations: string[]
  hardViolations: string[]
  patchedMeals?: RebalancedMeal[]
}

const MEDICAL_DIAGNOSTIC_PATTERNS = [
  /you (have|may have|could have|might have)/i,
  /diagnos/i,
  /consult (a|your) doctor/i,
  /medical advice/i,
  /treatment for/i,
  /symptom/i,
  /prescri(be|ption)/i,
]

const BANNED_ALLERGEN_INGREDIENTS: Record<string, RegExp[]> = {
  nuts: [/\bnut(s)?\b/i, /\balmond/i, /\bcashew/i, /\bpeanut/i, /\bwalnut/i, /\bpistachio/i],
  gluten: [/\bwheat\b/i, /\bbarley\b/i, /\brye\b/i, /\bflour\b/i, /\bbread\b/i, /\bnaan\b/i, /\broti\b/i, /\bchapati\b/i],
  dairy: [/\bmilk\b/i, /\bcheese\b/i, /\byogurt\b/i, /\bdahi\b/i, /\bpaneer\b/i, /\bghee\b/i, /\bcurd\b/i, /\bbutter\b/i],
  shellfish: [/\bshrimp\b/i, /\bprawn\b/i, /\bcrab\b/i, /\blobster\b/i],
  eggs: [/\begg(s)?\b/i, /\bomelet\b/i, /\bscrambled\b/i],
  soy: [/\bsoy\b/i, /\btofu\b/i, /\btempeh\b/i],
  // "sesame" is offered as an allergen option in DietaryPrefsStep.tsx but was
  // never added here — every other allergen in that picker was hard-blocked
  // except this one, which was only ever a soft prompt-level exclusion.
  sesame: [/\bsesame\b/i, /\btil\b/i, /\btahini\b/i, /\bgingelly\b/i],
}

// Diet-type is a hard constraint (often religious/ethical, not just taste),
// same tier as allergens — previously only allergens were pattern-checked here,
// so a diet-type slip from the LLM (e.g. paneer for a VEGAN user) was never caught.
const MEAT_PATTERNS = [/\bchicken\b/i, /\bmutton\b/i, /\block\b/i, /\bbeef\b/i, /\bpork\b/i, /\bbacon\b/i, /\bham\b/i, /\bsausage\b/i, /\bmeat\b/i]
const FISH_SEAFOOD_PATTERNS = [/\bfish\b/i, /\bprawn\b/i, /\bshrimp\b/i, /\bcrab\b/i, /\blobster\b/i]
const EGG_PATTERNS = [/\begg(s)?\b/i, /\bomelet/i]
const DAIRY_PATTERNS = [/\bmilk\b/i, /\bcheese\b/i, /\bpaneer\b/i, /\bghee\b/i, /\bcurd\b/i, /\byogurt\b/i, /\bdahi\b/i, /\bbutter\b/i, /\bcream\b/i]
const HONEY_PATTERNS = [/\bhoney\b/i]
const ROOT_VEG_PATTERNS = [/\bonion/i, /\bgarlic/i, /\bpotato/i, /\bcarrot/i, /\bbeetroot/i, /\bradish\b/i, /\bginger\b/i]

function forbiddenPatternsForDiet(dietType: string): RegExp[] {
  switch (dietType) {
    case 'VEGAN': return [...MEAT_PATTERNS, ...FISH_SEAFOOD_PATTERNS, ...EGG_PATTERNS, ...DAIRY_PATTERNS, ...HONEY_PATTERNS]
    case 'VEG': return [...MEAT_PATTERNS, ...FISH_SEAFOOD_PATTERNS, ...EGG_PATTERNS]
    case 'EGGETARIAN': return [...MEAT_PATTERNS, ...FISH_SEAFOOD_PATTERNS]
    case 'PESCATARIAN': return [...MEAT_PATTERNS]
    case 'JAIN': return [...MEAT_PATTERNS, ...FISH_SEAFOOD_PATTERNS, ...EGG_PATTERNS, ...ROOT_VEG_PATTERNS]
    case 'NON_VEG':
    default: return []
  }
}

export function validateRebalancedPlan(
  meals: RebalancedMeal[],
  budget: { calories: number; proteinG: number; carbsG: number; fatG: number },
  allergens: string[],
  dietType: string,
  conditions: MedicalConditionCode[],
  explanation: string
): ValidationResult {
  const violations: string[] = []
  const hardViolations: string[] = []

  // 1. Calorie budget check (allow 5% overage tolerance) — soft, not worth retrying over
  const totalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0)
  if (totalCalories > budget.calories * 1.05) {
    violations.push(`Plan exceeds calorie budget: ${totalCalories} vs ${budget.calories} allowed`)
  }

  // 2. Allergen check — hard block
  for (const allergen of allergens) {
    const patterns = BANNED_ALLERGEN_INGREDIENTS[allergen.toLowerCase()]
    if (!patterns) continue
    for (const meal of meals) {
      for (const item of meal.items) {
        if (patterns.some(p => p.test(item.name))) {
          const msg = `Allergen detected: "${item.name}" contains ${allergen}`
          violations.push(msg); hardViolations.push(msg)
        }
      }
    }
  }

  // 3. Diet-type check — hard block, same tier as allergens
  const dietPatterns = forbiddenPatternsForDiet(dietType)
  for (const meal of meals) {
    for (const item of meal.items) {
      if (dietPatterns.some(p => p.test(item.name))) {
        const msg = `Diet-type violation: "${item.name}" is not compatible with ${dietType}`
        violations.push(msg); hardViolations.push(msg)
      }
    }
  }

  // 4. Medical diagnostic language check in explanation — hard (patchable via
  // sanitizeExplanation, but flagged so callers know a retry may avoid it)
  for (const pattern of MEDICAL_DIAGNOSTIC_PATTERNS) {
    if (pattern.test(explanation)) {
      const msg = `Explanation contains disallowed medical language matching: ${pattern}`
      violations.push(msg); hardViolations.push(msg)
    }
  }

  // 5. Condition-specific nutrient/ingredient caps
  const hasCKD = conditions.some(c => c.startsWith('ckd_') || c === 'dialysis')
  const hasHypertension = conditions.some(c => c.includes('hypertension'))
  const hasLactoseIntolerance = conditions.some(c => c.includes('lactose_intolerance'))
  const hasCholesterolOrFattyLiver = conditions.some(c => c.includes('high_cholesterol') || c.includes('fatty_liver'))

  if (hasCKD || hasHypertension) {
    // We can't easily check sodium per item without full nutrient DB,
    // but flag if the plan has high-sodium keywords — soft/heuristic
    const highSodiumPatterns = [/\bpickle\b/i, /\bpapad\b/i, /\bchips\b/i, /\bsalt(ed)?\b/i, /\bsoy sauce\b/i]
    for (const meal of meals) {
      for (const item of meal.items) {
        if (highSodiumPatterns.some(p => p.test(item.name))) {
          violations.push(`High-sodium food "${item.name}" flagged for hypertension/CKD condition`)
        }
      }
    }
  }

  // Lactose intolerance is a physical intolerance, not a preference — hard block, same as an allergen
  if (hasLactoseIntolerance) {
    for (const meal of meals) {
      for (const item of meal.items) {
        if (DAIRY_PATTERNS.some(p => p.test(item.name))) {
          const msg = `Lactose intolerance: "${item.name}" contains dairy`
          violations.push(msg); hardViolations.push(msg)
        }
      }
    }
  }

  // High cholesterol / fatty liver — hard block on fried/organ-meat/excess-ghee keywords
  if (hasCholesterolOrFattyLiver) {
    const highFatPatterns = [/\bfried\b/i, /\bdeep.?fried\b/i, /\bliver\b/i, /\bkidney\b/i, /\bbrain\b/i, /\bghee\b/i, /\bbutter\b/i]
    for (const meal of meals) {
      for (const item of meal.items) {
        if (highFatPatterns.some(p => p.test(item.name))) {
          const msg = `High-saturated-fat food "${item.name}" flagged for high cholesterol/fatty liver condition`
          violations.push(msg); hardViolations.push(msg)
        }
      }
    }
  }

  // 6. No negative or zero calorie meals — hard, structurally broken data
  for (const meal of meals) {
    if (meal.totalCalories <= 0) {
      const msg = `Meal ${meal.mealType} has invalid calorie count: ${meal.totalCalories}`
      violations.push(msg); hardViolations.push(msg)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    hardViolations,
  }
}

export function sanitizeExplanation(explanation: string): string {
  // Strip any medical diagnostic language before returning to UI
  let safe = explanation
  for (const pattern of MEDICAL_DIAGNOSTIC_PATTERNS) {
    safe = safe.replace(pattern, '[wellness context]')
  }
  return safe
}
