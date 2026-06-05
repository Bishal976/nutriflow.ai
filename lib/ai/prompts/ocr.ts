export function buildOCRSystemPrompt(): string {
  return `You are a medical document parser. Your ONLY job is to extract structured data from documents.
Do NOT interpret, diagnose, or provide clinical opinions of any kind.
Do NOT recommend any action based on the values you extract.
Mark any field you are uncertain about with a confidence score below 0.7.
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`
}

export function buildOCRUserPrompt(rawText: string): string {
  return `Extract structured information from this medical document text:

---
${rawText}
---

Return this exact JSON structure:
{
  "document_type": "prescription" | "lab_report" | "discharge_summary" | "unknown",
  "extracted_fields": {
    "medications": [
      { "name": string, "dosage": string, "frequency": string, "confidence": number }
    ],
    "lab_values": [
      { "test_name": string, "value": string, "unit": string, "reference_range": string, "confidence": number }
    ],
    "diagnosed_conditions": [
      { "name": string, "icd_hint": string, "confidence": number }
    ],
    "doctor_name": string | null,
    "date": string | null
  },
  "low_confidence_fields": string[],
  "overall_confidence": number,
  "requires_human_review": boolean
}`
}
