// Single source of truth for "condition code(s) → plain-language dietary
// restriction text fed into the AI prompt". Used by every meal-generation
// path — initial plan (lib/ai/plan-generator.ts), hint/regenerate (same
// path), and post-meal-log rebalance (/api/plan/rebalance, /api/meals/manual)
// — so a condition's safety framing can't drift between "the plan you start
// the day with" and "the plan you get after logging a meal." This used to be
// two separately-maintained copies; the rebalance-path copy was missing the
// pregnancy and eating-disorder rules entirely.
export function conditionToRestrictions(codes: string[]): string[] {
  const r: string[] = []

  if (codes.some(c => c.startsWith('ckd_') || c === 'dialysis' || c === 'ckd_unspecified')) {
    r.push('Restrict potassium-rich foods (bananas, oranges, potatoes, tomatoes in large amounts)')
    r.push('Avoid high-phosphorus foods (dairy in excess, nuts, seeds, cola drinks)')
  }
  if (codes.some(c => c.includes('hypertension'))) {
    r.push('Keep sodium below 1500mg total — avoid pickles, papad, processed snacks, excess salt')
  }
  if (codes.some(c => c.includes('diabetes'))) {
    r.push('Prefer low-GI carbohydrates — millets, oats, whole wheat over refined flour')
    r.push('Distribute carbs evenly across meals, no large single-meal carb load')
  }
  if (codes.some(c => c.includes('high_cholesterol') || c.includes('fatty_liver'))) {
    r.push('Avoid deep-fried foods, organ meats, and excess ghee/butter — prefer lean protein and grilled/steamed/sauteed preparation')
    r.push('Favour high-fibre foods (oats, legumes, vegetables) and omega-3 sources (fish, walnuts, flaxseed) over saturated fat')
  }
  if (codes.some(c => c.includes('lactose_intolerance'))) {
    r.push('Avoid dairy — milk, cheese, paneer, ghee, curd, cream. Lactose-free or plant-based alternatives are fine')
  }
  if (codes.some(c => c.includes('gerd'))) {
    r.push('Avoid excess spice, deep-fried food, caffeine, and citrus — prefer smaller, more frequent meals over large ones, especially close to bedtime')
  }
  if (codes.some(c => c.includes('anemia'))) {
    r.push('Emphasise iron-rich foods (leafy greens, lentils, jaggery, dates) paired with vitamin C (citrus, tomato) to aid absorption')
  }
  if (codes.some(c => c.includes('hyperthyroidism'))) {
    r.push('Keep iodine-rich foods (iodized salt, seaweed) moderate rather than excessive')
  }
  if (codes.includes('pregnancy')) {
    r.push('No calorie deficit. Include folate-rich foods: leafy greens, lentils, citrus')
    r.push('Avoid raw/undercooked foods, high-mercury fish, excess vitamin A supplements')
  }
  if (codes.some(c => ['eating_disorder', 'anorexia', 'bulimia'].includes(c))) {
    r.push('No calorie deficit — frame portions around nourishment and consistency, never restriction')
    r.push('Do not use language like "cutting", "restriction", "cheat meal", or weight-loss framing anywhere in meal names or notes')
    r.push('Do not suggest skipping meals, replacing meals with shakes, or unusually small portions')
  }

  return r
}
