import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set({ name: 'nutriflow_session', value: '', maxAge: 0, path: '/' })
  res.cookies.set({ name: 'nf_onboarding', value: '', maxAge: 0, path: '/' })
  return res
}
