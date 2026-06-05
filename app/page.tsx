import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 16 }}>🌿</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>NutriFlow AI</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/login"><button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 14 }}>Sign in</button></Link>
            <Link href="/signup"><button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }}>Get started free</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,125,125,0.1)', borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
          <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>✦ AI-powered • Culturally aware • Privacy-first</span>
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 58px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.02em' }}>
          Your nutrition plan<br />
          <span style={{ color: 'var(--primary)' }}>adapts to your real day</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
          Snap a photo of what you actually ate. NutriFlow recalculates the rest of your day in seconds — no food scales, no guilt, no falling off track.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup">
            <button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16, borderRadius: 12 }}>
              Start your plan — it&apos;s free
            </button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            { icon: '📸', title: 'Photo-first logging', body: 'Point your camera at your plate. AI identifies the food, estimates household portions — "2 medium rotis", "1 katori dal" — and calculates macros instantly.' },
            { icon: '⚖️', title: 'Same-day rebalancing', body: 'Ate a bigger lunch? NutriFlow adjusts your evening snack and dinner automatically, keeping you on track without starting over.' },
            { icon: '🌡️', title: 'Weather-aware nudges', body: 'Hot day in Chennai? Hydration target goes up, meals get lighter. Cold morning in Delhi? A warming calorie bump to match.' },
            { icon: '🏥', title: 'Medical guardrails', body: 'Kidney disease, diabetes, pregnancy — deterministic safety rules (never AI guesses) enforce appropriate nutrient caps and flag high-risk cases for clinician review.' },
            { icon: '🍛', title: 'Deep cultural context', body: 'Native support for Indian regional diets: Jain, Sattvic, South Indian, Bengali, Punjabi. Portions in katoris and rotis, not just grams.' },
            { icon: '🔒', title: 'Privacy by design', body: 'Medical data is AES-256 encrypted at the field level. Your prescription details and lab values are never in plain text, ever.' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text)' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong>Wellness decision-support tool only.</strong> NutriFlow AI is not a medical device and does not provide medical diagnoses or clinical advice. All nutrition targets are estimates. Always consult a qualified healthcare professional before making changes to your diet, especially if you have a medical condition or are on medication.
          </p>
        </div>
      </footer>
    </div>
  )
}
