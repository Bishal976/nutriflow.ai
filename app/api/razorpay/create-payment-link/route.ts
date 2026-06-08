import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db/client'
import { users, profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createPaymentLink, type BillingCycle } from '@/lib/razorpay'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const billing: BillingCycle | undefined = body?.billing
  if (billing !== 'monthly' && billing !== 'annual') {
    return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 })
  }

  const [row] = await db
    .select({ email: users.email, firstName: profiles.firstName, lastName: profiles.lastName })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || undefined

  try {
    const link = await createPaymentLink({
      billing,
      userId: session.userId,
      email: row.email,
      name,
    })
    return NextResponse.json({ shortUrl: link.short_url, id: link.id })
  } catch (err) {
    console.error('[razorpay] create-payment-link failed:', err)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 502 })
  }
}
