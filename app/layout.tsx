import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NutriFlow AI — Adaptive Nutrition Planning',
  description: 'Adaptive nutrition that auto-corrects your day from a meal photo.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
