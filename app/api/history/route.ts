import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs, mealLogs, nutritionTargets } from '@/db/schema'
import { getUserPlan, FREE_LIMITS } from '@/lib/subscription'
import { eq, desc, gte, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const pageSize = 10

  const plan = await getUserPlan(session.userId)
  const isPro = plan === 'pro'

  const maxDays = isPro ? 365 : FREE_LIMITS.historyDays
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxDays)

  // Lightweight mode for the adherence heatmap — avoids per-day meal-aggregation
  // queries (which don't scale to a year of history) by reading the daily_logs'
  // own rolled-up actuals plus a single batched lookup of the targets they reference.
  if (url.searchParams.get('summary') === '1') {
    const summaryLogs = await db.query.dailyLogs.findMany({
      where: (t, { and }) => and(eq(t.userId, session.userId), gte(t.date, cutoff)),
      orderBy: [desc(dailyLogs.date)],
      columns: { date: true, actualCalories: true, nutritionTargetId: true },
    })
    const targetIds = [...new Set(summaryLogs.map(l => l.nutritionTargetId).filter((id): id is string => !!id))]
    const targets = targetIds.length
      ? await db.query.nutritionTargets.findMany({ where: inArray(nutritionTargets.id, targetIds), columns: { id: true, targetCalories: true } })
      : []
    const targetMap = new Map(targets.map(t => [t.id, t.targetCalories]))
    return NextResponse.json({
      summary: summaryLogs.map(l => ({
        date: l.date,
        totalCaloriesLogged: l.actualCalories ?? 0,
        targetCalories: (l.nutritionTargetId && targetMap.get(l.nutritionTargetId)) ?? null,
      })),
      plan,
    })
  }

  const logs = await db.query.dailyLogs.findMany({
    where: (t, { and }) => and(eq(t.userId, session.userId), gte(t.date, cutoff)),
    orderBy: [desc(dailyLogs.date)],
    limit: pageSize + 1,
    offset,
  })

  const hasMore = logs.length > pageSize
  const page = logs.slice(0, pageSize)

  const result = await Promise.all(page.map(async (log) => {
    const meals = await db.query.mealLogs.findMany({
      where: eq(mealLogs.dailyLogId, log.id),
    })
    const target = log.nutritionTargetId
      ? await db.query.nutritionTargets.findFirst({ where: eq(nutritionTargets.id, log.nutritionTargetId) })
      : null
    const confirmedMeals = meals.filter(m => m.userConfirmed)
    const totalCalories = confirmedMeals.reduce((sum, m) => sum + (m.estimatedCalories ?? 0), 0)
    return {
      id: log.id,
      date: log.date,
      totalCaloriesLogged: totalCalories,
      targetCalories: target?.targetCalories ?? null,
      mealCount: confirmedMeals.length,
    }
  }))

  return NextResponse.json({ logs: result, plan, hasMore, historyDays: isPro ? 365 : FREE_LIMITS.historyDays })
}
