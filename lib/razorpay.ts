const RAZORPAY_API = 'https://api.razorpay.com/v1'

export const PRO_PLANS = {
  monthly: { amountPaise: 83000, label: 'NutriFlow Pro Monthly', durationDays: 30 },
  annual: { amountPaise: 664000, label: 'NutriFlow Pro Annual', durationDays: 365 },
} as const

export type BillingCycle = keyof typeof PRO_PLANS

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set')
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

export interface CreatePaymentLinkParams {
  billing: BillingCycle
  userId: string
  email: string
  name?: string
}

export interface RazorpayPaymentLink {
  id: string
  short_url: string
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<RazorpayPaymentLink> {
  const plan = PRO_PLANS[params.billing]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${RAZORPAY_API}/payment_links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: plan.amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: plan.label,
      customer: {
        name: params.name || undefined,
        email: params.email,
      },
      notify: { email: true, sms: false },
      reminder_enable: true,
      notes: {
        userId: params.userId,
        billingCycle: params.billing,
      },
      callback_url: `${appUrl}/upgrade?payment=callback`,
      callback_method: 'get',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Razorpay payment link creation failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return { id: data.id, short_url: data.short_url }
}
