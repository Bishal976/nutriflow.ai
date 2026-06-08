export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'
export type Goal = 'WEIGHT_LOSS' | 'WEIGHT_GAIN' | 'MAINTENANCE' | 'MUSCLE_GAIN' | 'CONDITION_MANAGEMENT'
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type MealType = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'EVENING_SNACK' | 'DINNER'
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type DietType = 'VEG' | 'NON_VEG' | 'VEGAN' | 'JAIN' | 'EGGETARIAN' | 'PESCATARIAN'

export interface DemographicsPayload {
  firstName: string; lastName: string; dateOfBirth: string
  sex: 'male' | 'female' | 'other'; heightCm: number; weightKg: number; activityLevel: ActivityLevel
}
export interface GoalsPayload { primaryGoal: Goal; targetWeightKg?: number }
export interface MedicalContextPayload {
  conditions: Array<{ conditionCode: string; conditionLabel: string; onMedication: boolean; severity?: 'mild' | 'moderate' | 'severe' }>
}
export interface DietaryPrefsPayload {
  dietType: DietType; allergens: string[]; cuisinePreferences: string[]; dislikedIngredients: string[]
}
export interface LocationPayload { city: string; country: string; timezone: string; lat?: number; lon?: number }

export interface IntakeRequest {
  step: 1 | 2 | 3 | 4 | 5 | 6
  data: DemographicsPayload | GoalsPayload | MedicalContextPayload | DietaryPrefsPayload | LocationPayload
}

export interface NutritionTargetSummary {
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; waterMl: number; weatherNote?: string
}

export interface IntakeResponse {
  success: boolean; onboardingComplete: boolean; riskLevel: RiskLevel
  nextStep?: number
  generatedTargets?: NutritionTargetSummary; warnings: string[]
}

export interface FoodItem {
  name: string; householdQuantity: string; quantityGramsEstimate: number
  caloriesEstimate: number; proteinG: number; carbsG: number; fatG: number
  confidence: number; visualCues: string
}

export interface VisionAnalysisResult {
  foods: FoodItem[]; mealContext: string; overallConfidence: number
  lightingQuality: 'good' | 'poor' | 'obscured'
}

export interface VisionStatusResponse { jobId: string; status: JobStatus; result?: VisionAnalysisResult; error?: string }

export interface RebalanceRequest { dailyLogId: string; mealLogId: string; confirmedFoods: FoodItem[] }

export interface RebalancedMeal {
  mealType: string
  items: Array<{ name: string; quantity: string; calories: number; proteinG: number; carbsG: number; fatG: number }>
  totalCalories: number
}

export interface RebalanceResponse {
  success: boolean
  deviation: { deltaCalories: number; deltaProteinG: number; deltaCarbsG: number; deltaFatG: number; severity: 'minor' | 'moderate' | 'significant' }
  rebalancedMeals: RebalancedMeal[]; explanation: string; complianceNote: string | null
}

export interface MealPlanItem {
  mealType: MealType
  items: Array<{ name: string; quantity: string; calories: number; proteinG: number; carbsG: number; fatG: number }>
  totalCalories: number; notes?: string
}
