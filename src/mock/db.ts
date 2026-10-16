// In-browser stand-in for the PostgreSQL schema in docs/DATABASE.md.
// Rows are stored flat (foreign keys, not nested objects) exactly like the real tables,
// so the handlers have to do the same joins/authorization the real backend does.

import { ROLE_PERMISSIONS } from '@/config/permissions'

const STORAGE_KEY = 'leadflow.mock.db.v2'

export type Row = Record<string, any>

export interface MockDb {
  version: number
  organizations: Row[]
  users: Row[]
  memberships: Row[]
  invitations: Row[]
  sessions: Row[]
  passwordResets: Row[]
  stages: Row[]
  sources: Row[]
  leads: Row[]
  activities: Row[]
  stageHistory: Row[]
  tasks: Row[]
  automations: Row[]
  runs: Row[]
  processedEvents: Row[]
  integrations: Row[]
  notifications: Row[]
  preferences: Row[]
  imports: Row[]
  auditLogs: Row[]
  subscriptions: Row[]
  meta: { lastTickAt: number }
}

let counter = 0
export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const nowIso = () => new Date().toISOString()

// Deterministic RNG so every fresh seed produces the same demo data
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export const DEMO_PASSWORD = 'Password123!'

export const DEMO_ACCOUNTS = [
  { email: 'owner@nileproperties.test', role: 'owner' },
  { email: 'admin@nileproperties.test', role: 'admin' },
  { email: 'manager@nileproperties.test', role: 'sales_manager' },
  { email: 'sara@nileproperties.test', role: 'sales_agent' },
  { email: 'analyst@nileproperties.test', role: 'analyst' },
  { email: 'owner@smileclinic.test', role: 'owner' },
]

export const DEFAULT_STAGES = [
  { name: 'New', key: 'new', type: 'open', color: '#64748B', autoTask: null },
  { name: 'Contacted', key: 'contacted', type: 'open', color: '#378FF5', autoTask: null },
  { name: 'Qualified', key: 'qualified', type: 'open', color: '#6D6CF7', autoTask: { enabled: true, title: 'Schedule a viewing / meeting', type: 'meeting', dueInHours: 24 } },
  { name: 'Proposal Sent', key: 'proposal_sent', type: 'open', color: '#E0A800', autoTask: { enabled: true, title: 'Follow up on the proposal', type: 'follow_up', dueInHours: 48 } },
  { name: 'Won', key: 'won', type: 'won', color: '#03C95A', autoTask: null },
  { name: 'Lost', key: 'lost', type: 'lost', color: '#E70D0D', autoTask: null },
]

export const DEFAULT_AUTOMATIONS = [
  { type: 'lead_ingestion', workflowId: 'wf_a_lead_ingestion', enabled: true, config: { dedupePolicy: 'merge', matchOn: ['email', 'phone'] } },
  { type: 'lead_assignment', workflowId: 'wf_b_lead_assignment', enabled: true, config: { strategy: 'round_robin', fallback: 'managers' } },
  { type: 'first_response_sla', workflowId: 'wf_c_follow_up', enabled: true, config: { minutes: 15, businessHoursOnly: true } },
  { type: 'stale_lead_follow_up', workflowId: 'wf_c_follow_up', enabled: true, config: { businessDays: 1 } },
  { type: 'stop_on_close', workflowId: 'wf_c_follow_up', enabled: true, config: {} },
  { type: 'ai_classification', workflowId: 'wf_d_ai_classification', enabled: true, config: { minConfidence: 0.6 } },
  { type: 'daily_report', workflowId: 'wf_e_daily_report', enabled: false, config: { hour: 9, channels: ['email'] } },
]

export const DEFAULT_INTEGRATIONS = [
  { provider: 'website_form', priority: 'core' },
  { provider: 'email', priority: 'core' },
  { provider: 'csv_import', priority: 'core' },
  { provider: 'google_sheets', priority: 'later' },
  { provider: 'external_crm', priority: 'later' },
  { provider: 'calendar', priority: 'later' },
  { provider: 'whatsapp_business', priority: 'future' },
  { provider: 'ad_leads', priority: 'future' },
]

export const PLANS: Record<string, any> = {
  starter: { id: 'starter', name: 'Starter', priceMonthly: 49, currency: 'USD', limits: { leads: 1000, members: 5, automation_runs: 5000, ai_requests: 500 } },
  growth: { id: 'growth', name: 'Growth', priceMonthly: 149, currency: 'USD', limits: { leads: 10000, members: 20, automation_runs: 50000, ai_requests: 5000 } },
}

export const NOTIFICATION_TYPES = [
  'lead_assigned', 'task_due', 'follow_up_overdue', 'integration_failed', 'import_failed_rows', 'automation_finished', 'usage_limit',
]

export function defaultPreferences() {
  return Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, { inApp: true, email: t !== 'automation_finished' }]))
}

export function createOrganizationRows(db: MockDb, org: Row) {
  db.organizations.push(org)
  DEFAULT_STAGES.forEach((s, i) => db.stages.push({ id: uid('stg'), organizationId: org.id, position: i, ...structuredClone(s) }))
  ;[
    ['Website', 'website'], ['Facebook Ads', 'ads'], ['Referral', 'referral'], ['CSV Import', 'import'], ['Walk-in / Phone', 'manual'],
  ].forEach(([name, type]) => db.sources.push({ id: uid('src'), organizationId: org.id, name, type, active: true }))
  DEFAULT_AUTOMATIONS.forEach((a) => db.automations.push({ id: uid('aut'), organizationId: org.id, updatedAt: nowIso(), ...structuredClone(a) }))
  DEFAULT_INTEGRATIONS.forEach((i) =>
    db.integrations.push({
      id: uid('int'), organizationId: org.id, provider: i.provider, priority: i.priority,
      status: i.priority === 'future' ? 'coming_soon' : 'disconnected',
      config: {}, secret: null, lastSyncAt: null, lastError: null, eventsLast7d: 0,
    })
  )
  db.subscriptions.push({
    organizationId: org.id, planId: 'starter', status: 'trialing',
    currentPeriodEnd: new Date(Date.now() + 14 * 864e5).toISOString(),
  })
}

const FIRST = ['Ahmed', 'Mohamed', 'Mahmoud', 'Youssef', 'Omar', 'Karim', 'Mostafa', 'Hassan', 'Nour', 'Mariam', 'Salma', 'Hana', 'Laila', 'Yasmin', 'Farida', 'Dina', 'Khaled', 'Tarek', 'Rana', 'Aya']
const LAST = ['Hassan', 'Ali', 'Ibrahim', 'Mostafa', 'Fathy', 'Saeed', 'Abdelrahman', 'Kamal', 'Nabil', 'Gamal', 'Samir', 'Fouad']
const MESSAGES = [
  'محتاج شقة في الشيخ زايد في حدود 5 مليون واستلام قريب.',
  'Looking for a 3-bedroom apartment in New Cairo, budget around 7M EGP, ready to move.',
  'عايز فيلا في التجمع الخامس، الميزانية 15 مليون، مش مستعجل.',
  'Interested in a studio in the New Capital for investment. What are the payment plans?',
  'ممكن عرض سعر لوحدة في 6 أكتوبر؟',
  'I saw your ad on Facebook, please call me.',
  'Need a duplex in Sheikh Zayed, budget 9 million, urgent.',
  null,
]
const AREAS = ['Sheikh Zayed', 'New Cairo', 'New Capital', '6th of October', 'North Coast']
const CAMPAIGNS = ['Summer Launch 2026', 'Zayed Residences', 'Ramadan Offers', null]

export function seed(): MockDb {
  const r = rng(42)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const ago = (days: number, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString()

  const db: MockDb = {
    version: 2, organizations: [], users: [], memberships: [], invitations: [], sessions: [], passwordResets: [],
    stages: [], sources: [], leads: [], activities: [], stageHistory: [], tasks: [], automations: [], runs: [],
    processedEvents: [], integrations: [], notifications: [], preferences: [], imports: [], auditLogs: [],
    subscriptions: [], meta: { lastTickAt: 0 },
  }

  const orgA = {
    id: 'org_nile', name: 'Nile Properties', industry: 'real_estate', timezone: 'Africa/Cairo', locale: 'en', currency: 'EGP',
    businessHours: { start: '09:00', end: '18:00', days: [0, 1, 2, 3, 4] }, onboardingCompleted: true, planId: 'starter',
    webhookKey: 'wk_nile_demo', roundRobinCursor: 0, createdAt: ago(60),
  }
  const orgB = {
    id: 'org_smile', name: 'Smile Dental Clinic', industry: 'clinic', timezone: 'Asia/Dubai', locale: 'en', currency: 'AED',
    businessHours: { start: '10:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] }, onboardingCompleted: true, planId: 'starter',
    webhookKey: 'wk_smile_demo', roundRobinCursor: 0, createdAt: ago(30),
  }
  createOrganizationRows(db, orgA)
  createOrganizationRows(db, orgB)

  const people = [
    { id: 'usr_owner', name: 'Hesham Adel', email: 'owner@nileproperties.test', org: orgA.id, role: 'owner', specialties: [] },
    { id: 'usr_admin', name: 'Mai Fawzy', email: 'admin@nileproperties.test', org: orgA.id, role: 'admin', specialties: [] },
    { id: 'usr_manager', name: 'Karim Nabil', email: 'manager@nileproperties.test', org: orgA.id, role: 'sales_manager', specialties: [] },
    { id: 'usr_sara', name: 'Sara Mostafa', email: 'sara@nileproperties.test', org: orgA.id, role: 'sales_agent', specialties: ['Sheikh Zayed', '6th of October'] },
    { id: 'usr_omar', name: 'Omar Khaled', email: 'omar@nileproperties.test', org: orgA.id, role: 'sales_agent', specialties: ['New Cairo', 'New Capital'] },
    { id: 'usr_mona', name: 'Mona Saeed', email: 'mona@nileproperties.test', org: orgA.id, role: 'sales_agent', specialties: [], status: 'inactive' },
    { id: 'usr_analyst', name: 'Youssef Ali', email: 'analyst@nileproperties.test', org: orgA.id, role: 'analyst', specialties: [] },
    { id: 'usr_clinic', name: 'Dr. Laila Hassan', email: 'owner@smileclinic.test', org: orgB.id, role: 'owner', specialties: [] },
  ]
  people.forEach((p) => {
    db.users.push({ id: p.id, name: p.name, email: p.email, password: DEMO_PASSWORD, phone: null, locale: 'en', emailVerified: true, createdAt: ago(60) })
    db.memberships.push({
      id: uid('mem'), organizationId: p.org, userId: p.id, role: p.role, status: p.status ?? 'active',
      specialties: p.specialties, lastActiveAt: ago(0, Math.floor(r() * 48)), joinedAt: ago(55),
    })
    db.preferences.push({ organizationId: p.org, userId: p.id, prefs: defaultPreferences() })
  })

  db.invitations.push({
    id: uid('inv'), organizationId: orgA.id, email: 'new.agent@nileproperties.test', role: 'sales_agent', token: 'demo-invite-token',
    status: 'pending', expiresAt: new Date(Date.now() + 6 * 864e5).toISOString(), invitedById: 'usr_owner', createdAt: ago(1),
  })

  // ---- leads for org A
  const stages = db.stages.filter((s) => s.organizationId === orgA.id)
  const sources = db.sources.filter((s) => s.organizationId === orgA.id)
  const agents = ['usr_sara', 'usr_omar', 'usr_mona']
  const stageWeights = ['new', 'new', 'new', 'contacted', 'contacted', 'contacted', 'qualified', 'qualified', 'proposal_sent', 'won', 'won', 'lost', 'lost']

  for (let i = 0; i < 72; i++) {
    const createdDaysAgo = Math.floor(r() * 45)
    const createdAt = ago(createdDaysAgo, Math.floor(r() * 10))
    const stageKey = pick(stageWeights)
    const stage = stages.find((s) => s.key === stageKey)!
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const message = pick(MESSAGES)
    const ownerId = r() < 0.08 ? null : pick(agents)
    const contacted = stage.key !== 'new' || r() < 0.2
    const lead: Row = {
      id: `lead_${(1000 + i).toString(36)}`, organizationId: orgA.id, name,
      email: r() < 0.8 ? `${name.toLowerCase().replace(/\s+/g, '.')}${i}@example.com` : null,
      phone: `+2010${Math.floor(10000000 + r() * 89999999)}`, company: r() < 0.2 ? 'Private investor' : null,
      sourceId: pick(sources).id, campaign: pick(CAMPAIGNS), stageId: stage.id, ownerId,
      priority: pick(['low', 'medium', 'medium', 'high', 'urgent']), tags: r() < 0.4 ? [pick(['investor', 'family', 'vip', 'cash'])] : [],
      message, customFields: { budget: Math.round(3 + r() * 12) * 1e6, area: pick(AREAS) },
      // contact time derives from creation; next follow-up is set from the seeded task below
      firstContactedAt: contacted ? new Date(new Date(createdAt).getTime() + Math.floor(5 + r() * 240) * 6e4).toISOString() : null,
      lastContactedAt: null,
      nextFollowUpAt: null,
      doNotContact: false, lostReason: stage.type === 'lost' ? pick(['price', 'competitor', 'no_response', 'timing']) : null,
      wonAt: stage.type === 'won' ? ago(Math.max(0, createdDaysAgo - 5)) : null,
      lostAt: stage.type === 'lost' ? ago(Math.max(0, createdDaysAgo - 3)) : null,
      ai: null, createdAt, updatedAt: createdAt, deletedAt: null,
    }
    lead.lastContactedAt = lead.firstContactedAt
    lead.updatedAt = lead.firstContactedAt ?? createdAt
    db.leads.push(lead)
    db.activities.push({ id: uid('act'), organizationId: orgA.id, leadId: lead.id, type: 'created', actorId: null, payload: { source: sources.find((s) => s.id === lead.sourceId)?.name }, createdAt })
    if (contacted) {
      db.activities.push({ id: uid('act'), organizationId: orgA.id, leadId: lead.id, type: 'call', actorId: ownerId, payload: { outcome: 'reached', note: 'Discussed requirements and budget.' }, createdAt: lead.firstContactedAt })
    }
    const order = ['new', 'contacted', 'qualified', 'proposal_sent']
    const reached = stage.type === 'open' ? order.indexOf(stage.key) : 3
    for (let s = 1; s <= reached; s++) {
      db.stageHistory.push({ id: uid('sh'), organizationId: orgA.id, leadId: lead.id, fromStageId: stages.find((x) => x.key === order[s - 1])!.id, toStageId: stages.find((x) => x.key === order[s])!.id, actorId: ownerId, at: ago(Math.max(0, createdDaysAgo - s)) })
    }
    if (stage.type !== 'open') {
      db.stageHistory.push({ id: uid('sh'), organizationId: orgA.id, leadId: lead.id, fromStageId: stages.find((x) => x.key === 'proposal_sent')!.id, toStageId: stage.id, actorId: ownerId, at: lead.wonAt ?? lead.lostAt })
    }
    if (stage.type === 'open' && ownerId && r() < 0.7) {
      const due = new Date(Date.now() + Math.floor(-3 + r() * 7) * 864e5 + Math.floor(r() * 8) * 36e5)
      db.tasks.push({
        id: uid('tsk'), organizationId: orgA.id, leadId: lead.id, assigneeId: ownerId,
        title: pick(['Call to qualify budget', 'Send brochure and price list', 'Confirm viewing appointment', 'Follow up on proposal']),
        type: pick(['call', 'email', 'meeting', 'follow_up', 'send_proposal']), status: 'open', priority: lead.priority,
        dueAt: due.toISOString(), outcome: null, notes: null, automated: r() < 0.3, completedAt: null, createdAt,
      })
      lead.nextFollowUpAt = due.toISOString()
    }
  }

  // a few runs so the execution log isn't empty
  const ingestion = db.automations.find((a) => a.organizationId === orgA.id && a.type === 'lead_ingestion')!
  db.leads.slice(0, 8).forEach((l, i) => {
    db.runs.push({
      id: uid('run'), organizationId: orgA.id, ruleId: ingestion.id, status: i === 3 ? 'failed' : 'succeeded', trigger: 'webhook.website_form',
      leadId: l.id, eventId: `evt_seed_${i}`, attempt: 1,
      steps: [
        { name: 'validate_normalize', status: 'succeeded', durationMs: 12 },
        { name: 'deduplicate', status: 'succeeded', durationMs: 31 },
        { name: 'create_or_update_lead', status: 'succeeded', durationMs: 44 },
        { name: 'assign_owner', status: 'succeeded', durationMs: 18 },
        { name: 'notify', status: i === 3 ? 'failed' : 'succeeded', message: i === 3 ? 'Email provider timeout' : undefined, durationMs: 900 },
      ],
      error: i === 3 ? 'Email provider timeout after 3 attempts' : null, startedAt: l.createdAt, finishedAt: l.createdAt,
    })
  })

  const web = db.integrations.find((i) => i.organizationId === orgA.id && i.provider === 'website_form')!
  Object.assign(web, { status: 'connected', secret: 'whsec_demo_nile_0f3a9c', config: { endpoint: `webhooks/leads/${orgA.webhookKey}`, secretPreview: 'whsec_…9c', allowedOrigins: ['https://nileproperties.example'] }, lastSyncAt: ago(0, 2), eventsLast7d: 23 })
  const mail = db.integrations.find((i) => i.organizationId === orgA.id && i.provider === 'email')!
  Object.assign(mail, { status: 'connected', config: { fromAddress: 'no-reply@nileproperties.example', provider: 'smtp' }, lastSyncAt: ago(0, 5) })

  db.notifications.push(
    { id: uid('ntf'), organizationId: orgA.id, userId: 'usr_owner', type: 'integration_failed', title: 'Email delivery failed', body: 'A lead notification could not be sent. It will be retried.', link: { name: 'automationRuns' }, readAt: null, createdAt: ago(0, 3) },
    { id: uid('ntf'), organizationId: orgA.id, userId: 'usr_sara', type: 'lead_assigned', title: 'New lead assigned to you', body: `${db.leads[0].name} was assigned to you.`, link: { name: 'leadDetails', params: { id: db.leads[0].id } }, readAt: null, createdAt: ago(0, 1) },
  )

  db.auditLogs.push({ id: uid('aud'), organizationId: orgA.id, actorId: 'usr_owner', action: 'member.invited', entityType: 'invitation', entityId: db.invitations[0].id, metadata: { email: 'new.agent@nileproperties.test', role: 'sales_agent' }, ip: '127.0.0.1', createdAt: ago(1) })

  // clinic org gets a couple of leads to prove tenant isolation
  const clinicStage = db.stages.find((s) => s.organizationId === orgB.id && s.key === 'new')!
  ;['Fatma Adel', 'John Carter'].forEach((name, i) =>
    db.leads.push({
      id: `lead_clinic_${i}`, organizationId: orgB.id, name, email: null, phone: `+97150000000${i}`, company: null,
      sourceId: db.sources.find((s) => s.organizationId === orgB.id)!.id, campaign: null, stageId: clinicStage.id, ownerId: 'usr_clinic',
      priority: 'medium', tags: [], message: 'I would like to book a teeth cleaning appointment.', customFields: {},
      lastContactedAt: null, firstContactedAt: null, nextFollowUpAt: null, doNotContact: false, lostReason: null,
      wonAt: null, lostAt: null, ai: null, createdAt: ago(2), updatedAt: ago(2), deletedAt: null,
    })
  )

  return db
}

let cache: MockDb | null = null

export function getDb(): MockDb {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === 2) return (cache = parsed)
    }
  } catch {
    // corrupted or blocked storage → reseed
  }
  cache = seed()
  persist()
  return cache
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // storage full/blocked: keep working in memory
  }
}

export function resetDb() {
  cache = seed()
  persist()
}

export function permissionsFor(role: string) {
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? []
}
