import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { mealLogs, dailyLogs } from '@/db/schema'
import { eq, and, gte, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dailyLogId = new URL(req.url).searchParams.get('dailyLogId')

  let meals
  if (dailyLogId) {
    meals = await db.query.mealLogs.findMany({
      where: and(eq(mealLogs.dailyLogId, dailyLogId), eq(mealLogs.userId, session.userId)),
      orderBy: [desc(mealLogs.loggedAt)],
    })
  } else {
    // Fallback: get today's daily log then its meals
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const todayLog = await db.query.dailyLogs.findFirst({
      where: and(eq(dailyLogs.userId, session.userId), gte(dailyLogs.date, todayUTC)),
      orderBy: [desc(dailyLogs.createdAt)],
    })
    meals = todayLog
      ? await db.query.mealLogs.findMany({
          where: and(eq(mealLogs.dailyLogId, todayLog.id), eq(mealLogs.userId, session.userId)),
          orderBy: [desc(mealLogs.loggedAt)],
        })
      : []
  }

  return NextResponse.json({ meals })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mealLogId, foodItems, estimatedCalories, estimatedProteinG, estimatedCarbsG, estimatedFatG } = await req.json()
  if (!mealLogId) return NextResponse.json({ error: 'mealLogId required' }, { status: 400 })

  const existing = await db.query.mealLogs.findFirst({ where: eq(mealLogs.id, mealLogId) })
  if (!existing || existing.userId !== session.userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.update(mealLogs).set({
    foodItems: foodItems ?? existing.foodItems,
    estimatedCalories: estimatedCalories ?? existing.estimatedCalories,
    estimatedProteinG: estimatedProteinG ?? existing.estimatedProteinG,
    estimatedCarbsG: estimatedCarbsG ?? existing.estimatedCarbsG,
    estimatedFatG: estimatedFatG ?? existing.estimatedFatG,
    userEdited: true,
  }).where(eq(mealLogs.id, mealLogId))

  return NextResponse.json({ success: true })
}
