import type { MedicalConditionCode } from '@/lib/nutrition/engine'

interface RebalancePromptParams {
  remainingCalories: number
  remainingProteinG: number
  remainingCarbsG: number
  remainingFatG: number
  allergens: string[]
  dietType: string
  cuisinePrefs: string[]
  dislikedIngredients: string[]
  remainingMealSlots: string[]
  conditions: MedicalConditionCode[]
  conditionRestrictions: string[]
  weatherNote?: string
}

export function buildRebalanceSystemPrompt(): string {
  return `You are a meal planning assistant. The user has already eaten and deviated from their nutrition target.
Your job: suggest remaining meals for the day within the provided budget.
STRICT RULES — violations will cause your response to be rejected:
1. Never exceed the calorie budget.
2. Never include any allergen from the exclusion list.
3. Never provide medical advice, diagnoses, or medication guidance.
4. Always use household measurements (cups, katoris, tablespoons, pieces — never just grams).
5. Return ONLY valid JSON. No markdown, no text outside the JSON.`
}

export function buildRebalanceUserPrompt(params: RebalancePromptParams): string {
  const conditionText = params.conditionRestrictions.length > 0
    ? `\nCONDITION-SPECIFIC RESTRICTIONS:\n${params.conditionRestrictions.map(r => `- ${r}`).join('\n')}`
    : ''

  return `Suggest meals for the remaining slots of the day within these HARD LIMITS:

REMAINING BUDGET:
- Calories: ${params.remainingCalories} kcal
- Protein: ${params.remainingProteinG}g
- Carbs: ${params.remainingCarbsG}g
- Fat: ${params.remainingFatG}g

CONSTRAINTS:
- Diet type: ${params.dietType}
- EXCLUDE allergens: ${params.allergens.length > 0 ? params.allergens.join(', ') : 'none'}
- Cuisine preferences: ${params.cuisinePrefs.join(', ')}
- Avoid ingredients: ${params.dislikedIngredients.length > 0 ? params.dislikedIngredients.join(', ') : 'none'}
- Remaining meal slots: ${params.remainingMealSlots.join(', ')}${conditionText}${params.weatherNote ? `\n- Weather context: ${params.weatherNote}` : ''}

Return this exact JSON:
{
  "rebalanced_meals": [
    {
      "meal_type": string,
      "items": [
        {
          "name": string,
          "quantity": string,
          "calories": number,
          "protein_g": number,
          "carbs_g": number,
          "fat_g": number
        }
      ],
      "total_calories": number
    }
  ],
  "explanation": string,
  "compliance_note": string | null
}`
}
