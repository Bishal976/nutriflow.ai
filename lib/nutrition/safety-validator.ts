// Post-LLM constraint validator.
// Every LLM-generated plan MUST pass through this before being returned to the user.
// Rejects or patches plans that violate deterministic safety rules.

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
}

export function validateRebalancedPlan(
  meals: RebalancedMeal[],
  budget: { calories: number; proteinG: number; carbsG: number; fatG: number },
  allergens: string[],
  conditions: MedicalConditionCode[],
  explanation: string
): ValidationResult {
  const violations: string[] = []

  // 1. Calorie budget check (allow 5% overage tolerance)
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
          violations.push(`Allergen detected: "${item.name}" contains ${allergen}`)
        }
      }
    }
  }

  // 3. Medical diagnostic language check in explanation
  for (const pattern of MEDICAL_DIAGNOSTIC_PATTERNS) {
    if (pattern.test(explanation)) {
      violations.push(`Explanation contains disallowed medical language matching: ${pattern}`)
    }
  }

  // 4. Condition-specific nutrient caps
  const hasCKD = conditions.some(c => c.startsWith('ckd_') || c === 'dialysis')
  const hasHypertension = conditions.some(c => c.includes('hypertension'))

  if (hasCKD || hasHypertension) {
    // We can't easily check sodium per item without full nutrient DB,
    // but flag if the plan has high-sodium keywords
    const highSodiumPatterns = [/\bpickle\b/i, /\bpapad\b/i, /\bchips\b/i, /\bsalt(ed)?\b/i, /\bsoy sauce\b/i]
    for (const meal of meals) {
      for (const item of meal.items) {
        if (highSodiumPatterns.some(p => p.test(item.name))) {
          violations.push(`High-sodium food "${item.name}" flagged for hypertension/CKD condition`)
        }
      }
    }
  }

  // 5. No negative or zero calorie meals
  for (const meal of meals) {
    if (meal.totalCalories <= 0) {
      violations.push(`Meal ${meal.mealType} has invalid calorie count: ${meal.totalCalories}`)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
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
