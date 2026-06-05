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
  return rules
}

export async function generateDayPlan(input: PlanInput): Promise<GeneratedPlan> {
  if (process.env.MOCK_AI === 'true') return getMockPlan(input)

  const conditionRestrictions = conditionToRestrictions(input.conditions)

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: buildPlanSystemPrompt(),
  })

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
}
