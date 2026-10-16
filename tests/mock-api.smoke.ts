// Smoke test for the business rules in the mock API (src/mock). It drives the same
// fetch-shaped entry point the browser uses. Run: npm run test:mock
import assert from 'node:assert/strict'

// minimal browser globals the mock relies on
const store: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] }
;(globalThis as any).window = { location: { origin: 'http://localhost:5173' } }
if (!(globalThis as any).navigator) (globalThis as any).navigator = { userAgent: 'node-smoke-test' }

const { mockFetch } = await import('../src/mock/server')
const BASE = 'http://localhost:3000/api/v1/'

async function call(method: string, path: string, body?: any, token?: string, headers: Record<string, string> = {}) {
  const res = await mockFetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, json }
}
const login = async (email: string) => (await call('POST', 'auth/login', { email, password: 'Password123!' })).json.data.token

let passed = 0
const test = async (name: string, fn: () => Promise<void>) => {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const owner = await login('owner@nileproperties.test')
const agent = await login('sara@nileproperties.test')
const analyst = await login('analyst@nileproperties.test')
const clinic = await login('owner@smileclinic.test')

await test('wrong password is rejected with 401', async () => {
  const r = await call('POST', 'auth/login', { email: 'owner@nileproperties.test', password: 'nope' })
  assert.equal(r.status, 401)
})

await test('inactive member cannot sign in', async () => {
  const r = await call('POST', 'auth/login', { email: 'mona@nileproperties.test', password: 'Password123!' })
  assert.equal(r.status, 403)
})

await test('list is paginated server-side', async () => {
  const r = await call('GET', 'leads?page=2&pageSize=10', undefined, owner)
  assert.equal(r.status, 200)
  assert.equal(r.json.data.length, 10)
  assert.equal(r.json.pagination.page, 2)
  assert.ok(r.json.pagination.total >= 70)
})

await test('tenant isolation: another organization gets 404 for a known id', async () => {
  const id = (await call('GET', 'leads?pageSize=1', undefined, owner)).json.data[0].id
  assert.equal((await call('GET', `leads/${id}`, undefined, clinic)).status, 404)
  const clinicIds = (await call('GET', 'leads?pageSize=100', undefined, clinic)).json.data.map((l: any) => l.id)
  assert.ok(!clinicIds.includes(id))
})

await test('sales agent only sees own leads', async () => {
  const r = await call('GET', 'leads?pageSize=100', undefined, agent)
  assert.ok(r.json.data.length > 0)
  assert.ok(r.json.data.every((l: any) => l.owner?.id === 'usr_sara'))
})

await test('analyst is read-only', async () => {
  const r = await call('POST', 'leads', { name: 'X', phone: '+201111111111' }, analyst)
  assert.equal(r.status, 403)
})

await test('lead without phone or email is rejected', async () => {
  const r = await call('POST', 'leads', { name: 'No contact' }, owner)
  assert.equal(r.status, 422)
  assert.ok(r.json.error.details.phone)
})

let created: any
await test('new lead is created, normalized, AI-classified and auto-assigned to an active agent', async () => {
  const r = await call('POST', 'leads', { name: 'Smoke Lead', phone: '01012345678', email: 'SMOKE@Example.com', message: 'محتاج شقة في الشيخ زايد في حدود 5 مليون واستلام قريب.' }, owner)
  assert.equal(r.status, 201)
  created = r.json.data
  assert.equal(created.phone, '+201012345678')
  assert.equal(created.email, 'smoke@example.com')
  assert.ok(['usr_sara', 'usr_omar'].includes(created.owner?.id), 'assigned to an active agent, never the inactive one')
  assert.equal(created.ai.classification, 'Real Estate Inquiry')
  assert.equal(created.ai.extracted.area, 'Sheikh Zayed')
  assert.equal(created.ai.extracted.budget, 5_000_000)
  assert.equal(created.ai.priority, 'high')
})

await test('same contact details merge into the existing lead (default policy)', async () => {
  const r = await call('POST', 'leads', { name: 'Smoke Again', phone: '+20 101 234 5678', message: 'Second message' }, owner)
  assert.equal(r.status, 200)
  assert.equal(r.json.data.id, created.id)
})

await test('Idempotency-Key replays the first response instead of writing twice', async () => {
  const headers = { 'Idempotency-Key': 'smoke-key-1' }
  const a = await call('POST', 'leads', { name: 'Idem', phone: '+201099999999' }, owner, headers)
  const b = await call('POST', 'leads', { name: 'Idem', phone: '+201099999999' }, owner, headers)
  assert.equal(a.json.data.id, b.json.data.id)
  assert.equal(b.status, a.status)
})

await test('assigning to an inactive member is refused', async () => {
  const r = await call('PATCH', `leads/${created.id}`, { ownerId: 'usr_mona' }, owner)
  assert.equal(r.status, 422)
})

await test('moving to Lost requires a reason', async () => {
  const stages = (await call('GET', 'pipeline-stages', undefined, owner)).json.data
  const lost = stages.find((s: any) => s.type === 'lost')
  assert.equal((await call('POST', `leads/${created.id}/move`, { stageId: lost.id }, owner)).status, 422)
})

await test('Won cancels automated follow-ups', async () => {
  const before = (await call('GET', `leads/${created.id}/tasks`, undefined, owner)).json.data
  assert.ok(before.some((t: any) => t.automated && t.status === 'open'))
  const won = (await call('GET', 'pipeline-stages', undefined, owner)).json.data.find((s: any) => s.type === 'won')
  assert.equal((await call('POST', `leads/${created.id}/move`, { stageId: won.id }, owner)).status, 200)
  const after = (await call('GET', `leads/${created.id}/tasks`, undefined, owner)).json.data
  assert.ok(after.filter((t: any) => t.automated).every((t: any) => t.status !== 'open'))
})

await test('CSV import validates rows and imports only good ones', async () => {
  const rows = [
    { Name: 'Import One', Phone: '+201055500001' },
    { Name: '', Phone: '+201055500002' },
    { Name: 'Import Dup', Phone: '+201055500001' },
  ]
  const mapping = { Name: 'name', Phone: 'phone' }
  const preview = (await call('POST', 'leads/imports/preview', { rows, mapping }, owner)).json.data
  assert.deepEqual([preview.totals.valid, preview.totals.invalid, preview.totals.duplicate], [1, 1, 1])
  const job = (await call('POST', 'leads/imports', { rows, mapping, duplicatePolicy: 'skip', fileName: 't.csv' }, owner)).json.data
  assert.equal(job.created, 1)
  assert.equal(job.failed.length, 1)
})

await test('webhook: bad signature rejected, same event id processed once', async () => {
  const integ = (await call('POST', 'integrations/website_form/connect', {}, owner)).json
  const key = integ.data.config.endpoint.split('/').pop()
  assert.equal((await call('POST', `webhooks/leads/${key}`, { name: 'W', phone: '+201077700000' }, undefined, { 'X-Signature': 'wrong', 'X-Event-Id': 'e1' })).status, 401)
  const h = { 'X-Signature': integ.secret, 'X-Event-Id': 'evt-smoke-1' }
  const first = await call('POST', `webhooks/leads/${key}`, { name: 'Webhook Lead', phone: '+201077700000' }, undefined, h)
  const second = await call('POST', `webhooks/leads/${key}`, { name: 'Webhook Lead', phone: '+201077700000' }, undefined, h)
  assert.equal(first.status, 202)
  assert.equal(second.json.data.duplicateEvent, true)
})

await test('member cannot change their own role; last owner is protected', async () => {
  const members = (await call('GET', 'members', undefined, owner)).json.data
  const me = members.find((m: any) => m.user.id === 'usr_owner')
  assert.equal((await call('PATCH', `members/${me.id}`, { role: 'admin' }, owner)).status, 403)
})

await test('export requires permission and returns CSV', async () => {
  assert.equal((await call('GET', 'leads/export?format=csv', undefined, agent)).status, 403)
  const r = await call('GET', 'leads/export?format=csv', undefined, owner)
  assert.equal(r.status, 200)
  assert.ok(String(r.json).startsWith('id,name,email'))
})

await test('dashboard and reports compute', async () => {
  const d = (await call('GET', 'dashboard/summary', undefined, owner)).json.data
  assert.ok(d.kpis.newLeads > 0)
  const r = (await call('GET', 'reports', undefined, owner)).json.data
  assert.ok(r.funnel.length >= 4)
  assert.equal((await call('GET', 'reports', undefined, agent)).status, 403)
})


await test('funnel never grows from one stage to the next', async () => {
  const funnel = (await call('GET', 'reports', undefined, owner)).json.data.funnel
  for (let i = 1; i < funnel.length; i++) assert.ok(funnel[i].count <= funnel[i - 1].count, `${funnel[i].stage} > ${funnel[i - 1].stage}`)
})
console.log(`\n${passed} checks passed`)
