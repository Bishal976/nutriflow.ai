import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs, mealLogs, nutritionTargets } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await db.query.dailyLogs.findMany({
    where: eq(dailyLogs.userId, session.userId),
    orderBy: [desc(dailyLogs.date)],
    limit: 30,
  })

  const result = await Promise.all(logs.map(async (log) => {
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

  return NextResponse.json({ logs: result })
}
