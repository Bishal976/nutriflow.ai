export function buildVisionSystemPrompt(): string {
  return `You are a nutrition analysis engine. Your ONLY job is structured food identification from images.
Return ONLY valid JSON. Never include markdown fences or any text outside the JSON object.
Never mention disease, diagnose conditions, or give medical advice.
If a food item is unidentifiable, set confidence below 0.4 and name it "Unknown item".
Be conservative with portion estimates — it is better to slightly underestimate than overestimate.`
}

export function buildVisionUserPrompt(params: {
  cuisinePreference: string[]
  country: string
  region?: string
}): string {
  const cuisine = params.cuisinePreference.join(', ') || 'Indian'
  return `Analyze this meal photo.

The user's cuisine context is: ${cuisine}
Location: ${params.country}${params.region ? ` / ${params.region}` : ''}

Translate ALL quantities into household measurements common in this region.
Use relatable units: "katori" (small bowl ~150ml), "cup" (~240ml), "medium roti" (~30g), "tablespoon", "piece", "slice", "plate" etc.

Return this exact JSON structure:
{
  "foods": [
    {
      "name": string,
      "household_quantity": string,
      "quantity_grams_estimate": number,
      "calories_estimate": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": number,
      "visual_cues": string
    }
  ],
  "meal_context": string,
  "lighting_quality": "good" | "poor" | "obscured",
  "overall_confidence": number
}`
}
