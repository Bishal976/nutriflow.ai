import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PRO_PLANS, type BillingCycle } from '@/lib/razorpay'

// Razorpay webhook — activates Pro plan when a one-time Payment Link is paid.
// Wire RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET in .env to go live.

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const signatureBuf = Buffer.from(signature)
  if (expectedBuf.length !== signatureBuf.length) return false
  return timingSafeEqual(expectedBuf, signatureBuf)
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 501 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventType: string = event.event

  if (eventType !== 'payment_link.paid') {
    return NextResponse.json({ ok: true })
  }

  const linkEntity = event.payload?.payment_link?.entity
  const paymentEntity = event.payload?.payment?.entity

  const userId: string | undefined = linkEntity?.notes?.userId
  const billingCycle: BillingCycle | undefined = linkEntity?.notes?.billingCycle
  const razorpayPaymentId: string | undefined = paymentEntity?.id
  const razorpayCustomerId: string | undefined = paymentEntity?.customer_id

  if (!userId || !billingCycle || !PRO_PLANS[billingCycle]) {
    console.warn('[razorpay webhook] payment_link.paid missing userId/billingCycle in notes')
    return NextResponse.json({ ok: true })
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) {
    console.warn('[razorpay webhook] No user found for id', userId)
    return NextResponse.json({ ok: true })
  }

  const durationMs = PRO_PLANS[billingCycle].durationDays * 24 * 60 * 60 * 1000
  const now = new Date()
  // Extend from current expiry if still active (renewal), otherwise from now
  const baseTime = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt.getTime() : now.getTime()
  const planExpiresAt = new Date(baseTime + durationMs)

  await db.update(users).set({
    plan: 'pro',
    planActivatedAt: now,
    planExpiresAt,
    razorpayPaymentId: razorpayPaymentId ?? user.razorpayPaymentId,
    razorpayCustomerId: razorpayCustomerId ?? user.razorpayCustomerId,
    updatedAt: now,
  }).where(eq(users.id, user.id))

  console.log('[razorpay webhook] Pro activated for user', user.id, 'until', planExpiresAt)

  return NextResponse.json({ ok: true })
}
