'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import DemographicsStep from '@/components/onboarding/steps/DemographicsStep'
import GoalsStep from '@/components/onboarding/steps/GoalsStep'
import MedicalContextStep from '@/components/onboarding/steps/MedicalContextStep'
import DocUploadStep from '@/components/onboarding/steps/DocUploadStep'
import DietaryPrefsStep from '@/components/onboarding/steps/DietaryPrefsStep'
import LocationStep from '@/components/onboarding/steps/LocationStep'

const STEPS = [
  { num: 1, title: 'About you', subtitle: 'Basic measurements to calibrate your plan' },
  { num: 2, title: 'Your goal', subtitle: 'What are you working towards?' },
  { num: 3, title: 'Health context', subtitle: 'We use this to keep your plan safe' },
  { num: 4, title: 'Medical documents', subtitle: 'Optional: upload a prescription or lab report' },
  { num: 5, title: 'Food preferences', subtitle: 'We personalise every meal to your taste' },
  { num: 6, title: 'Your location', subtitle: 'For weather-aware recommendations' },
]

export default function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepStr } = use(params)
  const step = Math.max(1, Math.min(6, parseInt(stepStr, 10)))
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stepInfo = STEPS[step - 1]
  const progress = (step / 6) * 100

  async function handleStepData(data: object) {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      if (json.onboardingComplete) {
        router.push('/dashboard')
      } else {
        router.push(`/onboarding/${step + 1}`)
      }
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  function handleSkip() {
    if (step < 6) router.push(`/onboarding/${step + 1}`)
    else router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Progress header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14 }}>🌿</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>NutriFlow AI</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{step} of 6</span>
          </div>
          {/* Step dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((s, i) => {
              const done = step > s.num
              const active = step === s.num
              return (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div title={s.title} style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: done ? 'var(--primary)' : active ? 'var(--primary)' : 'var(--surface-2)',
                    color: done || active ? 'white' : 'var(--text-muted)',
                    border: active ? '2px solid var(--primary)' : '2px solid transparent',
                    boxShadow: active ? '0 0 0 3px rgba(45,125,125,0.2)' : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                    {done ? '✓' : s.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: done ? 'var(--primary)' : 'var(--surface-2)', transition: 'background 0.3s ease', margin: '0 2px' }} />
                  )}
                </div>
              )
            })}
          </div>
          {/* Current step label */}
          <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 8 }}>{stepInfo.title}</p>
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 600 }} className="fade-up">
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{stepInfo.title}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>{stepInfo.subtitle}</p>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {step === 1 && <DemographicsStep onSubmit={handleStepData} loading={loading} />}
          {step === 2 && <GoalsStep onSubmit={handleStepData} loading={loading} />}
          {step === 3 && <MedicalContextStep onSubmit={handleStepData} loading={loading} />}
          {step === 4 && <DocUploadStep onSubmit={handleStepData} loading={loading} onSkip={handleSkip} />}
          {step === 5 && <DietaryPrefsStep onSubmit={handleStepData} loading={loading} />}
          {step === 6 && <LocationStep onSubmit={handleStepData} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
