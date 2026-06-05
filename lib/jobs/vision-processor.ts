import { Worker } from 'bullmq'
import { QUEUES, type VisionJobData } from './queue'
import { analyzeImage } from '@/lib/ai/vision-analyzer'
import { db } from '@/db/client'
import { visionJobs } from '@/db/schema'
import { eq } from 'drizzle-orm'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
}

export const visionWorker = new Worker<VisionJobData>(
  QUEUES.VISION,
  async (job) => {
    const start = Date.now()
    const { jobId, imageBase64, mediaType, cuisinePreference, country, region } = job.data

    await db.update(visionJobs).set({ status: 'PROCESSING' }).where(eq(visionJobs.id, jobId))

    const result = await analyzeImage({ imageBase64, mediaType, cuisinePreference, country, region })

    await db.update(visionJobs).set({
      status: 'COMPLETED', result: result as any, processingTimeMs: Date.now() - start,
      modelUsed: 'claude-opus-4-8', completedAt: new Date(),
    }).where(eq(visionJobs.id, jobId))

    return result
  },
  { connection, concurrency: 5 }
)

visionWorker.on('failed', async (job, err) => {
  if (!job) return
  await db.update(visionJobs)
    .set({ status: 'FAILED', errorMessage: err.message })
    .where(eq(visionJobs.id, (job.data as VisionJobData).jobId))
})
