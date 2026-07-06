// Maps freeform condition names returned by AI document extraction (Gemini reads
// a prescription/lab report and writes whatever phrase it sees, e.g. "Type 2
// Diabetes" or "Chronic Kidney Disease Stage 3") onto the canonical condition
// codes in conditions.ts that classifyRisk/computeMacroTargets/computeMicroTargets
// actually check against. A naive slugify of the raw label (e.g. "type_2_diabetes")
// never matches the canonical "type2_diabetes_medicated" and silently no-ops every
// condition-specific safety adjustment — that mismatch is what this closes.
// Falls back to a slugified label for anything unrecognized so it's still stored
// and visible to the user, even though it won't trigger a specific adjustment
// until they confirm a canonical condition via the onboarding picker.
export function mapExtractedConditionToCode(rawLabel: string): { code: string; label: string } {
  const s = rawLabel.toLowerCase()

  if (/\btype\s*1\b/.test(s) && /diabet/.test(s)) {
    return { code: 'type1_diabetes', label: 'Type 1 Diabetes' }
  }
  if (/diabet/.test(s)) {
    return { code: 'type2_diabetes_medicated', label: 'Type 2 Diabetes (on medication)' }
  }
  if (/dialysis/.test(s)) {
    return { code: 'dialysis', label: 'On Dialysis' }
  }
  if (/(chronic kidney disease|\bckd\b|kidney disease|renal failure)/.test(s)) {
    const stage = s.match(/stage\s*(\d)/)?.[1]
    return stage
      ? { code: `ckd_stage${stage}`, label: `Chronic Kidney Disease Stage ${stage}` }
      : { code: 'ckd_unspecified', label: 'Chronic Kidney Disease' }
  }
  if (/(hypertension|high blood pressure)/.test(s)) {
    return { code: 'hypertension_medicated', label: 'High Blood Pressure (on medication)' }
  }
  if (/pregnan/.test(s)) {
    return { code: 'pregnancy', label: 'Pregnant' }
  }
  if (/hypothyroid/.test(s)) {
    return { code: 'hypothyroid', label: 'Hypothyroidism' }
  }
  if (/(pcos|polycystic ovar)/.test(s)) {
    return { code: 'pcos', label: 'PCOS' }
  }
  if (/(coeliac|celiac)/.test(s)) {
    return { code: 'celiac', label: 'Coeliac Disease' }
  }
  if (/(irritable bowel|\bibs\b)/.test(s)) {
    return { code: 'ibs_severe', label: 'Irritable Bowel Syndrome (severe)' }
  }
  if (/anaphylaxis/.test(s)) {
    return { code: 'severe_allergy_anaphylaxis', label: 'Severe Allergy (anaphylaxis history)' }
  }
  if (/anorexia/.test(s)) {
    return { code: 'anorexia', label: 'Anorexia' }
  }
  if (/bulimia/.test(s)) {
    return { code: 'bulimia', label: 'Bulimia' }
  }
  if (/eating disorder/.test(s)) {
    return { code: 'eating_disorder', label: 'Eating Disorder (history or current)' }
  }
  if (/cirrhosis/.test(s)) {
    return { code: 'liver_cirrhosis', label: 'Liver Cirrhosis' }
  }
  if (/heart failure/.test(s)) {
    return { code: 'heart_failure', label: 'Heart Failure' }
  }

  return { code: s.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), label: rawLabel }
}
