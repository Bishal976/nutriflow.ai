// Canonical medical condition vocabulary. This is the single source of truth for
// condition codes — the onboarding picker (MedicalContextStep) and the document
// extraction mapper (condition-mapper.ts) both key off this list so a condition
// selected manually and one extracted from an uploaded document always collapse
// to the same code the deterministic engine (engine.ts) checks against.
export interface ConditionOption {
  code: string
  label: string
  group: string
}

export const CONDITIONS: ConditionOption[] = [
  { code: 'type2_diabetes_medicated', label: 'Type 2 Diabetes (on medication)', group: 'Metabolic' },
  { code: 'type1_diabetes', label: 'Type 1 Diabetes', group: 'Metabolic' },
  { code: 'hypertension_medicated', label: 'High Blood Pressure (on medication)', group: 'Cardiovascular' },
  { code: 'hypertension', label: 'High Blood Pressure (diet-managed)', group: 'Cardiovascular' },
  { code: 'ckd_stage3', label: 'Chronic Kidney Disease Stage 3', group: 'Kidney' },
  { code: 'ckd_stage4', label: 'Chronic Kidney Disease Stage 4', group: 'Kidney' },
  { code: 'ckd_stage5', label: 'Chronic Kidney Disease Stage 5', group: 'Kidney' },
  { code: 'dialysis', label: 'On Dialysis', group: 'Kidney' },
  { code: 'pregnancy', label: 'Pregnant', group: 'Reproductive' },
  { code: 'hypothyroid', label: 'Hypothyroidism', group: 'Hormonal' },
  { code: 'pcos', label: 'PCOS', group: 'Hormonal' },
  { code: 'celiac', label: 'Coeliac Disease', group: 'Digestive' },
  { code: 'ibs_severe', label: 'Irritable Bowel Syndrome (severe)', group: 'Digestive' },
  { code: 'severe_allergy_anaphylaxis', label: 'Severe Allergy (anaphylaxis history)', group: 'Allergy' },
  { code: 'eating_disorder', label: 'Eating Disorder (history or current)', group: 'Mental Health' },
]
