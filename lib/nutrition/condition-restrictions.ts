// Shared by both post-meal-log regeneration routes (/api/plan/rebalance and
// /api/meals/manual) — was duplicated identically in both before being extracted here.
export function conditionToRestrictions(codes: string[]): string[] {
  const r: string[] = []
  if (codes.some(c => c.startsWith('ckd_') || c === 'dialysis')) r.push('Restrict potassium and phosphorus — no bananas, nuts, excessive dairy')
  if (codes.some(c => c.includes('hypertension'))) r.push('Sodium < 800mg remaining in day')
  if (codes.some(c => c.includes('diabetes'))) r.push('Prefer low-GI carbohydrates, avoid refined sugars')
  return r
}
