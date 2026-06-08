import type { Metadata } from 'next'
import './globals.css'
import '@/lib/startup-check'
import { ToastProvider } from '@/components/ui/Toast'
import PostHogProvider from '@/components/PostHogProvider'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutriflow-ai.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: 'NutriFlow AI — Adaptive Nutrition Planning',
    template: '%s | NutriFlow AI',
  },
  description: 'Adaptive nutrition that auto-corrects your day from a meal photo. Medically-aware, culturally-intelligent, privacy-first. Built for India.',
  keywords: ['nutrition app', 'meal planning', 'Indian diet', 'adaptive nutrition', 'calorie tracking', 'diabetes diet', 'NutriFlow'],
  authors: [{ name: 'NutriFlow AI' }],
  openGraph: {
    type: 'website',
    siteName: 'NutriFlow AI',
    title: 'NutriFlow AI — Adaptive Nutrition Planning',
    description: 'Photo-based meal logging that rebalances your remaining day automatically. Medically-aware. Culturally-intelligent.',
    url: BASE,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NutriFlow AI — Adaptive Nutrition Planning',
    description: 'Photo-based meal logging that rebalances your remaining day automatically.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: BASE },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <ToastProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
