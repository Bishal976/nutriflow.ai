import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs, mealLogs, nutritionTargets } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { logId } = await params

  const log = await db.query.dailyLogs.findFirst({
    where: and(eq(dailyLogs.id, logId), eq(dailyLogs.userId, session.userId)),
  })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [meals, target] = await Promise.all([
    db.query.mealLogs.findMany({
      where: and(eq(mealLogs.dailyLogId, log.id), eq(mealLogs.userConfirmed, true)),
      orderBy: [asc(mealLogs.loggedAt)],
    }),
    log.nutritionTargetId
      ? db.query.nutritionTargets.findFirst({ where: eq(nutritionTargets.id, log.nutritionTargetId) })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    date: log.date,
    target: target ? {
      targetCalories: target.targetCalories,
      targetProteinG: target.targetProteinG,
      targetCarbsG: target.targetCarbsG,
      targetFatG: target.targetFatG,
    } : null,
    actuals: {
      calories: log.actualCalories ?? 0,
      proteinG: log.actualProteinG ?? 0,
      carbsG: log.actualCarbsG ?? 0,
      fatG: log.actualFatG ?? 0,
    },
    meals: meals.map(m => ({
      id: m.id,
      mealType: m.mealType,
      loggedAt: m.loggedAt,
      foodItems: m.foodItems,
      estimatedCalories: m.estimatedCalories,
      estimatedProteinG: m.estimatedProteinG,
      estimatedCarbsG: m.estimatedCarbsG,
      estimatedFatG: m.estimatedFatG,
      overallConfidence: m.overallConfidence,
    })),
  })
}
