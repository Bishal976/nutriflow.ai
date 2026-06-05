import type { GeneratedPlan } from './plan-generator'
import type { RebalanceResult } from './rebalancer'
import type { VisionAnalysisResult } from './vision-analyzer'

export function getMockPlan(input: { calories: number; proteinG: number; carbsG: number; fatG: number }): GeneratedPlan {
  return {
    meals: [
      {
        mealType: 'BREAKFAST',
        items: [
          { name: 'Oats porridge', quantity: '1 bowl (80g dry)', calories: 300, proteinG: 10, carbsG: 54, fatG: 6 },
          { name: 'Banana', quantity: '1 medium', calories: 90, proteinG: 1, carbsG: 23, fatG: 0 },
          { name: 'Almonds', quantity: '10 pieces', calories: 70, proteinG: 3, carbsG: 2, fatG: 6 },
        ],
        totalCalories: 460,
      },
      {
        mealType: 'LUNCH',
        items: [
          { name: 'Brown rice', quantity: '1 cup cooked', calories: 215, proteinG: 5, carbsG: 45, fatG: 2 },
          { name: 'Dal tadka', quantity: '1 katori (150ml)', calories: 150, proteinG: 9, carbsG: 20, fatG: 4 },
          { name: 'Mixed veg sabzi', quantity: '1 katori', calories: 100, proteinG: 3, carbsG: 12, fatG: 4 },
          { name: 'Curd', quantity: '1 small bowl', calories: 60, proteinG: 4, carbsG: 5, fatG: 2 },
        ],
        totalCalories: 525,
      },
      {
        mealType: 'EVENING_SNACK',
        items: [
          { name: 'Sprouts chaat', quantity: '1 bowl', calories: 120, proteinG: 8, carbsG: 18, fatG: 2 },
          { name: 'Green tea', quantity: '1 cup', calories: 5, proteinG: 0, carbsG: 1, fatG: 0 },
        ],
        totalCalories: 125,
      },
      {
        mealType: 'DINNER',
        items: [
          { name: 'Whole wheat roti', quantity: '2 rotis', calories: 200, proteinG: 6, carbsG: 40, fatG: 3 },
          { name: 'Paneer bhurji', quantity: '1 katori', calories: 200, proteinG: 14, carbsG: 6, fatG: 14 },
          { name: 'Salad', quantity: '1 plate', calories: 40, proteinG: 2, carbsG: 8, fatG: 0 },
        ],
        totalCalories: 440,
      },
    ],
    totalCalories: input.calories,
    totalProteinG: input.proteinG,
    totalCarbsG: input.carbsG,
    totalFatG: input.fatG,
    hydrationTip: 'Drink a glass of water 30 minutes before each meal to aid digestion and manage appetite.',
  }
}

export function getMockRebalance(): RebalanceResult {
  return {
    rebalanced_meals: [
      {
        meal_type: 'DINNER',
        items: [
          { name: 'Moong dal khichdi', quantity: '1 bowl', calories: 280, protein_g: 12, carbs_g: 45, fat_g: 5 },
          { name: 'Steamed broccoli', quantity: '1 cup', calories: 55, protein_g: 4, carbs_g: 10, fat_g: 0 },
        ],
        total_calories: 335,
      },
    ],
    explanation: 'Based on your remaining budget, a light khichdi with vegetables fits perfectly for dinner.',
    compliance_note: null,
    validationPassed: true,
    violations: [],
  }
}

export function getMockVisionResult(): VisionAnalysisResult {
  return {
    foods: [
      {
        name: 'Dal rice',
        household_quantity: '1 plate',
        quantity_grams_estimate: 350,
        calories_estimate: 450,
        protein_g: 14,
        carbs_g: 75,
        fat_g: 8,
        confidence: 0.85,
        visual_cues: 'Yellow lentil curry served over white rice on a plate',
      },
    ],
    meal_context: 'Home-cooked Indian lunch',
    lighting_quality: 'good',
    overall_confidence: 0.85,
  }
}
