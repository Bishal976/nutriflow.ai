import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How NutriFlow AI collects, uses, and protects your personal and medical data.',
  robots: { index: true, follow: false },
}

export default function PrivacyPage() {
  const lastUpdated = 'June 2025'
  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0F', color: '#E8F0F0' }}>
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← NutriFlow AI</Link>
      </nav>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: 'rgba(232,240,240,0.4)', marginBottom: 40 }}>Last updated: {lastUpdated}</p>

        <Section title="1. Who we are">
          NutriFlow AI (&quot;NutriFlow&quot;, &quot;we&quot;, &quot;our&quot;) is an adaptive nutrition planning service. This policy explains what personal data we collect, how we use it, and how we protect it.
        </Section>

        <Section title="2. Data we collect">
          <ul>
            <li><strong>Account data:</strong> email address and bcrypt-hashed password (we never store plain-text passwords).</li>
            <li><strong>Profile data:</strong> age, sex, height, weight, activity level, dietary preferences, and health goals you provide during onboarding.</li>
            <li><strong>Medical data:</strong> conditions, medications, and lab values you upload or enter. All sensitive medical fields are encrypted at rest using AES-256-GCM with a per-record salt — they are never stored or transmitted in plain text.</li>
            <li><strong>Meal logs:</strong> photos you submit for nutrient analysis, along with timestamps and the macro estimates returned by AI.</li>
            <li><strong>Document uploads:</strong> prescriptions or lab reports you upload voluntarily, stored in Vercel Blob (private access, IAD1 region) and linked to your encrypted medical profile.</li>
            <li><strong>Usage data:</strong> page views, feature interactions, and session events collected via PostHog for product analytics.</li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul>
            <li>To generate and adapt your daily nutrition plan.</li>
            <li>To log meals and rebalance remaining-day targets.</li>
            <li>To apply medical guardrails (e.g., sodium caps for kidney disease).</li>
            <li>To send transactional emails (account verification, password reset) via Resend.</li>
            <li>To process subscription payments via Razorpay. We never see or store your card details — they are handled entirely by Razorpay&apos;s PCI DSS compliant infrastructure.</li>
            <li>To improve the product through aggregated, anonymised analytics.</li>
          </ul>
        </Section>

        <Section title="4. Third-party processors">
          <ul>
            <li><strong>Vercel</strong> — hosting, serverless compute, Blob storage (IAD1, private).</li>
            <li><strong>Neon (PostgreSQL)</strong> — primary database, data at rest encrypted by the provider.</li>
            <li><strong>Google Gemini AI</strong> — vision analysis of meal photos and medical document extraction. Images are sent to the Gemini API over TLS and are not retained by Google beyond the request.</li>
            <li><strong>Razorpay</strong> — payment processing (PCI DSS Level 1). We store only the payment link ID and confirmation status.</li>
            <li><strong>Resend</strong> — transactional email delivery.</li>
            <li><strong>PostHog</strong> — product analytics. No medical data is sent to PostHog.</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          Your data is retained for as long as your account is active. You may request deletion by emailing us at the address below. Upon deletion, all personal and medical data is permanently removed within 30 days.
        </Section>

        <Section title="6. Security">
          <ul>
            <li>Passwords are hashed with bcrypt (12 rounds).</li>
            <li>Medical fields are encrypted at the field level (AES-256-GCM) before database storage.</li>
            <li>All data in transit is encrypted via TLS 1.2+.</li>
            <li>Session tokens are HTTP-only, Secure, SameSite=Lax JWTs with a 7-day expiry.</li>
            <li>Document uploads are stored with private (non-public) access — they cannot be accessed without your session.</li>
          </ul>
        </Section>

        <Section title="7. Your rights">
          Under applicable law you have the right to access, correct, or delete your personal data. To exercise any of these rights, contact us at the email below. We will respond within 30 days.
        </Section>

        <Section title="8. Children">
          NutriFlow is not directed at children under 13. We do not knowingly collect data from anyone under 13. If you believe a child has provided data, please contact us immediately.
        </Section>

        <Section title="9. Changes to this policy">
          We may update this policy periodically. Material changes will be communicated via email or in-app notice at least 14 days before they take effect.
        </Section>

        <Section title="10. Contact">
          For privacy questions or data requests, email: <strong>privacy@nutriflow.ai</strong> (or use the in-app support link).
        </Section>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20 }}>
          <Link href="/terms" style={{ fontSize: 13, color: 'rgba(232,240,240,0.4)', textDecoration: 'none' }}>Terms of Service</Link>
          <Link href="/" style={{ fontSize: 13, color: 'rgba(232,240,240,0.4)', textDecoration: 'none' }}>Home</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#E8F0F0', marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'rgba(232,240,240,0.6)', lineHeight: 1.75 }}>{children}</div>
    </div>
  )
}
