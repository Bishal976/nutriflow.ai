import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (typeof window === 'undefined' || initialized) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage',
  })
  initialized = true
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.identify(userId, traits)
}
