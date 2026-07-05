import { db } from '@/db/client'
import { users, mealLogs } from '@/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'

export const FREE_LIMITS = {
  dailyMealLogs: 3,
  historyDays: 7,
  medicalDocuments: 1,
}

export const PRO_LIMITS = {
  medicalDocuments: 20,
}

export type Plan = 'free' | 'pro'

export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true, planExpiresAt: true },
  })
  if (!user || user.plan !== 'pro') return 'free'
  if (user.planExpiresAt && user.planExpiresAt < new Date()) return 'free'
  return 'pro'
}

export async function getDailyMealLogCount(userId: string): Promise<number> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), gte(mealLogs.loggedAt, today)))
  return result[0]?.count ?? 0
}

export function upgradeRequired(feature: string, message: string) {
  return Response.json({ error: message, upgrade: true, feature }, { status: 402 })
}
