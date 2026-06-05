import { Queue } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
}

export const QUEUES = {
  VISION: 'vision-analysis',
  OCR: 'ocr-processing',
} as const

export const visionQueue = new Queue(QUEUES.VISION, { connection })
export const ocrQueue = new Queue(QUEUES.OCR, { connection })

export interface VisionJobData {
  jobId: string; userId: string; imageStorageKey: string; imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  cuisinePreference: string[]; country: string; region?: string
}

export interface OCRJobData {
  documentId: string; userId: string; storageKey: string; rawText: string
}

export async function enqueueVisionJob(data: VisionJobData): Promise<string> {
  const job = await visionQueue.add('analyze', data, {
    attempts: 3, backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 }, removeOnFail: { count: 50 },
  })
  return job.id!
}

export async function enqueueOCRJob(data: OCRJobData): Promise<string> {
  const job = await ocrQueue.add('parse', data, {
    attempts: 3, backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 }, removeOnFail: { count: 50 },
  })
  return job.id!
}
