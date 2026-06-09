import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPlanSystemPrompt, buildPlanUserPrompt } from './prompts/plan'
import { validateRebalancedPlan } from '@/lib/nutrition/safety-validator'
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

function conditionToRestrictions(conditions: string[]): string[] {
  const rules: string[] = []
  if (conditions.some(c => c.startsWith('ckd_') || c === 'dialysis')) {
    rules.push('Restrict potassium-rich foods (bananas, oranges, potatoes, tomatoes in large amounts)')
    rules.push('Avoid high-phosphorus foods (dairy in excess, nuts, seeds, cola drinks)')
  }
  if (conditions.some(c => c.includes('hypertension'))) {
    rules.push('Keep sodium below 1500mg total — avoid pickles, papad, processed snacks')
  }
  if (conditions.includes('type2_diabetes_medicated') || conditions.includes('type1_diabetes')) {
    rules.push('Prefer low-GI carbohydrates — millets, oats, whole wheat over refined flour')
    rules.push('Distribute carbs evenly across meals, no large single-meal carb load')
  }
  if (conditions.includes('pregnancy')) {
    rules.push('No calorie deficit. Include folate-rich foods: leafy greens, lentils, citrus')
    rules.push('Avoid raw/undercooked foods, high-mercury fish, excess vitamin A supplements')
  }
  if (conditions.some(c => ['eating_disorder', 'anorexia', 'bulimia'].includes(c))) {
    rules.push('No calorie deficit — frame portions around nourishment and consistency, never restriction')
    rules.push('Do not use language like "cutting", "restriction", "cheat meal", or weight-loss framing anywhere in meal names or notes')
    rules.push('Do not suggest skipping meals, replacing meals with shakes, or unusually small portions')
  }
  return rules
}

export async function generateDayPlan(input: PlanInput): Promise<GeneratedPlan> {
  if (process.env.MOCK_AI === 'true') return getMockPlan(input)

  const conditionRestrictions = conditionToRestrictions(input.conditions)

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: buildPlanSystemPrompt(),
  })

  let lastErr: unknown
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
        input.conditions,
        ''
      )

      if (!validation.passed) {
        console.warn('[plan-generator] Validation warnings:', validation.violations)
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
  throw lastErr
}
