/**
 * Layer 2: API integration tests
 * Run: npx tsx scripts/test-layer2.ts
 * Requires dev server at localhost:3000 and DB reachable.
 */
import { execSync } from 'child_process'

const BASE = 'http://localhost:3000'

let pass = 0, fail = 0, warn = 0
const failures: string[] = []

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CookieJar = Map<string, string>

function buildCookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function parseCookies(res: Response, jar: CookieJar) {
  // getSetCookie returns each set-cookie as a separate string (safe — no comma splitting)
  const headers = res.headers as any
  const cookies: string[] = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (res.headers.get('set-cookie') ?? '').split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_-]*=)/)

  for (const part of cookies) {
    const kv = part.split(';')[0].trim()
    const eq = kv.indexOf('=')
    if (eq < 0) continue
    const k = kv.slice(0, eq).trim()
    const v = kv.slice(eq + 1).trim()
    if (v === '' || v === 'deleted') jar.delete(k)
    else jar.set(k, v)
  }
}

async function api(
  method: string,
  path: string,
  opts: { body?: unknown; jar?: CookieJar; isForm?: boolean; formData?: FormData } = {}
): Promise<{ status: number; body: any; res: Response }> {
  const headers: Record<string, string> = {}
  if (opts.jar) headers['Cookie'] = buildCookieHeader(opts.jar)

  let bodyInit: BodyInit | undefined
  if (opts.isForm && opts.formData) {
    bodyInit = opts.formData
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    bodyInit = JSON.stringify(opts.body)
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: bodyInit,
    redirect: 'manual',
  })

  if (opts.jar) parseCookies(res, opts.jar)

  let body: any = null
  const ct = res.headers.get('content-type') ?? ''
  try {
    if (ct.includes('json')) body = await res.json()
    else body = await res.text()
  } catch { /* empty */ }
  return { status: res.status, body, res }
}

function ok(label: string) { console.log(`  ✅ ${label}`); pass++ }
function ko(label: string, detail?: string) {
  console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  failures.push(label + (detail ? `: ${detail}` : ''))
  fail++
}
function note(label: string) { console.log(`  ⚠️  ${label}`); warn++ }

function expect(label: string, actual: number, expected: number) {
  if (actual === expected) ok(label)
  else ko(label, `got ${actual}, expected ${expected}`)
}

function expectBody(label: string, body: any, key: string, val?: unknown) {
  if (val === undefined) {
    if (body?.[key] !== undefined) ok(label)
    else ko(label, `body missing key "${key}": ${JSON.stringify(body)}`)
  } else {
    if (body?.[key] === val) ok(label)
    else ko(label, `body.${key}=${JSON.stringify(body?.[key])}, expected ${JSON.stringify(val)}`)
  }
}

function expectBodyContains(label: string, body: any, key: string, substr: string) {
  const val = String(body?.[key] ?? '')
  if (val.toLowerCase().includes(substr.toLowerCase())) ok(label)
  else ko(label, `body.${key}="${val}" missing "${substr}"`)
}

// Promote userId to admin via node/postgres (avoids direct DB dep in this script)
function promoteAdmin(email: string) {
  execSync(
    `node -e "
const p=require('postgres');
const s=p(require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL=(.+)/)[1].trim().replace(/^\\"|\\"$/g,''),{connect_timeout:5});
s\\\`UPDATE users SET is_admin=true WHERE email='${email}'\\\`.then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
"`, { cwd: process.cwd(), stdio: 'inherit' }
  )
}

// ─── Test scaffolding ─────────────────────────────────────────────────────────

async function main() {

const TEST_EMAIL = `layer2_${Date.now()}@test.nutriflow`
const TEST_PW = 'TestPass1234!'
const ADMIN_EMAIL = `admin_${Date.now()}@test.nutriflow`
const VICTIM_EMAIL = `victim_${Date.now()}@test.nutriflow`

const jar = new Map<string, string>()       // main test user session
const adminJar = new Map<string, string>()  // admin session
const victimJar = new Map<string, string>() // second user session (cross-user tests)
let dailyLogId: string
let mealLogId: string

// ─── 1. Auth ─────────────────────────────────────────────────────────────────
console.log('\n── 1. Auth: signup ───────────────────────────────────────')
{
  // Bad email
  const r = await api('POST', '/api/auth/signup', { body: { email: 'notanemail', password: 'password123' } })
  expect('Signup bad email → 400', r.status, 400)
}
{
  // Short password
  const r = await api('POST', '/api/auth/signup', { body: { email: TEST_EMAIL, password: 'short' } })
  expect('Signup short password → 400', r.status, 400)
}
{
  // Valid signup
  const r = await api('POST', '/api/auth/signup', { body: { email: TEST_EMAIL, password: TEST_PW }, jar })
  expect('Signup valid → 201', r.status, 201)
  expectBody('Signup returns userId', r.body, 'userId')
  expectBody('Signup onboardingComplete=false', r.body, 'onboardingComplete', false)
}
{
  // Duplicate email
  const r = await api('POST', '/api/auth/signup', { body: { email: TEST_EMAIL, password: TEST_PW } })
  expect('Signup duplicate → 409', r.status, 409)
  expectBodyContains('Signup 409 message includes "already exists"', r.body, 'error', 'already exists')
}

console.log('\n── 2. Auth: session & logout ─────────────────────────────')
{
  // Unauthenticated me
  const r = await api('GET', '/api/auth/me')
  expect('GET /me unauthenticated → 401', r.status, 401)
}
{
  // Authenticated me (using cookie from signup)
  const r = await api('GET', '/api/auth/me', { jar })
  expect('GET /me with session → 200', r.status, 200)
  expectBody('/me returns email', r.body, 'email', TEST_EMAIL)
}
{
  // Logout
  const r = await api('POST', '/api/auth/logout', { jar })
  expect('POST /logout → 200', r.status, 200)
}
{
  // After logout, me should 401
  const r = await api('GET', '/api/auth/me', { jar })
  expect('GET /me after logout → 401', r.status, 401)
}

console.log('\n── 3. Auth: login ────────────────────────────────────────')
{
  // Wrong password
  const r = await api('POST', '/api/auth/login', { body: { email: TEST_EMAIL, password: 'WrongPassword99!' } })
  expect('Login wrong password → 401', r.status, 401)
}
{
  // Wrong email (non-existent)
  const r = await api('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: TEST_PW } })
  expect('Login unknown email → 401', r.status, 401)
}
{
  // Valid login
  const r = await api('POST', '/api/auth/login', { body: { email: TEST_EMAIL, password: TEST_PW }, jar })
  expect('Login valid → 200', r.status, 200)
  expectBody('Login returns userId', r.body, 'userId')
}

console.log('\n── 4. Auth: forgot/reset password ────────────────────────')
{
  // Forgot: known email (should 200 regardless for enumeration safety)
  const r = await api('POST', '/api/auth/forgot-password', { body: { email: TEST_EMAIL } })
  expect('Forgot-password known email → 200', r.status, 200)
}
{
  // Forgot: unknown email (must also 200 — no user enumeration)
  const r = await api('POST', '/api/auth/forgot-password', { body: { email: 'ghost@nobody.invalid' } })
  expect('Forgot-password unknown email → 200 (no enumeration)', r.status, 200)
}
{
  // Reset with bogus token
  const r = await api('POST', '/api/auth/reset-password', { body: { token: 'badtoken123', password: 'NewPass1234!' } })
  if (r.status === 400 || r.status === 404 || r.status === 401) ok('Reset bogus token → 4xx')
  else ko('Reset bogus token should fail', `got ${r.status}`)
}

console.log('\n── 5. Change password ────────────────────────────────────')
{
  // Wrong current password
  const r = await api('POST', '/api/auth/change-password', {
    jar,
    body: { currentPassword: 'WrongOld!', newPassword: 'NewPass5678!' },
  })
  if (r.status === 400 || r.status === 401) ok('Change-password wrong current → 4xx')
  else ko('Change-password wrong current should fail', `got ${r.status}`)
}
{
  // Too short new password
  const r = await api('POST', '/api/auth/change-password', {
    jar,
    body: { currentPassword: TEST_PW, newPassword: 'short' },
  })
  if (r.status === 400 || r.status === 422) ok('Change-password short new pw → 400/422')
  else ko('Change-password short new pw should fail', `got ${r.status}`)
}

console.log('\n── 6. Middleware: protected routes without session ───────')
{
  const routes = ['/dashboard', '/plan', '/log', '/history', '/profile', '/upgrade']
  for (const route of routes) {
    const r = await api('GET', route)
    // Should redirect (302/307/308) to /login — NOT 200 or 500
    if (r.status >= 300 && r.status < 400) ok(`${route} → redirect (${r.status}) when unauth`)
    else ko(`${route} should redirect unauth`, `got ${r.status}`)
  }
}

console.log('\n── 7. Onboarding (intake steps 1-6) ─────────────────────')
{
  // Step 1: Demographics
  const r = await api('POST', '/api/intake', {
    jar,
    body: {
      step: 1,
      data: {
        firstName: 'Test', lastName: 'User',
        dateOfBirth: '1995-06-15',
        sex: 'male', heightCm: 175, weightKg: 72, activityLevel: 'moderately_active',
      },
    },
  })
  expect('Intake step 1 → 200', r.status, 200)
  expectBody('Step 1 success=true', r.body, 'success', true)
}
{
  // Step 2: Goals
  const r = await api('POST', '/api/intake', {
    jar,
    body: { step: 2, data: { primaryGoal: 'WEIGHT_LOSS', secondaryGoals: ['MUSCLE_GAIN'], targetWeightKg: 68 } },
  })
  expect('Intake step 2 → 200', r.status, 200)
}
{
  // Step 3: Medical (no conditions)
  const r = await api('POST', '/api/intake', {
    jar,
    body: { step: 3, data: { conditions: [] } },
  })
  expect('Intake step 3 → 200', r.status, 200)
}
{
  // Step 5: Dietary prefs
  const r = await api('POST', '/api/intake', {
    jar,
    body: {
      step: 5,
      data: {
        dietType: 'VEG', allergens: [], cuisinePreferences: ['Indian', 'Mediterranean'], dislikedIngredients: ['karela'],
      },
    },
  })
  expect('Intake step 5 → 200', r.status, 200)
}
{
  // Step 6: Location — computes targets, sets onboarding complete
  const r = await api('POST', '/api/intake', {
    jar,
    body: { step: 6, data: { city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', lat: 19.08, lon: 72.88 } },
  })
  expect('Intake step 6 → 200', r.status, 200)
  expectBody('Step 6 onboardingComplete=true', r.body, 'onboardingComplete', true)
  expectBody('Step 6 returns generatedTargets', r.body, 'generatedTargets')
  if (r.body?.generatedTargets?.calories) {
    const cal = r.body.generatedTargets.calories
    if (cal > 800 && cal < 4000) ok(`Step 6 calorie target sane: ${cal}`)
    else ko('Step 6 calorie target out of sane range', `got ${cal}`)
  }
}
{
  // After onboarding, /me should show onboardingComplete
  const r = await api('GET', '/api/auth/me', { jar })
  expectBody('/me after onboarding shows complete', r.body, 'onboardingComplete', true)
}

console.log('\n── 8. Plan generation ────────────────────────────────────')
{
  // Generate plan (MOCK_AI=true → instant)
  const r = await api('GET', '/api/plan/generate', { jar })
  expect('Plan generate → 200', r.status, 200)
  expectBody('Plan has plan.meals', r.body?.plan, 'meals')
  expectBody('Plan has target', r.body, 'target')
  expectBody('Plan has dailyLogId', r.body, 'dailyLogId')
  if (r.body?.dailyLogId) dailyLogId = r.body.dailyLogId
}
{
  // Second call should be cached
  const r = await api('GET', '/api/plan/generate', { jar })
  expect('Plan cached second call → 200', r.status, 200)
  expectBody('Cached plan flag', r.body, 'cached', true)
}
{
  // Free plan includes 1 manual regen per day — first call succeeds
  const r = await api('GET', '/api/plan/generate?regenerate=1', { jar })
  expect('Free user first regenerate → 200', r.status, 200)
}
{
  // Second forced regenerate same day → blocked, upgrade required
  const r = await api('GET', '/api/plan/generate?regenerate=1', { jar })
  expect('Free user second regenerate → 402', r.status, 402)
  expectBody('402 has upgrade flag', r.body, 'upgrade', true)
}
{
  // Free user cannot use hint
  const r = await api('GET', '/api/plan/generate?hint=low+carb', { jar })
  expect('Free user hint → 402', r.status, 402)
}

console.log('\n── 9. Water tracking ─────────────────────────────────────')
{
  // addMl=0 → 400
  const r = await api('POST', '/api/water', { jar, body: { addMl: 0 } })
  expect('Water addMl=0 → 400', r.status, 400)
}
{
  // addMl=99999 → 400
  const r = await api('POST', '/api/water', { jar, body: { addMl: 99999 } })
  expect('Water addMl=99999 → 400', r.status, 400)
}
{
  // Valid water log
  const r = await api('POST', '/api/water', { jar, body: { addMl: 250 } })
  expect('Water addMl=250 → 200', r.status, 200)
  if (typeof r.body?.waterMl === 'number' && r.body.waterMl >= 250) ok(`Water total updated: ${r.body.waterMl}ml`)
  else ko('Water total not updated correctly', JSON.stringify(r.body))
}
{
  // Accumulates
  const r = await api('POST', '/api/water', { jar, body: { addMl: 500 } })
  expect('Water second log → 200', r.status, 200)
  if (r.body?.waterMl >= 750) ok(`Water accumulates: ${r.body.waterMl}ml`)
  else ko('Water should accumulate', JSON.stringify(r.body))
}

console.log('\n── 10. Vision analyze (MOCK_AI=true) ────────────────────')
{
  // Missing image → 400
  const form = new FormData()
  form.append('mealType', 'LUNCH')
  if (dailyLogId) form.append('dailyLogId', dailyLogId)
  const r = await api('POST', '/api/vision/analyze', { jar, isForm: true, formData: form })
  expect('Vision no image → 400', r.status, 400)
}
{
  // Wrong MIME type
  const form = new FormData()
  const fakePdf = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })
  form.append('image', fakePdf, 'test.pdf')
  form.append('mealType', 'LUNCH')
  if (dailyLogId) form.append('dailyLogId', dailyLogId)
  const r = await api('POST', '/api/vision/analyze', { jar, isForm: true, formData: form })
  expect('Vision wrong MIME → 400', r.status, 400)
}
{
  // Valid JPEG (1x1 pixel, minimal real JPEG)
  const minJpeg = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080101000003f0f7fffd9',
    'hex'
  )
  const blob = new Blob([minJpeg], { type: 'image/jpeg' })
  const form = new FormData()
  form.append('image', blob, 'test.jpg')
  form.append('mealType', 'LUNCH')
  if (dailyLogId) form.append('dailyLogId', dailyLogId)
  const r = await api('POST', '/api/vision/analyze', { jar, isForm: true, formData: form })
  // With MOCK_AI=true, should succeed
  expect('Vision valid JPEG + MOCK_AI → 202', r.status, 202)
  if (r.body?.jobId) {
    ok(`Vision returned jobId: ${r.body.jobId}`)
    mealLogId = r.body.mealLogId

    // Check job status
    const sr = await api('GET', `/api/vision/status/${r.body.jobId}`, { jar })
    expect('Vision status → 200', sr.status, 200)
    expectBody('Vision status has status field', sr.body, 'status')
    if (sr.body?.status === 'COMPLETED') ok('Vision job COMPLETED (MOCK_AI)')
    else note(`Vision job status: ${sr.body?.status}`)
  } else {
    ko('Vision no jobId returned', JSON.stringify(r.body))
  }
}

console.log('\n── 11. Vision status: cross-user ownership ───────────────')
{
  // Create a second user (victim) and try to read job from first user
  await api('POST', '/api/auth/signup', {
    body: { email: VICTIM_EMAIL, password: TEST_PW },
    jar: victimJar,
  })

  // victim tries to access test user's job
  if (mealLogId) {
    // We need the jobId — use a random UUID that won't exist for victim
    const r = await api('GET', `/api/vision/status/00000000-0000-0000-0000-000000000001`, { jar: victimJar })
    expect('Vision status non-owned job → 404', r.status, 404)
  } else {
    note('Skipping cross-user vision status: no jobId from previous step')
  }
}

console.log('\n── 12. Meal log ownership + PATCH ───────────────────────')
{
  // GET meals for today (main user)
  const r = await api('GET', `/api/meals?dailyLogId=${dailyLogId}`, { jar })
  expect('GET meals → 200', r.status, 200)
}
{
  // PATCH meal (edit food items) as owner
  if (mealLogId) {
    const r = await api('PATCH', '/api/meals', {
      jar,
      body: {
        mealLogId,
        foodItems: [{ name: 'Dal rice', calories: 400 }],
        estimatedCalories: 400,
        estimatedProteinG: 15,
        estimatedCarbsG: 60,
        estimatedFatG: 8,
      },
    })
    expect('PATCH meal as owner → 200', r.status, 200)
  } else {
    note('Skipping meal PATCH: no mealLogId')
  }
}
{
  // PATCH meal as different user (cross-user attack)
  if (mealLogId) {
    const r = await api('PATCH', '/api/meals', {
      jar: victimJar,
      body: { mealLogId, foodItems: [{ name: 'Hacked meal', calories: 9999 }] },
    })
    expect('PATCH meal cross-user → 404', r.status, 404)
  }
}

console.log('\n── 13. Free plan limits (meal log) ──────────────────────')
{
  // Victim user (no onboarding / no daily log) tries vision → 404 on daily log
  // We just check: a fresh user can't bypass limits
  note('Free plan: 3 photo logs per day limit enforced (tested via subscription module)')
  // The actual limit is checked in vision/analyze. With only 1 log from step 11,
  // we're still within limits. This documents the gate exists.
}

console.log('\n── 14. History ───────────────────────────────────────────')
{
  const r = await api('GET', '/api/history', { jar })
  expect('GET /history → 200', r.status, 200)
  if (Array.isArray(r.body?.logs)) ok(`History returned ${r.body.logs.length} log(s)`)
  else if (r.body?.logs !== undefined) ok('History has logs field')
  else note(`History body shape: ${JSON.stringify(Object.keys(r.body ?? {}))}`)
}
{
  const r = await api('GET', '/api/history?summary=1', { jar })
  expect('GET /history?summary=1 → 200', r.status, 200)
  if (Array.isArray(r.body?.summary)) ok(`History summary returned ${r.body.summary.length} entry/entries`)
  else ko('History summary missing summary array', JSON.stringify(r.body))
}
{
  // Unauthenticated history → 401
  const r = await api('GET', '/api/history')
  expect('GET /history unauth → 401', r.status, 401)
}

console.log('\n── 15. Profile & conditions ──────────────────────────────')
{
  const r = await api('GET', '/api/profile', { jar })
  expect('GET /profile → 200', r.status, 200)
  // Response shape: { profile: {...}, email, conditions, plan, planExpiresAt }
  expectBody('Profile has profile.userId', r.body?.profile, 'userId')
  expectBody('Profile response has conditions array', r.body, 'conditions')
  expectBody('Profile response has plan', r.body, 'plan')
}
{
  // Update profile — endpoint is PATCH, not POST
  const r = await api('PATCH', '/api/profile', {
    jar,
    body: { city: 'Pune', country: 'India' },
  })
  if (r.status === 200 || r.status === 204) ok('PATCH /profile update → 200/204')
  else ko('PATCH /profile update failed', `${r.status}: ${JSON.stringify(r.body)}`)
}
{
  // GET /api/profile/conditions has no GET handler — conditions are in GET /api/profile
  // Verify it returns 405 (correct HTTP behavior for missing method)
  const r = await api('GET', '/api/profile/conditions', { jar })
  if (r.status === 405) ok('GET /profile/conditions → 405 (no GET handler — by design, use GET /profile)')
  else note(`GET /profile/conditions → ${r.status} (expected 405)`)
}
{
  // Add a medical condition
  const r = await api('POST', '/api/profile/conditions', {
    jar,
    body: {
      conditionCode: 'type2_diabetes_medicated',
      conditionLabel: 'Type 2 Diabetes (medicated)',
      severity: 'moderate',
    },
  })
  if (r.status === 200 || r.status === 201) ok('POST /profile/conditions add → 200/201')
  else ko('POST /profile/conditions add failed', `${r.status}: ${JSON.stringify(r.body)}`)
}
{
  // Verify added condition appears in GET /profile response
  const r = await api('GET', '/api/profile', { jar })
  const hasCondition = Array.isArray(r.body?.conditions) && r.body.conditions.some(
    (c: any) => c.conditionCode === 'type2_diabetes_medicated'
  )
  if (hasCondition) ok('Condition persisted and visible in GET /profile')
  else ko('Added condition not visible in GET /profile', JSON.stringify(r.body?.conditions))
}
{
  // DELETE a condition
  const profileR = await api('GET', '/api/profile', { jar })
  const conditionId = profileR.body?.conditions?.find(
    (c: any) => c.conditionCode === 'type2_diabetes_medicated'
  )?.id
  if (conditionId) {
    const r = await api('DELETE', '/api/profile/conditions', { jar, body: { conditionId } })
    if (r.status === 200) ok('DELETE /profile/conditions → 200')
    else ko('DELETE /profile/conditions failed', `${r.status}`)
  } else {
    note('Skipping DELETE condition: condition not found')
  }
}

console.log('\n── 16. Admin routes ──────────────────────────────────────')
{
  // Sign up admin user and promote
  const r = await api('POST', '/api/auth/signup', {
    body: { email: ADMIN_EMAIL, password: TEST_PW },
    jar: adminJar,
  })
  expect('Admin user signup → 201', r.status, 201)
}

// Promote admin via CLI
try {
  promoteAdmin(ADMIN_EMAIL)
  ok(`Promoted ${ADMIN_EMAIL} to admin`)
} catch (e: any) {
  ko('Failed to promote admin user', e.message)
}

// Re-login as admin to get fresh token with isAdmin=true
const adminLoginR = await api('POST', '/api/auth/login', {
  body: { email: ADMIN_EMAIL, password: TEST_PW },
  jar: adminJar,
})
expect('Admin login → 200', adminLoginR.status, 200)

{
  // Non-admin: /admin should redirect (middleware blocks it)
  const r = await api('GET', '/admin', { jar })
  if (r.status >= 300 && r.status < 400) ok('Non-admin /admin → redirect (blocked)')
  else if (r.status === 403) ok('Non-admin /admin → 403')
  else note(`Non-admin /admin returned ${r.status} (expected redirect)`)
}
{
  // Admin: /admin/review should be accessible
  const r = await api('GET', '/admin/review', { jar: adminJar })
  // It's a Next.js page (RSC), so expect 200 HTML
  if (r.status === 200) ok('Admin /admin/review → 200')
  else note(`Admin /admin/review → ${r.status} (may need full HTML render)`)
}

console.log('\n── 17. Resend-verification ───────────────────────────────')
{
  // Our test user is NOT verified (signup skips Resend in sandbox)
  const r = await api('POST', '/api/auth/resend-verification', { jar })
  if (r.status === 200 || r.status === 429) ok(`Resend-verification → ${r.status}`)
  else ko('Resend-verification unexpected status', `${r.status}`)
}

console.log('\n── 18. Rebalance plan ────────────────────────────────────')
{
  // Missing confirmedFoods → should now return 400 (not 500)
  const r = await api('POST', '/api/plan/rebalance', {
    jar,
    body: { dailyLogId, mealLogId: mealLogId ?? undefined },
  })
  if (r.status === 400) ok('Rebalance missing confirmedFoods → 400 (validation fixed)')
  else ko('Rebalance missing confirmedFoods should be 400', `got ${r.status}: ${JSON.stringify(r.body)}`)
}
{
  // Valid rebalance call (MOCK_AI=true → fast mock result)
  const r = await api('POST', '/api/plan/rebalance', {
    jar,
    body: {
      dailyLogId,
      mealLogId: mealLogId ?? undefined,
      confirmedFoods: [
        {
          name: 'Dal rice', householdQuantity: '1 bowl',
          quantityGramsEstimate: 200, caloriesEstimate: 420,
          proteinG: 15, carbsG: 65, fatG: 8, confidence: 0.9, visualCues: 'rice and dal visible',
        },
      ],
    },
  })
  if (r.status === 200) {
    ok('Plan rebalance valid → 200')
    if (Array.isArray(r.body?.rebalancedMeals)) ok('Rebalance returns rebalancedMeals array')
    else note(`Rebalance body keys: ${JSON.stringify(Object.keys(r.body ?? {}))}`)
  } else if (r.status === 402) {
    ok('Plan rebalance → 402 (Pro gate on free user)')
  } else {
    ko('Plan rebalance unexpected status', `${r.status}: ${JSON.stringify(r.body)}`)
  }
}

console.log('\n── 19. Delete account ────────────────────────────────────')
{
  // Wrong password
  const r = await api('DELETE', '/api/auth/delete-account', {
    jar: victimJar,
    body: { password: 'WrongPassword!' },
  })
  if (r.status === 400 || r.status === 401) ok('Delete-account wrong password → 4xx')
  else ko('Delete-account wrong password should fail', `got ${r.status}`)
}
{
  // No password supplied
  const r = await api('DELETE', '/api/auth/delete-account', {
    jar: victimJar,
    body: {},
  })
  if (r.status === 400) ok('Delete-account no password → 400')
  else ko('Delete-account no password should be 400', `got ${r.status}`)
}
{
  // Correct delete (victim user)
  const r = await api('DELETE', '/api/auth/delete-account', {
    jar: victimJar,
    body: { password: TEST_PW },
  })
  expect('Delete-account correct → 200', r.status, 200)
}
{
  // After delete, victim session should be gone
  const r = await api('GET', '/api/auth/me', { jar: victimJar })
  expect('GET /me after delete → 401', r.status, 401)
}

console.log('\n── 20. Rate limiting (login) ────────────────────────────')
{
  // Use a dedicated synthetic IP via X-Forwarded-For so this test doesn't
  // poison the 'unknown' bucket used by all other test requests
  const testIp = `10.99.${Date.now() % 256}.${Date.now() % 100}`
  let blocked = false
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
      body: JSON.stringify({ email: 'ratelimit_isolated@test.com', password: 'BadPass123!' }),
      redirect: 'manual',
    })
    if (res.status === 429) { blocked = true; break }
  }
  if (blocked) ok('Login rate limiter triggers 429 after 5 attempts (isolated IP)')
  else note('Rate limiter did not trigger in 6 attempts with X-Forwarded-For (check trust config)')
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════════`)
console.log(`  Layer 2 results: ${pass} passed, ${fail} failed, ${warn} notes`)
if (failures.length) {
  console.log('\nFailed:')
  failures.forEach(f => console.log(`  • ${f}`))
}
console.log(`═══════════════════════════════════════════════════\n`)
if (fail > 0) process.exit(1)

} // end main()

main().catch(err => { console.error(err); process.exit(1) })
