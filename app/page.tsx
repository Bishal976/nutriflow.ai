'use client'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, Fragment } from 'react'

const LOOP_STEPS = [
  { icon: '👤', label: 'Health profile', desc: 'Goals, conditions, cuisine preferences' },
  { icon: '🤖', label: 'AI meal plan', desc: 'Personalised to your body and day' },
  { icon: '📸', label: 'Photo log', desc: 'Snap what you actually ate' },
  { icon: '⚡', label: 'Nutrient estimate', desc: 'Instant macro breakdown' },
  { icon: '🔄', label: 'Remaining-day rebalance', desc: 'Auto-corrects the rest of your meals' },
  { icon: '📈', label: 'Adherence outcome', desc: 'System learns and improves over time' },
]

const FEATURES = [
  { icon: '📸', title: 'Photo-first logging', body: 'Point your camera at your plate. AI identifies portions in household measures — "2 medium rotis", "1 katori dal" — and calculates macros instantly.' },
  { icon: '⚖️', title: 'Same-day rebalancing', body: 'Ate a bigger lunch? NutriFlow adjusts your evening snack and dinner automatically. No starting over, no guilt — just recovery.' },
  { icon: '🌡️', title: 'Weather-aware nudges', body: 'Hot day in Chennai? Hydration target goes up, meals get lighter. Cold morning in Delhi? A warming calorie bump to match.' },
  { icon: '🏥', title: 'Medical guardrails', body: 'Kidney disease, diabetes, pregnancy — deterministic safety rules enforce appropriate nutrient caps and flag high-risk cases.' },
  { icon: '🍛', title: 'Deep cultural context', body: 'Native support for Indian regional diets: Jain, Sattvic, South Indian, Bengali, Punjabi. Portions in katoris and rotis, not grams.' },
  { icon: '🔒', title: 'Privacy by design', body: 'Medical data is AES-256 encrypted at the field level. Your prescription details are never stored in plain text.' },
]

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  )
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'NutriFlow AI',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  description: 'Adaptive nutrition planning that auto-corrects your day from a meal photo. Medically-aware, culturally-intelligent, privacy-first.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  featureList: ['AI meal planning', 'Photo-based meal logging', 'Medical condition awareness', 'Indian cuisine support', 'Real-time rebalancing'],
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0F', color: '#E8F0F0', overflowX: 'hidden' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* Ambient background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '30%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,125,125,0.18) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,148,58,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,15,15,0.85)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 16 }}>🌿</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#E8F0F0' }}>NutriFlow AI</span>
          </div>
          <div className="landing-nav-actions">
            <Link href="/login"><button style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#E8F0F0', cursor: 'pointer', fontWeight: 500 }}>Sign in</button></Link>
            <Link href="/signup"><button style={{ padding: '8px 18px', fontSize: 14, background: 'var(--primary)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 600 }}>Get started</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section" style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,125,125,0.15)', border: '1px solid rgba(45,125,125,0.3)', borderRadius: 20, padding: '6px 16px', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: '#4CAF7D', fontWeight: 600 }}>Medically-aware · Culturally-intelligent · Privacy-first</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ fontSize: 'clamp(38px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 12 }}>
          Why lose your streak
          <br />
          <span style={{ background: 'linear-gradient(135deg, #2D7D7D, #4CAF7D, #3DA8A8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            when you can recover
          </span>
          <br />
          with each meal?
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: 18, color: 'rgba(232,240,240,0.65)', lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
          Adaptation matters more than generic tracking. NutriFlow recalculates the rest of your day from what you <em>actually</em> ate — not what you planned.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup">
            <button style={{ padding: '14px 32px', fontSize: 16, background: 'var(--primary)', border: 'none', borderRadius: 12, color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 0 32px rgba(45,125,125,0.35)' }}>
              Start your plan — it&apos;s free →
            </button>
          </Link>
        </motion.div>
      </section>

      {/* Proprietary loop */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>The proprietary loop</p>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              The more you use it,<br />the smarter it gets
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(232,240,240,0.55)', marginTop: 12, maxWidth: 520, margin: '12px auto 0' }}>
              A self-reinforcing system where every meal photo improves substitution and rebalancing for your specific profile.
            </p>
          </div>
        </FadeIn>

        {/* Steps row — oval loop: top arc forward (1→6), bottom arc return (6→1) */}
        <div style={{ position: 'relative', paddingTop: 44 }}>

          {/* Top arc: forward direction 1 → 6 */}
          <FadeIn delay={0.1}>
            <div style={{ position: 'absolute', left: '3.5%', right: '3.5%', top: 0, height: 36, pointerEvents: 'none', zIndex: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderTop: '1.5px dashed rgba(45,125,125,0.45)',
                borderLeft: '1.5px dashed rgba(45,125,125,0.5)',
                borderRight: '1.5px dashed rgba(76,175,125,0.5)',
                borderBottom: 'none',
                borderRadius: '20px 20px 0 0',
              }} />
              {/* Teal dot at bottom-left — arc departs from Step 1 */}
              <div style={{
                position: 'absolute', bottom: -4, left: -4,
                width: 8, height: 8, borderRadius: '50%',
                background: 'rgba(45,125,125,0.75)',
                boxShadow: '0 0 6px rgba(45,125,125,0.45)',
              }} />
              {/* Downward chevron at bottom-right — arc arrives at Step 6, mirrors the upward chevron below */}
              <div style={{ position: 'absolute', bottom: -10, right: -7 }}>
                <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                  <path d="M2 1 L7 11 L12 1" stroke="rgba(76,175,125,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </FadeIn>

          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            {LOOP_STEPS.flatMap((step, i) => {
              const bg = ['rgba(45,125,125,0.13)','rgba(47,132,115,0.15)','rgba(50,140,108,0.17)','rgba(55,150,105,0.18)','rgba(62,162,100,0.18)','rgba(76,175,125,0.22)'][i]
              const border = ['rgba(45,125,125,0.38)','rgba(47,132,115,0.40)','rgba(50,140,108,0.42)','rgba(55,150,105,0.44)','rgba(62,162,100,0.46)','rgba(76,175,125,0.55)'][i]
              return [
                <div key={step.label} style={{ flex: '1 1 0', minWidth: 0 }}>
                  <FadeIn delay={0.15 + i * 0.09}>
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: '50%', background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {step.icon}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#E8F0F0', marginBottom: 3 }}>{step.label}</div>
                      <div style={{ fontSize: 10, color: 'rgba(232,240,240,0.4)', lineHeight: 1.45 }}>{step.desc}</div>
                    </div>
                  </FadeIn>
                </div>
              ]
            })}
          </div>

          {/* Bottom arc: return direction 6 → 1 */}
          <FadeIn delay={0.7}>
            <div style={{ position: 'relative', margin: '4px 3.5% 0', height: 36 }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderLeft: '1.5px dashed rgba(45,125,125,0.5)',
                borderBottom: '1.5px dashed rgba(45,125,125,0.4)',
                borderRight: '1.5px dashed rgba(76,175,125,0.5)',
                borderTop: 'none',
                borderRadius: '0 0 20px 20px',
              }} />
              {/* Green dot at top-right — arc departs from Step 6 */}
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 8, height: 8, borderRadius: '50%',
                background: 'rgba(76,175,125,0.75)',
                boxShadow: '0 0 6px rgba(76,175,125,0.5)',
              }} />
              {/* Upward chevron at top-left — arc returns to Step 1 */}
              <div style={{ position: 'absolute', top: -10, left: -7 }}>
                <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                  <path d="M2 11 L7 1 L12 11" stroke="rgba(45,125,125,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.72}>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(45,125,125,0.08)', border: '1px solid rgba(45,125,125,0.2)', borderRadius: 20, padding: '8px 20px' }}>
              <span style={{ fontSize: 14 }}>🔄</span>
              <span style={{ fontSize: 13, color: 'rgba(232,240,240,0.6)' }}>Loop repeats daily, getting more accurate with every log</span>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Positioning statement */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '20px 24px 80px', textAlign: 'center' }}>
        <FadeIn>
          <div style={{ background: 'rgba(45,125,125,0.06)', border: '1px solid rgba(45,125,125,0.18)', borderRadius: 20, padding: '40px 32px' }}>
            <p style={{ fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 700, lineHeight: 1.45, color: '#E8F0F0', letterSpacing: '-0.01em' }}>
              Plans don&apos;t fail at planning.<br />
              <span style={{ color: '#4CAF7D' }}>They fail at recovery.</span>
            </p>
            <p style={{ fontSize: 15, color: 'rgba(232,240,240,0.5)', marginTop: 16, lineHeight: 1.6 }}>
              NutriFlow closes the gap between what you planned and what you actually ate — meal by meal, in real time. For individuals, that&apos;s a plan that survives real life. For clinics, metabolic programs, and chronic-care teams, it&apos;s the missing layer between appointments — where dietary drift goes undetected until it shows up in lab results.
            </p>
          </div>
        </FadeIn>
      </section>

      {/* Features grid */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '0 24px 100px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>Built different</p>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Everything your nutrition plan actually needs</h2>
          </div>
        </FadeIn>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px', transition: 'border-color 0.2s', height: '100%' }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#E8F0F0' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(232,240,240,0.5)', lineHeight: 1.65 }}>{f.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 24px 100px' }}>
        <FadeIn>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Ready to stop tracking<br />and start <span style={{ background: 'linear-gradient(135deg, #2D7D7D, #4CAF7D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>adapting?</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(232,240,240,0.5)', marginBottom: 36 }}>Free to start. No food scales. No calorie obsession.</p>
          <Link href="/signup">
            <button style={{ padding: '16px 40px', fontSize: 17, background: 'var(--primary)', border: 'none', borderRadius: 14, color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 0 40px rgba(45,125,125,0.4)' }}>
              Build my plan →
            </button>
          </Link>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(232,240,240,0.3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'rgba(232,240,240,0.5)' }}>Wellness decision-support tool only.</strong> NutriFlow AI is not a medical device and does not provide medical diagnoses or clinical advice. Always consult a qualified healthcare professional before making significant dietary changes.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 20, justifyContent: 'center' }}>
            <Link href="/privacy" style={{ fontSize: 12, color: 'rgba(232,240,240,0.35)', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ fontSize: 12, color: 'rgba(232,240,240,0.35)', textDecoration: 'none' }}>Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
