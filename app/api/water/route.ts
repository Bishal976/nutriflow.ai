import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { dailyLogs } from '@/db/schema'
import { eq, and, gte, desc } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addMl } = await req.json()
  if (!addMl || typeof addMl !== 'number' || addMl <= 0 || addMl > 10000)
    return NextResponse.json({ error: 'addMl must be between 1 and 10000 ml' }, { status: 400 })

  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)

  const log = await db.query.dailyLogs.findFirst({
    where: and(eq(dailyLogs.userId, session.userId), gte(dailyLogs.date, todayUTC)),
    orderBy: [desc(dailyLogs.createdAt)],
  })
  if (!log) return NextResponse.json({ error: 'No daily log found for today' }, { status: 404 })

  const newWaterMl = (log.waterMl ?? 0) + addMl
  await db.update(dailyLogs).set({ waterMl: newWaterMl, updatedAt: new Date() }).where(eq(dailyLogs.id, log.id))

  return NextResponse.json({ waterMl: newWaterMl })
}
