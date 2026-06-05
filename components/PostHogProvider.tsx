'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog, track } from '@/lib/posthog'

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    track('$pageview', { path: pathname })
  }, [pathname])

  return <>{children}</>
}
