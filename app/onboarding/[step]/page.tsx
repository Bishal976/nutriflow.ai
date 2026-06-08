'use client'
import { use, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function OnboardingStepInner({ step }: { step: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromProfile = searchParams.get('from') === 'profile'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileData, setProfileData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setProfileData(d)).catch(() => {})
  }, [])

  const stepInfo = STEPS[step - 1]

  function getInitialData() {
    if (!profileData?.profile) return undefined
    const p = profileData.profile
    if (step === 1) return {
      firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth,
      sex: p.sex, heightCm: p.heightCm, weightKg: p.weightKg, activityLevel: p.activityLevel,
    }
    if (step === 2) return { primaryGoal: p.primaryGoal, targetWeightKg: p.targetWeightKg }
    if (step === 3) return { conditionCodes: (profileData.conditions ?? []).map((c: any) => c.conditionCode) }
    if (step === 5) return {
      dietType: p.dietType, allergens: p.allergens, cuisinePreferences: p.cuisinePreferences,
      dislikedIngredients: p.dislikedIngredients,
    }
    if (step === 6) return { city: p.city, country: p.country, timezone: p.timezone }
    return undefined
  }

  async function saveStep(data: object, saveOnly = false) {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }

      if (saveOnly) {
        router.push('/profile')
      } else if (fromProfile) {
        // "Continue" while editing from the profile should keep walking through
        // steps (so the user can review/edit each one), not bail out after the first
        if (step < 6) router.push(`/onboarding/${step + 1}?from=profile`)
        else router.push('/profile')
      } else if (json.onboardingComplete) {
        router.push('/dashboard')
      } else {
        router.push(`/onboarding/${step + 1}`)
      }
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  function handleSkip() {
    if (fromProfile) {
      // Same "keep walking through steps while editing" rule as saveStep —
      // skipping the doc-upload step shouldn't bail out of the edit flow early
      if (step < 6) router.push(`/onboarding/${step + 1}?from=profile`)
      else router.push('/profile')
      return
    }
    if (step < 6) router.push(`/onboarding/${step + 1}`)
    else router.push('/dashboard')
  }

  function goBack() {
    if (step > 1) {
      router.push(fromProfile ? `/onboarding/${step - 1}?from=profile` : `/onboarding/${step - 1}`)
    } else if (fromProfile) {
      router.push('/profile')
    }
  }

  function goToStep(num: number) {
    router.push(fromProfile ? `/onboarding/${num}?from=profile` : `/onboarding/${num}`)
  }

  const initialData = getInitialData()

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {fromProfile && (
                <span style={{ fontSize: 11, background: 'rgba(45,125,125,0.1)', color: 'var(--primary)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                  editing
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{step} of 6</span>
            </div>
          </div>
          {/* Clickable step dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((s, i) => {
              const done = step > s.num
              const active = step === s.num
              return (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <button
                    type="button"
                    title={s.title}
                    onClick={() => done ? goToStep(s.num) : undefined}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: done ? 'var(--primary)' : active ? 'var(--primary)' : 'var(--surface-2)',
                      color: done || active ? 'white' : 'var(--text-muted)',
                      border: active ? '2px solid var(--primary)' : '2px solid transparent',
                      boxShadow: active ? '0 0 0 3px rgba(45,125,125,0.2)' : 'none',
                      transition: 'all 0.3s ease',
                      cursor: done ? 'pointer' : 'default',
                    }}
                  >
                    {done ? '✓' : s.num}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: done ? 'var(--primary)' : 'var(--surface-2)', transition: 'background 0.3s ease', margin: '0 2px' }} />
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 8 }}>{stepInfo.title}</p>
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 600 }} className="fade-up">
          {/* Back + title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{stepInfo.title}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>{stepInfo.subtitle}</p>
            </div>
            {(step > 1 || fromProfile) && (
              <button
                type="button"
                onClick={goBack}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }}
              >
                ← Back
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--error)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* key=profileData forces remount once data loads so useState picks up initialData */}
          {step === 1 && <DemographicsStep key={profileData ? 'loaded' : 'init'} onSubmit={d => saveStep(d)} onSaveOnly={fromProfile ? d => saveStep(d, true) : undefined} loading={loading} initialData={initialData} />}
          {step === 2 && <GoalsStep key={profileData ? 'loaded' : 'init'} onSubmit={d => saveStep(d)} onSaveOnly={fromProfile ? d => saveStep(d, true) : undefined} loading={loading} initialData={initialData} />}
          {step === 3 && <MedicalContextStep key={profileData ? 'loaded' : 'init'} onSubmit={d => saveStep(d)} onSaveOnly={fromProfile ? d => saveStep(d, true) : undefined} loading={loading} initialData={initialData} />}
          {step === 4 && <DocUploadStep onSubmit={d => saveStep(d)} loading={loading} onSkip={handleSkip} onSaveOnly={fromProfile ? () => router.push('/profile') : undefined} />}
          {step === 5 && <DietaryPrefsStep key={profileData ? 'loaded' : 'init'} onSubmit={d => saveStep(d)} onSaveOnly={fromProfile ? d => saveStep(d, true) : undefined} loading={loading} initialData={initialData} />}
          {step === 6 && <LocationStep key={profileData ? 'loaded' : 'init'} onSubmit={d => saveStep(d)} onSaveOnly={fromProfile ? d => saveStep(d, true) : undefined} loading={loading} initialData={initialData} />}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepStr } = use(params)
  const step = Math.max(1, Math.min(6, parseInt(stepStr, 10)))
  return (
    <Suspense>
      <OnboardingStepInner step={step} />
    </Suspense>
  )
}
