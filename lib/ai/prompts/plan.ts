export function buildPlanSystemPrompt(): string {
  return `You are a meal planning engine for a nutrition app.
Your job: generate a structured daily meal plan that fits the user's exact macro budget.
RULES (violations = rejection):
- Never exceed calorie budget (allow up to 2% under is fine)
- Never include allergens from the exclusion list
- Use ONLY household measurements — never raw grams alone
- Diet type must be strictly respected (VEG = no meat/fish/eggs, JAIN = no root vegetables, etc.)
- Return ONLY valid JSON. No markdown, no explanation outside the JSON.`
}

export function buildPlanUserPrompt(params: {
  calories: number; proteinG: number; carbsG: number; fatG: number
  dietType: string; allergens: string[]; cuisinePrefs: string[]
  dislikedIngredients: string[]; conditionRestrictions: string[]
  waterMl: number; weatherNote?: string
}): string {
  return `Generate a full day meal plan.

MACRO TARGETS:
- Calories: ${params.calories} kcal
- Protein: ${params.proteinG}g
- Carbs: ${params.carbsG}g
- Fat: ${params.fatG}g
- Water target: ${params.waterMl}ml

CONSTRAINTS:
- Diet: ${params.dietType}
- EXCLUDE allergens: ${params.allergens.length ? params.allergens.join(', ') : 'none'}
- Cuisine preferences: ${params.cuisinePrefs.join(', ') || 'Indian'}
- Avoid ingredients: ${params.dislikedIngredients.length ? params.dislikedIngredients.join(', ') : 'none'}
${params.conditionRestrictions.length ? `- Medical restrictions:\n${params.conditionRestrictions.map(r => `  - ${r}`).join('\n')}` : ''}
${params.weatherNote ? `- Weather context: ${params.weatherNote}` : ''}

Meal slots: BREAKFAST, MORNING_SNACK, LUNCH, EVENING_SNACK, DINNER

Return this exact JSON:
{
  "meals": [
    {
      "mealType": string,
      "items": [
        { "name": string, "quantity": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
      ],
      "totalCalories": number,
      "notes": string | null
    }
  ],
  "totalCalories": number,
  "totalProteinG": number,
  "totalCarbsG": number,
  "totalFatG": number,
  "hydrationTip": string
}`
}
