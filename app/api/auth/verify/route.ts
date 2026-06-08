import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=missing_token`)
  }

  const user = await db.query.users.findFirst({
    where: eq(users.emailVerificationToken, token),
  })

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=invalid_token`)
  }

  if (user.emailVerified) {
    return NextResponse.redirect(`${APP_URL}/dashboard?verified=1`)
  }

  if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=expired&email=${encodeURIComponent(user.email)}`)
  }

  await db.update(users)
    .set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return NextResponse.redirect(`${APP_URL}/dashboard?verified=1`)
}
