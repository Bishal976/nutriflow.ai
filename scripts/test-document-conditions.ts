/**
 * E2E test: document → condition attribution and deletion precision.
 * Verifies that deleting one of several uploaded documents only clears
 * conditions no longer backed by any remaining document, that confirming a
 * doc-extracted condition elsewhere never creates a duplicate row, and that
 * a user-confirmed condition survives deletion of the document it originally
 * came from.
 *
 * Seeds medical_documents/document_conditions directly via SQL rather than a
 * real upload — there's no test-friendly way to fabricate a Vercel Blob file,
 * and this isolates the test to the actual logic under test (DELETE
 * /api/documents/[id] and the upsert paths), not the upload/extraction step.
 *
 * Run: node --env-file=.env.local -r tsx/cjs scripts/test-document-conditions.ts
 * Requires dev server at localhost:3000, DB reachable.
 */
import postgres from 'postgres'

const BASE = 'http://localhost:3000'
let pass = 0, fail = 0
type CookieJar = Map<string, string>

function buildCookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
function parseCookies(res: Response, jar: CookieJar) {
  const headers = res.headers as any
  const cookies: string[] = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
  for (const part of cookies) {
    const kv = part.split(';')[0].trim()
    const eq = kv.indexOf('=')
    if (eq < 0) continue
    const k = kv.slice(0, eq).trim(), v = kv.slice(eq + 1).trim()
    if (v === '' || v === 'deleted') jar.delete(k); else jar.set(k, v)
  }
}
async function api(method: string, path: string, jar: CookieJar, body?: unknown) {
  const headers: Record<string, string> = { Cookie: buildCookieHeader(jar) }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  parseCookies(res, jar)
  let json: any = null
  try { json = await res.json() } catch { /* empty */ }
  return { status: res.status, body: json }
}
function ok(label: string) { console.log(`  ✅ ${label}`); pass++ }
function ko(label: string, detail?: string) { console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
function assert(label: string, cond: boolean, detail?: string) { cond ? ok(label) : ko(label, detail) }

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 15 })
  const email = `docconditions_${Date.now()}@test.nutriflow`
  const jar: CookieJar = new Map()

  await api('POST', '/api/auth/signup', jar, { email, password: 'TestPass123!' })
  await api('POST', '/api/intake', jar, { step: 1, data: { firstName: 'T', lastName: 'U', dateOfBirth: '1995-01-01', sex: 'male', heightCm: 175, weightKg: 75, activityLevel: 'sedentary' } })
  await api('POST', '/api/intake', jar, { step: 2, data: { primaryGoal: 'MAINTENANCE', secondaryGoals: [] } })
  await api('POST', '/api/intake', jar, { step: 3, data: { conditions: [] } })
  await api('POST', '/api/intake', jar, { step: 5, data: { dietType: 'VEG', allergens: [], cuisinePreferences: ['North Indian'], dislikedIngredients: [] } })
  await api('POST', '/api/intake', jar, { step: 6, data: { city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' } })

  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`
  const userId = user.id

  const [doc1] = await sql`INSERT INTO medical_documents (user_id, storage_key, job_status) VALUES (${userId}, 'fake/doc1.pdf', 'COMPLETED') RETURNING id`
  const [doc2] = await sql`INSERT INTO medical_documents (user_id, storage_key, job_status) VALUES (${userId}, 'fake/doc2.pdf', 'COMPLETED') RETURNING id`

  // doc1 extracted CKD stage 3 (unique to doc1) and Type 2 Diabetes (also seen in doc2)
  // doc2 extracted Type 2 Diabetes only
  await sql`INSERT INTO medical_conditions (user_id, condition_code, condition_label, user_confirmed) VALUES
    (${userId}, 'ckd_stage3', 'Chronic Kidney Disease Stage 3', false),
    (${userId}, 'type2_diabetes_medicated', 'Type 2 Diabetes (on medication)', false)`
  await sql`INSERT INTO document_conditions (document_id, user_id, condition_code) VALUES
    (${doc1.id}, ${userId}, 'ckd_stage3'),
    (${doc1.id}, ${userId}, 'type2_diabetes_medicated'),
    (${doc2.id}, ${userId}, 'type2_diabetes_medicated')`

  console.log('\n── 1. Delete doc1 (CKD unique to it, diabetes also backed by doc2) ──')
  const del1 = await api('DELETE', `/api/documents/${doc1.id}`, jar)
  assert('DELETE doc1 → 200', del1.status === 200, JSON.stringify(del1.body))

  const afterDoc1 = await sql`SELECT condition_code FROM medical_conditions WHERE user_id = ${userId}`
  const codesAfterDoc1 = afterDoc1.map(r => r.condition_code)
  assert('CKD (unique to doc1) removed', !codesAfterDoc1.includes('ckd_stage3'), JSON.stringify(codesAfterDoc1))
  assert('Diabetes (still backed by doc2) preserved', codesAfterDoc1.includes('type2_diabetes_medicated'), JSON.stringify(codesAfterDoc1))
  assert('riskLevel dropped correctly after removing CKD', del1.body?.riskLevel === 'MODERATE', JSON.stringify(del1.body))

  console.log('\n── 2. Delete doc2 (last document backing diabetes) ──')
  const del2 = await api('DELETE', `/api/documents/${doc2.id}`, jar)
  assert('DELETE doc2 → 200', del2.status === 200, JSON.stringify(del2.body))
  const afterDoc2 = await sql`SELECT condition_code FROM medical_conditions WHERE user_id = ${userId}`
  assert('Diabetes removed once no document backs it', afterDoc2.length === 0, JSON.stringify(afterDoc2))
  assert('riskLevel back to LOW with no conditions left', del2.body?.riskLevel === 'LOW', JSON.stringify(del2.body))

  console.log('\n── 3. Upsert dedup: confirming a doc-extracted condition via step 3 creates no duplicate ──')
  const [doc3] = await sql`INSERT INTO medical_documents (user_id, storage_key, job_status) VALUES (${userId}, 'fake/doc3.pdf', 'COMPLETED') RETURNING id`
  await sql`INSERT INTO medical_conditions (user_id, condition_code, condition_label, user_confirmed) VALUES (${userId}, 'hypertension_medicated', 'High Blood Pressure (on medication)', false)`
  await sql`INSERT INTO document_conditions (document_id, user_id, condition_code) VALUES (${doc3.id}, ${userId}, 'hypertension_medicated')`

  const confirmStep3 = await api('POST', '/api/intake', jar, { step: 3, data: { conditions: [{ conditionCode: 'hypertension_medicated', conditionLabel: 'High Blood Pressure (on medication)', onMedication: true }] } })
  assert('Step 3 confirm → 200', confirmStep3.status === 200, JSON.stringify(confirmStep3.body))

  const rows = await sql`SELECT id, user_confirmed FROM medical_conditions WHERE user_id = ${userId} AND condition_code = 'hypertension_medicated'`
  assert('Exactly one row exists (no duplicate created)', rows.length === 1, JSON.stringify(rows))
  assert('Row upgraded to userConfirmed=true', rows[0]?.user_confirmed === true, JSON.stringify(rows))

  console.log('\n── 4. Deleting the source document does not remove a now-user-confirmed condition ──')
  const del3 = await api('DELETE', `/api/documents/${doc3.id}`, jar)
  assert('DELETE doc3 → 200', del3.status === 200, JSON.stringify(del3.body))
  const afterDoc3 = await sql`SELECT condition_code FROM medical_conditions WHERE user_id = ${userId}`
  assert('Hypertension (user-confirmed) survives document deletion', afterDoc3.some(r => r.condition_code === 'hypertension_medicated'), JSON.stringify(afterDoc3))

  console.log(`\n═══════════════════════════════════════\n  Document-conditions E2E: ${pass} passed, ${fail} failed\n═══════════════════════════════════════`)

  await sql`DELETE FROM users WHERE id = ${userId}`
  await sql.end()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
