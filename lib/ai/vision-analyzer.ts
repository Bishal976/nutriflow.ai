import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildVisionSystemPrompt, buildVisionUserPrompt } from './prompts/vision'
import { getMockVisionResult } from './mock-responses'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface VisionFoodItem {
  name: string
  household_quantity: string
  quantity_grams_estimate: number
  calories_estimate: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: number
  visual_cues: string
}

export interface VisionAnalysisResult {
  foods: VisionFoodItem[]
  meal_context: string
  lighting_quality: 'good' | 'poor' | 'obscured'
  overall_confidence: number
}

// Maps raw provider/parse errors to a message safe to show a user — never leak
// Gemini's raw error body (quota JSON, stack traces) into the UI.
export function toFriendlyVisionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/429|quota|rate.?limit/i.test(raw)) {
    return "We're getting a lot of requests right now. Please wait a minute and try again."
  }
  if (/network|fetch failed|ECONNRESET|ETIMEDOUT/i.test(raw)) {
    return 'Network error while analysing your photo. Please try again.'
  }
  return "We couldn't analyse that photo. Please try again with a clearer picture."
}

export async function analyzeImage(params: {
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  cuisinePreference: string[]
  country: string
  region?: string
}): Promise<VisionAnalysisResult> {
  if (process.env.MOCK_AI === 'true') return getMockVisionResult()

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: buildVisionSystemPrompt(),
  })

  const prompt = buildVisionUserPrompt({
    cuisinePreference: params.cuisinePreference,
    country: params.country,
    region: params.region,
  })

  const result = await model.generateContent([
    { inlineData: { data: params.imageBase64, mimeType: params.mediaType } },
    { text: prompt },
  ])

  let text = result.response.text().trim()
  // Strip markdown fences if model adds them
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

  const parsed = JSON.parse(text) as VisionAnalysisResult

  parsed.overall_confidence = Math.max(0, Math.min(1, parsed.overall_confidence))
  parsed.foods = parsed.foods.map(f => ({
    ...f,
    confidence: Math.max(0, Math.min(1, f.confidence)),
  }))

  return parsed
}
