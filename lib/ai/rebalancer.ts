import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildRebalanceSystemPrompt, buildRebalanceUserPrompt } from './prompts/rebalance'
import { validateRebalancedPlan, sanitizeExplanation } from '@/lib/nutrition/safety-validator'
import { getMockRebalance } from './mock-responses'
import type { MedicalConditionCode } from '@/lib/nutrition/engine'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface RebalanceInput {
  remainingBudget: { calories: number; proteinG: number; carbsG: number; fatG: number }
  allergens: string[]; dietType: string; cuisinePrefs: string[]; dislikedIngredients: string[]
  remainingMealSlots: string[]; conditions: MedicalConditionCode[]
  conditionRestrictions: string[]; weatherNote?: string
}

export interface RebalancedMeal {
  meal_type: string
  items: Array<{ name: string; quantity: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  total_calories: number
}

export interface RebalanceResult {
  rebalanced_meals: RebalancedMeal[]
  explanation: string
  compliance_note: string | null
  validationPassed: boolean
  violations: string[]
  hardViolations: string[]
}

export async function generateRebalancedPlan(input: RebalanceInput): Promise<RebalanceResult> {
  if (process.env.MOCK_AI === 'true') return getMockRebalance()

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: buildRebalanceSystemPrompt(),
  })

  let lastErr: unknown
  let lastResult: RebalanceResult | undefined

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1500))
    try {
      let text = (await model.generateContent(
        buildRebalanceUserPrompt({
          remainingCalories: input.remainingBudget.calories,
          remainingProteinG: input.remainingBudget.proteinG,
          remainingCarbsG: input.remainingBudget.carbsG,
          remainingFatG: input.remainingBudget.fatG,
          allergens: input.allergens,
          dietType: input.dietType,
          cuisinePrefs: input.cuisinePrefs,
          dislikedIngredients: input.dislikedIngredients,
          remainingMealSlots: input.remainingMealSlots,
          conditions: input.conditions,
          conditionRestrictions: input.conditionRestrictions,
          weatherNote: input.weatherNote,
        })
      )).response.text().trim()

      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

      const parsed = JSON.parse(text) as {
        rebalanced_meals: RebalancedMeal[]
        explanation: string
        compliance_note: string | null
      }

      const validation = validateRebalancedPlan(
        parsed.rebalanced_meals.map(m => ({
          mealType: m.meal_type,
          items: m.items.map(i => ({ name: i.name, quantity: i.quantity, calories: i.calories, proteinG: i.protein_g, carbsG: i.carbs_g, fatG: i.fat_g })),
          totalCalories: m.total_calories,
        })),
        { calories: input.remainingBudget.calories, proteinG: input.remainingBudget.proteinG, carbsG: input.remainingBudget.carbsG, fatG: input.remainingBudget.fatG },
        input.allergens,
        input.dietType,
        input.conditions,
        parsed.explanation
      )

      lastResult = {
        rebalanced_meals: parsed.rebalanced_meals,
        explanation: sanitizeExplanation(parsed.explanation),
        compliance_note: parsed.compliance_note,
        validationPassed: validation.passed,
        violations: validation.violations,
        hardViolations: validation.hardViolations,
      }

      // Hard violations (allergens, diet-type, lactose/cholesterol hard blocks,
      // medical language, invalid meals) must never reach the user — retry
      // instead of just exposing them via validationPassed for the caller to
      // (possibly) ignore.
      if (validation.hardViolations.length > 0) {
        console.warn(`[rebalancer] Hard safety violations on attempt ${attempt + 1}, retrying:`, validation.hardViolations)
        continue
      }

      return lastResult
    } catch (err: any) {
      lastErr = err
      const isRetryable = err?.status === 503 || err?.status === 429 ||
        (typeof err?.message === 'string' && (err.message.includes('503') || err.message.includes('429')))
      if (!isRetryable) throw err
      console.warn(`[rebalancer] Gemini ${err?.status ?? 'error'} on attempt ${attempt + 1}, retrying…`)
    }
  }

  if (lastResult) {
    // Exhausted retries and still has hard violations — better to surface a
    // clearly-flagged result than throw away the only response we have; the
    // caller checks hardViolations and must not silently ignore it.
    return lastResult
  }
  throw lastErr
}
