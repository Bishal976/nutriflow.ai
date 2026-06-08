import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using NutriFlow AI.',
  robots: { index: true, follow: false },
}

export default function TermsPage() {
  const lastUpdated = 'June 2025'
  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0F', color: '#E8F0F0' }}>
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← NutriFlow AI</Link>
      </nav>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: 'rgba(232,240,240,0.4)', marginBottom: 40 }}>Last updated: {lastUpdated}</p>

        <Section title="1. Acceptance">
          By creating an account or using NutriFlow AI (&quot;Service&quot;), you agree to these Terms. If you do not agree, do not use the Service. These Terms constitute a binding agreement between you and NutriFlow AI.
        </Section>

        <Section title="2. Not medical advice">
          <strong style={{ color: '#E8F0F0' }}>NutriFlow AI is a wellness decision-support tool, not a medical device.</strong> It does not provide medical diagnoses, clinical advice, or treatment recommendations. Any nutrition information generated is for general informational purposes only. Always consult a qualified healthcare professional before making significant dietary changes, especially if you have a medical condition.
        </Section>

        <Section title="3. Eligibility">
          You must be at least 13 years old to use the Service. By using it, you represent that you meet this requirement.
        </Section>

        <Section title="4. Account responsibilities">
          <ul>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You agree to provide accurate information and keep it updated.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately of any unauthorised access.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable use">
          You agree not to:
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of applicable law.</li>
            <li>Attempt to reverse-engineer, scrape, or probe the Service&apos;s systems.</li>
            <li>Upload content that is malicious, defamatory, or violates third-party rights.</li>
            <li>Share your account with others or create multiple accounts to circumvent limits.</li>
          </ul>
        </Section>

        <Section title="6. Subscription and billing">
          <ul>
            <li>The Free plan is available at no cost with feature limits described on the pricing page.</li>
            <li>Pro plans are billed as a one-time charge for the selected period (monthly or annual) via Razorpay.</li>
            <li>There is no automatic recurring charge — Pro access expires at the end of your billing period unless manually renewed.</li>
            <li>Payments are processed by Razorpay (PCI DSS compliant). We do not store card details.</li>
            <li>Refunds are handled on a case-by-case basis. Contact support within 7 days of purchase if you experience a technical issue.</li>
          </ul>
        </Section>

        <Section title="7. Intellectual property">
          All content, design, code, and branding of the Service are owned by NutriFlow AI or its licensors. You are granted a limited, non-exclusive licence to use the Service for personal, non-commercial purposes.
        </Section>

        <Section title="8. Disclaimer of warranties">
          The Service is provided &quot;as is&quot; without warranties of any kind, express or implied, including accuracy, fitness for a particular purpose, or uninterrupted availability.
        </Section>

        <Section title="9. Limitation of liability">
          To the maximum extent permitted by law, NutriFlow AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability for any claim shall not exceed the amount you paid us in the three months preceding the claim.
        </Section>

        <Section title="10. Governing law">
          These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.
        </Section>

        <Section title="11. Changes to terms">
          We may update these Terms. Material changes will be communicated via email or in-app notice at least 14 days before taking effect. Continued use after that date constitutes acceptance.
        </Section>

        <Section title="12. Contact">
          For questions about these Terms: <strong>legal@nutriflow.ai</strong>
        </Section>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20 }}>
          <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(232,240,240,0.4)', textDecoration: 'none' }}>Privacy Policy</Link>
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
