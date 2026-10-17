// Replays the real backend's login response through the backend adapter (src/api/backend.ts)
// with a fake fetch, and checks the session the app builds from it. Run: npm run test:session
import assert from 'node:assert/strict'

const store: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] }
;(globalThis as any).window = { location: { origin: 'http://localhost:5173' } }

// Shape copied from POST /api/v1/auth/login on the LeadFlow backend (tokens replaced)
const LOGIN = {
  data: {
    user: { id: 'u-1', email: 'demo@leadflow.local', fullName: 'Demo Owner', phone: '', language: 'ar', timezone: 'Africa/Cairo', emailVerified: true, isPlatformAdmin: false, createdAt: '2026-10-17T00:58:59Z' },
    memberships: [{
      organizationId: 'org-1', organizationName: 'Demo Realty', organizationStatus: 'active', roleId: 'r-1', roleKey: 'owner', roleName: 'Organization Owner',
      permissions: ['org.manage', 'org.close', 'members.view', 'members.manage', 'roles.manage', 'leads.view_all', 'leads.view_own', 'leads.create', 'leads.update', 'leads.delete', 'leads.assign', 'leads.import', 'leads.export', 'leads.merge', 'settings.lead_fields', 'pipeline.manage', 'tasks.view_all', 'tasks.manage_all', 'automations.view', 'automations.manage', 'ai.use', 'integrations.view', 'integrations.manage', 'reports.view', 'reports.view_team', 'billing.view', 'billing.manage', 'audit.view'],
    }],
    tokens: { access: 'ACCESS', refresh: 'REFRESH', accessExpiresAt: '2026-10-17T20:13:02+00:00', sessionId: 's-1', tokenType: 'Bearer' },
  },
}

const seen: Array<{ url: string; headers: Record<string, string> }> = []
let currentStatus = 200
;(globalThis as any).fetch = async (url: string, init: any) => {
  seen.push({ url, headers: init.headers })
  const json = (status: number, body: any) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (url.includes('auth/login')) return json(200, LOGIN)
  if (url.includes('organizations/current')) {
    return currentStatus === 200
      ? json(200, { data: { id: 'org-1', name: 'Demo Realty', timezone: 'Africa/Cairo', language: 'ar', industry: 'real_estate', businessHours: { days: [6, 0, 1, 2, 3], start: '09:00', end: '18:00' }, leadSettings: { lostReasons: ['Price', 'No response'] } } })
      : json(currentStatus, { error: { code: 'error', message: 'boom' } })
  }
  return json(404, { error: { code: 'not_found', message: url } })
}

const { auth } = await import('../src/api/backend')
const { P } = await import('../src/config/permissions')

const me = await auth.login('demo@leadflow.local', 'x')
assert.equal(store.token, 'ACCESS')
assert.equal(store.refreshToken, 'REFRESH')
assert.equal(store.orgId, 'org-1')
assert.equal(me.user.name, 'Demo Owner')
assert.equal(me.organization.id, 'org-1')
assert.equal(me.organization.locale, 'ar')
assert.deepEqual(me.organization.leadSettings?.lostReasons, ['Price', 'No response'])
assert.equal(me.membership.role, 'owner')
for (const p of [P.settingsManage, P.tasksManage, P.tasksViewAll, P.leadsViewAll, P.membersManage, P.billingManage, P.reportsView]) {
  assert.ok(me.membership.permissions.includes(p), `owner should have ${p}`)
}
assert.ok(me.membership.permissions.includes('org.manage'), 'backend keys are kept')
assert.deepEqual(me.organizations, [{ id: 'org-1', name: 'Demo Realty', role: 'owner' }])
const cur = seen.find((r) => r.url.includes('organizations/current'))!
assert.equal(cur.headers['X-Organization-ID'], 'org-1')
assert.equal(cur.headers.Authorization, 'Bearer ACCESS')
assert.ok(!seen.some((r) => r.url.includes('auth/me')), 'login response already has the memberships')
console.log('  ✓ login response → session (tokens, tenant header, owner permissions)')

// organizations/current failing must not block sign-in
currentStatus = 500
const me2 = await auth.login('demo@leadflow.local', 'x')
assert.equal(me2.organization.name, 'Demo Realty')
console.log('  ✓ sign-in still works when organizations/current fails')
console.log('\n2 checks passed')
