import type { GeneratedPlan } from './plan-generator'
import type { RebalanceResult } from './rebalancer'
import type { VisionAnalysisResult } from './vision-analyzer'

export function getMockPlan(input: { calories: number; proteinG: number; carbsG: number; fatG: number }): GeneratedPlan {
  return {
    meals: [
      {
        mealType: 'BREAKFAST',
        items: [
          { name: 'Vegetable poha', quantity: '1 bowl (150g)', calories: 250, proteinG: 6, carbsG: 45, fatG: 5 },
          { name: 'Boiled egg', quantity: '2 whole', calories: 140, proteinG: 12, carbsG: 1, fatG: 10 },
          { name: 'Masala chai', quantity: '1 cup (low sugar)', calories: 40, proteinG: 2, carbsG: 5, fatG: 2 },
        ],
        totalCalories: 430,
        notes: 'Poha is light, quick to digest, and keeps you energised through the morning.',
      },
      {
        mealType: 'MORNING_SNACK',
        items: [
          { name: 'Mixed fruit bowl', quantity: '1 bowl (200g)', calories: 120, proteinG: 2, carbsG: 28, fatG: 0 },
          { name: 'Roasted makhana', quantity: '1 handful (25g)', calories: 90, proteinG: 3, carbsG: 18, fatG: 1 },
        ],
        totalCalories: 210,
        notes: 'Makhana provides a light protein hit without spiking blood sugar.',
      },
      {
        mealType: 'LUNCH',
        items: [
          { name: 'Brown rice', quantity: '1 cup cooked (180g)', calories: 215, proteinG: 5, carbsG: 45, fatG: 2 },
          { name: 'Dal tadka', quantity: '1 katori (150ml)', calories: 150, proteinG: 9, carbsG: 20, fatG: 4 },
          { name: 'Palak paneer', quantity: '1 katori (120g)', calories: 180, proteinG: 10, carbsG: 8, fatG: 12 },
          { name: 'Cucumber raita', quantity: '1 small bowl (100g)', calories: 55, proteinG: 3, carbsG: 6, fatG: 2 },
        ],
        totalCalories: 600,
        notes: 'Palak paneer provides iron, calcium, and a full amino acid profile from paneer.',
      },
      {
        mealType: 'EVENING_SNACK',
        items: [
          { name: 'Sprouts chaat', quantity: '1 bowl (150g)', calories: 130, proteinG: 8, carbsG: 20, fatG: 2 },
          { name: 'Green tea', quantity: '1 cup (unsweetened)', calories: 2, proteinG: 0, carbsG: 0, fatG: 0 },
        ],
        totalCalories: 132,
        notes: 'Sprouted moong has nearly double the protein of uncooked moong.',
      },
      {
        mealType: 'DINNER',
        items: [
          { name: 'Whole wheat roti', quantity: '2 medium rotis', calories: 200, proteinG: 6, carbsG: 40, fatG: 3 },
          { name: 'Rajma masala', quantity: '1 katori (150ml)', calories: 190, proteinG: 11, carbsG: 28, fatG: 4 },
          { name: 'Onion-tomato salad', quantity: '1 plate', calories: 35, proteinG: 1, carbsG: 7, fatG: 0 },
        ],
        totalCalories: 425,
        notes: 'Rajma is one of the best plant-based complete protein sources. Eat at least 90 min before bed.',
      },
    ],
    totalCalories: input.calories,
    totalProteinG: input.proteinG,
    totalCarbsG: input.carbsG,
    totalFatG: input.fatG,
    hydrationTip: 'Aim for a glass of water 20–30 min before each meal. On warm days, add electrolyte-rich drinks like coconut water or nimbu pani.',
  }
}

export function getMockRebalance(): RebalanceResult {
  return {
    rebalanced_meals: [
      {
        meal_type: 'EVENING_SNACK',
        items: [
          { name: 'Roasted chana', quantity: '2 tablespoons (30g)', calories: 100, protein_g: 6, carbs_g: 16, fat_g: 2 },
        ],
        total_calories: 100,
      },
      {
        meal_type: 'DINNER',
        items: [
          { name: 'Moong dal khichdi', quantity: '1 bowl (200g)', calories: 260, protein_g: 11, carbs_g: 42, fat_g: 5 },
          { name: 'Steamed broccoli', quantity: '1 cup (90g)', calories: 55, protein_g: 4, carbs_g: 10, fat_g: 0 },
        ],
        total_calories: 315,
      },
    ],
    explanation: 'Your lunch was ~180 kcal above target. I\'ve lightened your evening snack and switched dinner to a simpler khichdi to bring the day back on track.',
    compliance_note: null,
    validationPassed: true,
    violations: [],
  }
}

export function getMockVisionResult(): VisionAnalysisResult {
  return {
    foods: [
      {
        name: 'Dal tadka',
        household_quantity: '1 katori',
        quantity_grams_estimate: 150,
        calories_estimate: 155,
        protein_g: 9,
        carbs_g: 21,
        fat_g: 4,
        confidence: 0.88,
        visual_cues: 'Yellow lentil curry with mustard seed and curry leaf tempering, served in a steel bowl',
      },
      {
        name: 'Steamed basmati rice',
        household_quantity: '1 cup cooked',
        quantity_grams_estimate: 175,
        calories_estimate: 225,
        protein_g: 4,
        carbs_g: 48,
        fat_g: 1,
        confidence: 0.92,
        visual_cues: 'Fluffy white rice, loose grains, visible on a plate',
      },
    ],
    meal_context: 'Classic Indian home-cooked dal-rice lunch',
    lighting_quality: 'good',
    overall_confidence: 0.90,
  }
}
