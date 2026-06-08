import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ExtractedLabValue {
  name: string
  value: string
  unit: string
  referenceRange?: string
  flag?: 'low' | 'high' | 'normal'
}

export interface ExtractedDocument {
  documentType: 'lab_report' | 'prescription' | 'discharge_summary' | 'other'
  medications: Array<{ name: string; dose?: string; frequency?: string }>
  labValues: ExtractedLabValue[]
  conditions: string[]
  confidence: number
  rawSummary: string
}

const SYSTEM_PROMPT = `You are a medical document parser. Extract structured data from prescriptions and lab reports.
Return ONLY valid JSON matching the requested schema. Never add markdown fences. If a field is not present, use an empty array or null.`

const USER_PROMPT = `Extract all medical information from this document and return JSON in this exact shape:
{
  "documentType": "lab_report" | "prescription" | "discharge_summary" | "other",
  "medications": [{ "name": string, "dose": string|null, "frequency": string|null }],
  "labValues": [{ "name": string, "value": string, "unit": string, "referenceRange": string|null, "flag": "low"|"high"|"normal"|null }],
  "conditions": [string],
  "confidence": 0.0-1.0,
  "rawSummary": "one sentence summary of the document"
}

Focus on: HbA1c, fasting glucose, creatinine, urea, cholesterol (total/LDL/HDL), triglycerides, haemoglobin, TSH, uric acid, ALT, AST, eGFR. Include any others present.`

export async function extractMedicalDocument(params: {
  fileBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
}): Promise<ExtractedDocument> {
  if (process.env.MOCK_AI === 'true') {
    return {
      documentType: 'lab_report',
      medications: [{ name: 'Metformin', dose: '500mg', frequency: 'twice daily' }],
      labValues: [
        { name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6', flag: 'high' },
        { name: 'Fasting Glucose', value: '118', unit: 'mg/dL', referenceRange: '70-100', flag: 'high' },
      ],
      conditions: ['Type 2 Diabetes'],
      confidence: 0.95,
      rawSummary: 'Mock lab report showing elevated HbA1c and fasting glucose.',
    }
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent([
    { inlineData: { data: params.fileBase64, mimeType: params.mimeType } },
    { text: USER_PROMPT },
  ])

  let text = result.response.text().trim()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

  const parsed = JSON.parse(text) as ExtractedDocument
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0))
  return parsed
}
