import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
// VERCEL_URL is auto-set by Vercel (e.g. nutriflow-ai.vercel.app); use as fallback when
// NEXT_PUBLIC_APP_URL isn't explicitly configured so email links never point to localhost.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/api/auth/verify?token=${token}`

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your NutriFlow account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:48px;height:48px;background:#2D7D7D;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:22px">🌿</div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:16px 0 4px">Welcome to NutriFlow</h1>
          <p style="font-size:14px;color:#6b7280;margin:0">Just one step to activate your account</p>
        </div>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin-bottom:28px">
          Click the button below to verify your email address. This link expires in <strong>24 hours</strong>.
        </p>
        <div style="text-align:center;margin-bottom:28px">
          <a href="${link}" style="display:inline-block;background:#2D7D7D;color:#fff;font-weight:600;font-size:15px;padding:13px 32px;border-radius:10px;text-decoration:none">
            Verify my email →
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5;text-align:center">
          If you didn't sign up for NutriFlow, you can safely ignore this email.<br/>
          Or copy this link: <a href="${link}" style="color:#2D7D7D">${link}</a>
        </p>
      </div>
    `,
  })

  // In dev: always print the link so you can verify without email delivery
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n\x1b[36m[NutriFlow DEV] Verification link for ${email}:\n${link}\x1b[0m\n`)
  }

  if (error) {
    console.error('[email] sendVerificationEmail failed — name:', (error as any).name, 'message:', (error as any).message, 'statusCode:', (error as any).statusCode)
    if (process.env.NODE_ENV === 'production') throw new Error(`Email send failed: ${(error as any).message ?? JSON.stringify(error)}`)
    return null
  }

  console.log('[email] Verification email sent, id:', data?.id)
  return data
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your NutriFlow password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:48px;height:48px;background:#2D7D7D;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:22px">🌿</div>
          <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:16px 0 4px">Reset your password</h1>
        </div>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin-bottom:28px">
          Click below to set a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align:center;margin-bottom:28px">
          <a href="${link}" style="display:inline-block;background:#2D7D7D;color:#fff;font-weight:600;font-size:15px;padding:13px 32px;border-radius:10px;text-decoration:none">
            Reset password →
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;line-height:1.5;text-align:center">
          If you didn't request this, ignore this email — your password won't change.
        </p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] sendPasswordResetEmail failed — name:', (error as any).name, 'message:', (error as any).message, 'statusCode:', (error as any).statusCode)
    throw new Error(`Email send failed: ${(error as any).message ?? JSON.stringify(error)}`)
  }

  return data
}
