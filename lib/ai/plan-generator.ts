import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPlanSystemPrompt, buildPlanUserPrompt } from './prompts/plan'
import { validateRebalancedPlan } from '@/lib/nutrition/safety-validator'
import { conditionToRestrictions } from '@/lib/nutrition/condition-restrictions'
import { getMockPlan } from './mock-responses'
import type { MealPlanItem } from '@/types/api'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface PlanInput {
  calories: number; proteinG: number; carbsG: number; fatG: number
  dietType: string; allergens: string[]; cuisinePrefs: string[]
  dislikedIngredients: string[]; conditions: string[]
  waterMl: number; weatherNote?: string; userHint?: string
}

export interface GeneratedPlan {
  meals: MealPlanItem[]
  totalCalories: number; totalProteinG: number; totalCarbsG: number; totalFatG: number
  hydrationTip: string
}

export async function generateDayPlan(input: PlanInput): Promise<GeneratedPlan> {
  if (process.env.MOCK_AI === 'true') return getMockPlan(input)

  const conditionRestrictions = conditionToRestrictions(input.conditions)

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: buildPlanSystemPrompt(),
  })

  let lastErr: unknown
  let lastHardViolations: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1500))
    try {
      let text = (await model.generateContent(
        buildPlanUserPrompt({ ...input, conditionRestrictions })
      )).response.text().trim()

      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(text) as GeneratedPlan

      const validation = validateRebalancedPlan(
        parsed.meals.map(m => ({
          mealType: m.mealType,
          items: m.items.map(i => ({ name: i.name, quantity: i.quantity, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })),
          totalCalories: m.totalCalories,
        })),
        { calories: input.calories, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG },
        input.allergens,
        input.dietType,
        input.conditions,
        ''
      )

      // Hard violations (allergens, diet-type, medical language, structurally
      // invalid meals) must never reach the user — retry generation instead of
      // just logging and serving it anyway.
      if (validation.hardViolations.length > 0) {
        lastHardViolations = validation.hardViolations
        console.warn(`[plan-generator] Hard safety violations on attempt ${attempt + 1}, retrying:`, validation.hardViolations)
        continue
      }
      if (!validation.passed) {
        console.warn('[plan-generator] Soft validation warnings:', validation.violations)
      }

      return parsed
    } catch (err: any) {
      lastErr = err
      // Only retry on transient server-side errors (503 overload, 429 rate limit)
      const isRetryable = err?.status === 503 || err?.status === 429 ||
        (typeof err?.message === 'string' && (err.message.includes('503') || err.message.includes('429')))
      if (!isRetryable) throw err
      console.warn(`[plan-generator] Gemini ${err?.status ?? 'error'} on attempt ${attempt + 1}, retrying…`)
    }
  }
  if (lastHardViolations.length > 0) {
    throw new Error(`Generated plan failed safety validation after 3 attempts: ${lastHardViolations.join('; ')}`)
  }
  throw lastErr
}
