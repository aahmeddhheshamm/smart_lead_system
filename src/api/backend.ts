// Adapter for the LeadFlow backend (Django + DRF, `/api/v1`, JWT + X-Organization-ID).
// Contract: the backend's OpenAPI schema (`/api/schema/`) and the Postman collection
// "LeadFlow API — Smart Lead Management & Follow-up (v1)". Every function returns the
// frontend domain shapes from `src/types/domain.ts`, so pages don't depend on wire formats.
//
// Responses the OpenAPI documents are mapped exactly. Undocumented ones (auth/me, organizations,
// board, insights, integrations, dashboard, reports, billing) are mapped defensively and call
// `expectShape` so a mismatch shows up as a console warning in development.

import InterceptorHelper, { STORAGE, newId } from '@/InterceptorHelper'
import { P, ROLE_PERMISSIONS } from '@/config/permissions'
import type {
  AppNotification, AuditLog, AutomationRule, AutomationRun, CurrentUser, CustomFieldDefinition, DashboardSummary,
  DuplicateMatch, ImportJob, ImportPreviewRow, Integration, IntegrationProvider, Invitation, Lead, LeadActivity,
  LeadAiInsights, LeadSource, ListResponse, Member, MeResponse, NotificationPreferences, Organization, OrganizationRef,
  PipelineStage, Plan, ReportsResponse, RunStatus, Session, Subscription, Tag, Task,
} from '@/types/domain'
import { asArray, camel, expectShape, num, page, pick, slug, snake, truthy, unwrap } from './normalize'

const api = InterceptorHelper
const silent = { silent: true }

/* ============================== value maps ============================== */

const RULE_TYPE_IN: Record<string, string> = { uncontacted_alert: 'first_response_sla', stale_follow_up: 'stale_lead_follow_up' }
const RULE_TYPE_OUT: Record<string, string> = Object.fromEntries(Object.entries(RULE_TYPE_IN).map(([a, b]) => [b, a]))
const RUN_STATUS_IN: Record<string, RunStatus> = { success: 'succeeded', pending: 'queued', running: 'running', failed: 'failed', skipped: 'skipped' }
const RUN_STATUS_OUT: Record<string, string> = { succeeded: 'success', queued: 'pending', running: 'running', failed: 'failed', skipped: 'skipped' }
const PROVIDER_OUT: Partial<Record<IntegrationProvider, string>> = { email: 'email_api', ad_leads: 'meta_lead_ads' }
const PROVIDER_IN: Record<string, IntegrationProvider> = { email_api: 'email', meta_lead_ads: 'ad_leads' }
const IMPORT_FIELD_OUT: Record<string, string> = { name: 'full_name', message: 'notes' }
const IMPORT_FIELD_IN: Record<string, string> = { full_name: 'name', fullName: 'name', notes: 'message' }
const ORDERING: Record<string, string> = { name: 'full_name', createdAt: 'created_at', updatedAt: 'updated_at', priority: 'priority', nextFollowUpAt: 'next_follow_up_at', lastContactedAt: 'last_contacted_at', dueAt: 'due_at' }

// Lead list filter → backend query parameter. Only page/page_size/search/ordering are in the
// OpenAPI; the rest follow the Postman collection (status, priority, owner, overdue…).
// If a filter seems ignored by the API, adjust the name here.
export const LEAD_FILTER_PARAMS: Record<string, string> = {
  stageKey: 'status',
  priority: 'priority',
  ownerId: 'owner',
  sourceId: 'source',
  tag: 'tag',
  campaign: 'campaign',
  createdFrom: 'created_from',
  createdTo: 'created_to',
  uncontacted: 'uncontacted',
  needsReview: 'needs_review',
  overdue: 'overdue',
}

/* ============================== mappers ============================== */

const userRef = (u: any) => (u && (u.id || u.fullName || u.name) ? { id: u.id ?? '', name: u.fullName ?? u.name ?? u.email ?? '', email: u.email } : null)

const toStageRef = (s: any) => ({
  id: s?.id ?? '', key: s?.key, name: s?.name ?? s?.key ?? '—', type: (s?.kind ?? s?.type ?? 'open') as any, color: s?.color || '#64748B',
})

export function toLead(raw: any): Lead {
  const tags: Tag[] = asArray(raw.tags).map((t: any) => (typeof t === 'string' ? { id: t, name: t } : { id: t.id, name: t.name, color: t.color }))
  const source = raw.source && typeof raw.source === 'object' ? raw.source : raw.source ? { name: raw.source } : null
  return {
    id: raw.id,
    name: raw.fullName ?? raw.name ?? '',
    email: raw.email || null,
    phone: raw.phone || null,
    company: raw.company || null,
    source: source ? { id: source.id ?? '', key: source.key, name: source.name ?? source.key ?? '', type: source.type ?? 'other', active: true } : null,
    campaign: raw.campaign || null,
    stage: toStageRef(raw.stage ?? { key: raw.status, name: raw.status }),
    owner: userRef(raw.owner),
    priority: raw.priority ?? 'medium',
    tags: tags.map((t) => t.name),
    tagRefs: tags,
    message: raw.notes ?? raw.message ?? null,
    customFields: raw.customFields ?? {},
    lastContactedAt: raw.lastContactedAt ?? null,
    nextFollowUpAt: raw.nextFollowUpAt ?? null,
    doNotContact: !!raw.doNotContact,
    needsReview: !!raw.needsReview,
    marketingConsent: raw.marketingConsent,
    lostReason: raw.lostReason || null,
    wonAt: raw.stage?.kind === 'won' ? raw.closedAt ?? null : null,
    lostAt: raw.stage?.kind === 'lost' ? raw.closedAt ?? null : null,
    ai: null, // loaded separately from /leads/{id}/insights
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? raw.createdAt,
  }
}

export const toStage = (s: any): PipelineStage => ({
  id: s.id, key: s.key, name: s.name, type: s.kind ?? 'open', position: s.position ?? 0, color: s.color || '#64748B',
  autoTask: s.autoTask && s.autoTask.enabled !== undefined ? { enabled: !!s.autoTask.enabled, title: s.autoTask.title ?? '', type: s.autoTask.type ?? 'follow_up', dueInHours: s.autoTask.dueInHours ?? 24 } : null,
})

const toSource = (s: any): LeadSource & { leads: number } => ({
  id: s.id, key: s.key, name: s.name, type: s.type ?? 'other', active: s.isActive ?? true, leads: s.leadsCount ?? 0,
})

const toCustomField = (f: any): CustomFieldDefinition => ({
  id: f.id, key: f.key, label: f.label ?? f.key, fieldType: f.fieldType ?? 'text', options: asArray(f.options).map(String), isRequired: !!f.isRequired,
})

export const toTask = (t: any): Task => ({
  id: t.id,
  title: t.title,
  type: t.type ?? 'other',
  status: t.status === 'canceled' ? 'cancelled' : t.status,
  priority: t.priority || 'medium',
  dueAt: t.dueAt,
  lead: t.leadId ? { id: t.leadId, name: t.leadName ?? '' } : null,
  assignee: userRef(t.assignee),
  outcome: t.outcome || null,
  notes: t.outcomeNotes || t.description || null,
  automated: !!t.source && t.source !== 'manual',
  completedAt: t.completedAt ?? null,
  createdAt: t.createdAt,
})

const ACTIVITY_TYPE_IN: Record<string, string> = { assigned: 'owner_changed', assignment: 'owner_changed', stage_change: 'stage_changed', moved: 'stage_changed', consent_changed: 'do_not_contact', inbound_message: 'whatsapp' }

const stageName = (v: any) => (v && typeof v === 'object' ? v.name ?? v.key : v)

export function toActivity(a: any): LeadActivity {
  const data = a.data ?? a.payload ?? a.meta ?? a.changes ?? {}
  const type = ACTIVITY_TYPE_IN[a.type] ?? a.type
  return {
    id: a.id,
    leadId: a.leadId ?? a.lead ?? '',
    type,
    actor: a.actor && typeof a.actor === 'object' ? userRef(a.actor) : a.actorName ? { id: a.actor ?? '', name: a.actorName } : null,
    payload: {
      ...data,
      note: a.body || data.note || data.body || null,
      outcome: a.outcome || data.outcome || null,
      from: stageName(data.from ?? data.fromStage ?? data.from_stage) ?? data.from,
      to: stageName(data.to ?? data.toStage ?? data.to_stage ?? data.owner) ?? data.to,
      title: data.title ?? data.taskTitle,
      lostReason: data.lostReason ?? data.lost_reason,
      value: data.doNotContact ?? data.value,
    },
    createdAt: a.occurredAt ?? a.createdAt,
  }
}

export const toMember = (m: any): Member => ({
  id: m.id,
  user: userRef(m.user) ?? { id: '', name: '' },
  role: m.role?.key ?? m.role,
  roleId: m.role?.id,
  roleName: m.role?.name,
  status: m.isActive === false || m.deactivatedAt ? 'inactive' : 'active',
  isAvailable: m.isAvailable,
  title: m.title,
  specialties: asArray(m.specialties).map(String),
  lastActiveAt: m.lastAssignedAt ?? null,
  joinedAt: m.createdAt,
})

const toInvitation = (i: any): Invitation => ({
  id: i.id, email: i.email, role: i.role?.key ?? i.role, status: i.status, expiresAt: i.expiresAt,
  invitedBy: { id: '', name: i.invitedByName ?? '' }, createdAt: i.createdAt, inviteLink: i.inviteLink ?? null,
})

const toRule = (r: any): AutomationRule => ({
  id: r.id,
  type: (RULE_TYPE_IN[r.type] ?? r.type) as any,
  name: r.name,
  description: r.description || r.templateDescription,
  enabled: !!r.enabled,
  config: r.config ?? {},
  workflowId: r.workflowId ?? '',
  lastRunAt: r.lastRunAt ?? null,
  lastRunStatus: r.lastStatus ? RUN_STATUS_IN[r.lastStatus] ?? (r.lastStatus as RunStatus) : null,
  lastError: r.lastError || null,
  runCount: r.runCount ?? 0,
  failureCount: r.failureCount ?? 0,
  updatedAt: r.updatedAt,
})

export const toRun = (r: any): AutomationRun => ({
  id: r.id,
  rule: r.rule || r.ruleType ? { id: r.rule ?? '', type: (RULE_TYPE_IN[r.ruleType] ?? r.ruleType) as any, name: r.ruleName } : null,
  status: RUN_STATUS_IN[r.status] ?? r.status,
  trigger: r.trigger ?? '',
  lead: r.lead ? { id: r.lead, name: r.leadName ?? '' } : null,
  eventId: r.n8nExecutionId || r.id,
  attempt: r.attempts ?? 1,
  steps: asArray(r.output?.steps ?? r.steps).map((s: any) => ({ name: s.name, status: RUN_STATUS_IN[s.status] ?? s.status, message: s.message, durationMs: s.durationMs ?? 0 })),
  error: r.error || null,
  input: r.input ?? null,
  output: r.output ?? null,
  durationMs: r.durationMs ?? null,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt ?? null,
})

const toNotification = (n: any): AppNotification => ({
  id: n.id, type: n.type, title: n.title, body: n.body ?? '', link: n.link || null,
  readAt: n.readAt ?? (truthy(n.isRead) ? n.createdAt : null), createdAt: n.createdAt,
})

export function toOrganization(o: any): Organization {
  const bh = o.businessHours ?? {}
  return {
    id: o.id,
    name: o.name,
    industry: o.industry ?? 'other',
    timezone: o.timezone ?? 'UTC',
    locale: (o.language ?? o.locale ?? 'en') === 'ar' ? 'ar' : 'en',
    currency: o.currency ?? o.leadSettings?.currency ?? 'EGP',
    businessHours: { start: bh.start ?? '09:00', end: bh.end ?? '18:00', days: bh.days ?? [0, 1, 2, 3, 4] },
    // the API has no onboarding flag; registration routes to the wizard explicitly
    onboardingCompleted: o.onboardingCompleted ?? true,
    planId: o.plan?.code ?? o.planCode ?? o.planId ?? '',
    leadSettings: o.leadSettings
      ? {
        dedupMatchFields: o.leadSettings.dedupMatchFields ?? ['email', 'phone'],
        dedupAction: o.leadSettings.dedupAction ?? 'update',
        requiredFields: o.leadSettings.requiredFields ?? [],
        lostReasons: o.leadSettings.lostReasons ?? [],
        defaultCountry: o.leadSettings.defaultCountry ?? '',
      }
      : null,
    createdAt: o.createdAt,
  }
}

const toUser = (u: any): CurrentUser => ({
  id: u.id, name: u.fullName ?? u.name ?? u.email, email: u.email, phone: u.phone ?? null,
  locale: u.language === 'ar' ? 'ar' : 'en', emailVerified: u.emailVerified ?? true,
})

const ALL_PERMISSIONS = Object.values(P) as string[]
function normalizePermissions(raw: any): string[] {
  const list = asArray(raw, 'permissions').map((p: any) => (typeof p === 'string' ? p : p?.key ?? p?.code ?? p?.codename)).filter(Boolean)
  return list.includes('*') ? ALL_PERMISSIONS : list
}

/* ============================== session ============================== */

function storeTokens(res: any) {
  const data = unwrap(res) ?? {}
  const tokens = data.tokens ?? data
  if (tokens?.access) localStorage.setItem(STORAGE.token, tokens.access)
  if (tokens?.refresh) localStorage.setItem(STORAGE.refresh, tokens.refresh)
  const orgId = data.organization?.id ?? data.organizationId
  if (orgId) localStorage.setItem(STORAGE.org, orgId)
  return data
}

// Builds MeResponse from /auth/me + /organizations + /organizations/current.
// The active tenant is the last one used on this device, else the first membership.
export async function loadSession(): Promise<MeResponse> {
  const meRaw = unwrap(await api.get('auth/me', {}, silent))
  expectShape('GET auth/me', meRaw, 'user', 'email', 'memberships')
  const user = meRaw?.user ?? meRaw

  const orgsRaw = await api.get('organizations', {}, silent).catch(() => null)
  let items = asArray(unwrap(orgsRaw), 'organizations', 'memberships')
  if (!items.length) items = asArray(meRaw, 'memberships', 'organizations')
  const refs: Array<OrganizationRef & { _raw: any }> = items.map((it: any) => {
    const org = it.organization ?? it
    const role = it.role ?? org.role ?? it.membership?.role
    return { id: org.id, name: org.name, role: typeof role === 'string' ? role : role?.key ?? '', _raw: it }
  }).filter((r) => r.id)
  if (!refs.length) throw { error: { code: 'no_organization', message: 'This account is not a member of any organization.' } }

  const saved = localStorage.getItem(STORAGE.org)
  const chosen = refs.find((r) => r.id === saved) ?? refs[0]
  localStorage.setItem(STORAGE.org, chosen.id)

  const cur = unwrap(await api.get('organizations/current', {}, silent))
  expectShape('GET organizations/current', cur, 'id', 'organization')
  const orgRaw = cur?.organization ?? cur
  const membershipRaw = cur?.membership ?? cur?.myMembership ?? chosen._raw.membership ?? (chosen._raw.role ? chosen._raw : null)
  const roleObj = membershipRaw?.role ?? cur?.role ?? chosen._raw.role
  const roleKey = (typeof roleObj === 'string' ? roleObj : roleObj?.key) || chosen.role || 'sales_agent'

  let permissions = normalizePermissions(roleObj?.permissions ?? cur?.permissions ?? membershipRaw?.permissions ?? chosen._raw.permissions)
  if (!permissions.length) {
    // last resort: read my own membership from the members list (needs members.view)
    const mine = await api.get('members/', { search: user.email, page_size: 20 }, silent).catch(() => null)
    const m = asArray(mine).find((x: any) => x.user?.id === user.id)
    permissions = normalizePermissions(m?.role?.permissions)
  }
  if (!permissions.length) permissions = (ROLE_PERMISSIONS as any)[roleKey] ?? []

  return {
    user: toUser(user),
    organization: toOrganization(orgRaw),
    membership: { id: membershipRaw?.id ?? '', role: roleKey as any, permissions, status: 'active' },
    organizations: refs.map(({ _raw, ...r }) => r),
  }
}

export const auth = {
  async login(email: string, password: string) {
    storeTokens(await api.post('auth/login', { email, password }, silent))
    return loadSession()
  },
  async register(b: { name: string; email: string; password: string; organizationName: string; industry: string; timezone: string; locale: string; phone?: string }) {
    localStorage.removeItem(STORAGE.org)
    storeTokens(await api.post('auth/register', {
      fullName: b.name, email: b.email, password: b.password, organizationName: b.organizationName,
      industry: b.industry, timezone: b.timezone, language: b.locale, ...(b.phone ? { phone: b.phone } : {}),
    }))
    return loadSession()
  },
  async logout() {
    const refresh = localStorage.getItem(STORAGE.refresh)
    await api.post('auth/logout', refresh ? { refresh } : {}, silent)
  },
  forgotPassword: (email: string) => api.post('auth/password/reset', { email }),
  resetPassword: (uid: string, token: string, password: string) => api.post('auth/password/reset/confirm', { uid, token, newPassword: password }),
  async changePassword(currentPassword: string, password: string) {
    const res = await api.post('auth/password/change', { currentPassword, newPassword: password })
    storeTokens(res) // the API rotates tokens and revokes other sessions
    return res
  },
  verifyEmail: (token: string) => api.post('auth/email/verify', { token }, silent),
  resendVerification: () => api.post('auth/email/resend'),
  async sessions(): Promise<Session[]> {
    const rows = asArray(unwrap(await api.get('auth/sessions')), 'sessions')
    return rows.map((s: any) => ({
      id: s.id, userAgent: s.userAgent ?? s.user_agent ?? s.device ?? '—', ip: s.ip ?? s.ipAddress ?? '',
      current: !!(s.current ?? s.isCurrent), lastSeenAt: s.lastSeenAt ?? s.lastUsedAt ?? s.updatedAt ?? s.createdAt, createdAt: s.createdAt,
    }))
  },
  revokeSession: (id: string) => api.post(`auth/sessions/${id}/revoke`),
  revokeOtherSessions: () => api.post('auth/sessions/revoke-others'),
  async lookupInvitation(token: string) {
    const d = unwrap(await api.get('invitations/lookup', { token }, silent))
    expectShape('GET invitations/lookup', d, 'email', 'organization')
    return { email: d.email, role: d.role?.key ?? d.role ?? d.roleKey ?? '', organization: { id: d.organization?.id ?? d.organizationId ?? '', name: d.organization?.name ?? d.organizationName ?? '' }, expiresAt: d.expiresAt }
  },
  async acceptInvitation(token: string, b: { name?: string; password?: string }) {
    const data = storeTokens(await api.post('invitations/accept', { token, fullName: b.name, password: b.password }))
    const orgId = data.organization?.id ?? data.membership?.organization?.id
    if (orgId) localStorage.setItem(STORAGE.org, orgId)
    return loadSession()
  },
  switchOrganization(id: string) {
    localStorage.setItem(STORAGE.org, id)
    return loadSession()
  },
}

/* ============================== organization & team ============================== */

export const organization = {
  async current() {
    return toOrganization(unwrap(await api.get('organizations/current')))
  },
  async update(o: Partial<Organization>) {
    const body: Record<string, any> = {}
    if (o.name !== undefined) body.name = o.name
    if (o.industry !== undefined) body.industry = o.industry
    if (o.timezone !== undefined) body.timezone = o.timezone
    if (o.locale !== undefined) body.language = o.locale
    if (o.businessHours !== undefined) body.businessHours = o.businessHours
    if (o.leadSettings) body.leadSettings = o.leadSettings
    const res = unwrap(await api.patch('organizations/current', body))
    // some versions return only the changed fields: re-read to be safe
    return res?.id ? toOrganization(res) : organization.current()
  },
}

let rolesCache: Promise<any[]> | null = null
const rolesRaw = () => (rolesCache ??= api.get('roles/', {}, silent).then((r: any) => asArray(r)).catch(() => (rolesCache = null, [])))
const roleIdFor = async (key: string) => {
  const role = (await rolesRaw()).find((r: any) => r.key === key)
  if (!role) throw { error: { code: 'unknown_role', message: `Role "${key}" does not exist in this organization.` } }
  return role.id
}

export const team = {
  async members(query: Record<string, any> = {}): Promise<ListResponse<Member>> {
    const res = await api.get('members/', { page_size: query.pageSize ?? 100, page: query.page, search: query.search }, silent)
    const out = page(res, toMember, query)
    if (query.status === 'active') out.data = out.data.filter((m) => m.status === 'active')
    if (query.role) out.data = out.data.filter((m) => String(query.role).split(',').includes(m.role))
    return out
  },
  async updateMember(id: string, b: { role?: string; status?: string; specialties?: string[] }) {
    if (b.status) await api.post(`members/${id}/${b.status === 'inactive' ? 'deactivate' : 'activate'}/`, {})
    const patch: Record<string, any> = {}
    if (b.role) patch.roleId = await roleIdFor(b.role)
    if (b.specialties) patch.specialties = b.specialties
    const res = Object.keys(patch).length ? await api.patch(`members/${id}/`, patch) : await api.get(`members/${id}/`)
    return { data: toMember(unwrap(res)) }
  },
  async roles() {
    rolesCache = null
    const rows = await rolesRaw()
    return { data: rows.map((r: any) => ({ id: r.id, key: r.key, name: r.name, permissions: normalizePermissions(r.permissions), members: r.membersCount ?? 0, isSystem: !!r.isSystem })) }
  },
  async invitations() {
    return { data: asArray(await api.get('invitations/', { page_size: 100 })).map(toInvitation) }
  },
  async invite(email: string, role: string) {
    const res = unwrap(await api.post('invitations/', { email, roleId: await roleIdFor(role) }))
    const inv = toInvitation(res)
    const token = inv.inviteLink?.split('token=')[1]
    return { data: inv, debugInviteToken: token }
  },
  revokeInvitation: (id: string) => api.post(`invitations/${id}/revoke/`),
  resendInvitation: (id: string) => api.post(`invitations/${id}/resend/`),
}

/* ============================== lookups ============================== */

export const lookups = {
  async stages() {
    const rows = asArray(await api.get('pipeline/stages/', { page_size: 100 }))
    return { data: rows.filter((s: any) => !s.isArchived).map(toStage).sort((a, b) => a.position - b.position) }
  },
  async sources() {
    return { data: asArray(await api.get('lead-sources/', { page_size: 100 })).map(toSource) }
  },
  async tags(): Promise<{ data: string[]; refs: Tag[] }> {
    const refs = asArray(await api.get('tags/', { page_size: 200 }, silent)).map((t: any) => ({ id: t.id, name: t.name, color: t.color }))
    return { data: refs.map((t) => t.name).sort(), refs }
  },
  async customFields(): Promise<{ data: CustomFieldDefinition[] }> {
    const rows = asArray(await api.get('custom-fields/', { page_size: 100 }, silent))
    return { data: rows.filter((f: any) => f.isActive !== false).map(toCustomField) }
  },
  // Tag names → ids, creating the ones that don't exist yet
  async tagIds(names: string[] = []) {
    if (!names.length) return []
    const { refs } = await lookups.tags()
    const ids: string[] = []
    for (const name of names) {
      const found = refs.find((t) => t.name.toLowerCase() === name.toLowerCase())
      ids.push(found ? found.id : unwrap(await api.post('tags/', { name })).id)
    }
    return ids
  },
}

export const settings = {
  async createSource(b: { name: string; type: string }) {
    return { data: toSource(unwrap(await api.post('lead-sources/', { key: slug(b.name), name: b.name, type: b.type }))) }
  },
  async updateSource(id: string, b: { name?: string; type?: string; active?: boolean }) {
    const body: Record<string, any> = { ...(b.name ? { name: b.name } : {}), ...(b.type ? { type: b.type } : {}) }
    if (b.active !== undefined) body.isActive = b.active
    return { data: toSource(unwrap(await api.patch(`lead-sources/${id}/`, body))) }
  },
  deleteSource: (id: string) => api.delete(`lead-sources/${id}/`),

  // The UI edits the whole ordered list; the API has per-stage CRUD + reorder, so apply a diff.
  async saveStages(draft: Array<Partial<PipelineStage> & { id?: string | null }>) {
    const current = (await lookups.stages()).data
    const keep = new Set(draft.filter((s) => s.id).map((s) => s.id))
    for (const s of current) if (!keep.has(s.id)) await api.delete(`pipeline/stages/${s.id}/`)
    const ids: string[] = []
    for (const [position, s] of draft.entries()) {
      const body = {
        name: s.name, kind: s.type, color: s.color, position,
        autoTask: s.autoTask ? { enabled: s.autoTask.enabled, type: s.autoTask.type, title: s.autoTask.title, dueInHours: s.autoTask.dueInHours } : { enabled: false },
      }
      if (s.id) {
        const before = current.find((c) => c.id === s.id)
        if (JSON.stringify([before?.name, before?.type, before?.color, before?.autoTask]) !== JSON.stringify([s.name, s.type, s.color, s.autoTask ?? null])) {
          await api.patch(`pipeline/stages/${s.id}/`, body)
        }
        ids.push(s.id)
      } else {
        ids.push(unwrap(await api.post('pipeline/stages/', { key: slug(s.name ?? 'stage'), ...body })).id)
      }
    }
    await api.post('pipeline/stages/reorder/', { ids })
    return lookups.stages()
  },
}

/* ============================== leads ============================== */

function leadQuery(q: Record<string, any> = {}) {
  const out: Record<string, any> = {
    page: q.page, page_size: q.pageSize, search: q.search,
    ordering: q.sort ? `${q.order === 'asc' ? '' : '-'}${ORDERING[q.sort] ?? snake(q.sort)}` : q.ordering,
  }
  for (const [key, param] of Object.entries(LEAD_FILTER_PARAMS)) {
    const v = q[key]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    out[param] = v === true || v === 1 || v === '1' ? 'true' : Array.isArray(v) ? v.join(',') : v
  }
  return out
}

async function leadBody(b: Record<string, any>) {
  const body: Record<string, any> = {}
  const copy: Record<string, string> = { name: 'fullName', email: 'email', phone: 'phone', company: 'company', sourceId: 'sourceId', campaign: 'campaign', priority: 'priority', customFields: 'customFields', message: 'notes', nextFollowUpAt: 'nextFollowUpAt', stageId: 'stageId', ownerId: 'ownerId', marketingConsent: 'marketingConsent' }
  for (const [from, to] of Object.entries(copy)) if (from in b) body[to] = b[from] ?? (to === 'notes' || to === 'company' || to === 'campaign' ? '' : null)
  if ('tags' in b) body.tagIds = await lookups.tagIds(b.tags ?? [])
  if (b.force) body.force = true
  return body
}

export const leads = {
  async list(q: Record<string, any>): Promise<ListResponse<Lead>> {
    return page(await api.get('leads/', leadQuery(q)), toLead, q)
  },
  export: (q: Record<string, any>) => api.get('leads/export/', leadQuery(q)),
  async get(id: string) {
    return { data: toLead(unwrap(await api.get(`leads/${id}/`))) }
  },
  async create(b: Record<string, any>, idempotencyKey: string = newId()) {
    const created = unwrap(await api.post('leads/', await leadBody(b), { idempotencyKey, silent: true }))
    return { data: created?.id ? (await leads.get(created.id)).data : toLead(created), message: undefined }
  },
  // owner and stage have dedicated endpoints (rules, history, notifications); the rest is a PATCH
  async update(id: string, b: Record<string, any>) {
    const { ownerId, stageId, lostReason, ...rest } = b
    if (Object.keys(rest).length) await api.patch(`leads/${id}/`, await leadBody(rest))
    if ('ownerId' in b) await api.post(`leads/${id}/assign/`, { ownerId: ownerId || null, reason: 'manual' })
    if (stageId) await api.post(`leads/${id}/move-stage/`, { stageId, ...(lostReason ? { lostReason } : {}) })
    return leads.get(id)
  },
  remove: (id: string) => api.delete(`leads/${id}/`),
  restore: (id: string) => api.post(`leads/${id}/restore/`),
  async move(id: string, stageId: string, lostReason?: string | null) {
    return { data: toLead(unwrap(await api.post(`leads/${id}/move-stage/`, { stageId, ...(lostReason ? { lostReason } : {}) }))) }
  },
  async assign(id: string, ownerId: string | null) {
    return { data: toLead(unwrap(await api.post(`leads/${id}/assign/`, { ownerId, reason: 'manual' }))) }
  },
  async doNotContact(id: string, value: boolean, reason?: string) {
    return { data: toLead(unwrap(await api.post(`leads/${id}/consent/`, { doNotContact: value, ...(value ? { marketingConsent: false } : {}), source: 'agent', note: reason ?? '' }))) }
  },
  async checkDuplicates(b: { email?: string | null; phone?: string | null; excludeId?: string }): Promise<{ data: DuplicateMatch[] }> {
    const body: Record<string, string> = {}
    if (b.email) body.email = b.email
    if (b.phone) body.phone = b.phone
    if (!Object.keys(body).length) return { data: [] }
    const rows = asArray(unwrap(await api.post('leads/check-duplicates/', body, silent)), 'duplicates', 'matches', 'leads')
    const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '').slice(-9)
    return {
      data: rows.map((r: any) => r.lead ?? r).filter((r: any) => r.id !== b.excludeId).map((r: any) => {
        const l = toLead(r)
        const matchedOn: Array<'email' | 'phone'> = []
        if (b.email && l.email?.toLowerCase() === b.email.toLowerCase()) matchedOn.push('email')
        if (b.phone && digits(l.phone) && digits(l.phone) === digits(b.phone)) matchedOn.push('phone')
        return { lead: { id: l.id, name: l.name, email: l.email, phone: l.phone, stage: l.stage, owner: l.owner, createdAt: l.createdAt }, matchedOn: matchedOn.length ? matchedOn : ['phone'] }
      }),
    }
  },
  async bulk(b: { ids: string[]; action: string; ownerId?: string | null; stageId?: string; lostReason?: string; tags?: string[] }) {
    const action = b.action === 'stage' ? 'move_stage' : b.action
    const body: Record<string, any> = { ids: b.ids, action }
    if (action === 'assign') body.ownerId = b.ownerId ?? null
    if (action === 'move_stage') Object.assign(body, { stageId: b.stageId, ...(b.lostReason ? { lostReason: b.lostReason } : {}) })
    if (action === 'add_tags') body.tagIds = await lookups.tagIds(b.tags ?? [])
    const raw = unwrap(await api.post('leads/bulk/', body)) ?? {}
    const failed = asArray(raw, 'failed', 'errors').map((f: any) => ({ id: f.id ?? f.leadId ?? '', message: f.message ?? f.error ?? String(f) }))
    return { data: { updated: num(pick(raw, 'updated', 'affected', 'count', 'processed', 'succeeded'), b.ids.length - failed.length), failed } }
  },
  async activities(id: string): Promise<ListResponse<LeadActivity>> {
    const res = await api.get(`leads/${id}/activities/`)
    const out = page(res, toActivity)
    out.data = out.data.map((a) => ({ ...a, leadId: a.leadId || id })).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    return out
  },
  async logActivity(id: string, b: { type: string; note?: string; outcome?: string }) {
    const res = unwrap(await api.post(`leads/${id}/activities/`, { type: b.type, body: b.note ?? '', ...(b.outcome ? { outcome: b.outcome } : {}), direction: b.type === 'note' ? '' : 'outbound' }))
    return { data: toActivity(res?.activity ?? res ?? {}) }
  },
  async tasks(id: string) {
    return { data: asArray(await api.get(`leads/${id}/tasks`, { page_size: 100 })).map(toTask) }
  },
  async createTask(id: string, b: Record<string, any>, idempotencyKey: string = newId()) {
    return { data: toTask(unwrap(await api.post(`leads/${id}/tasks`, taskBody(b), { idempotencyKey }))) }
  },
  async runs(id: string) {
    return { data: asArray(await api.get(`leads/${id}/automation-runs/`, { page_size: 50 })).map(toRun) }
  },
}

/* ---------- AI insights (one insight per kind, reviewed by a person) ---------- */

const INSIGHT_KINDS = ['classification', 'summary', 'priority', 'reply', 'next_action']
const insightState = (s?: string) =>
  ['pending', 'requested', 'queued', 'processing', 'running'].includes(s ?? '') ? 'pending'
    : ['needs_review', 'review'].includes(s ?? '') ? 'needs_review'
      : ['accepted', 'applied', 'corrected', 'confirmed'].includes(s ?? '') ? 'confirmed'
        : s === 'rejected' ? 'rejected'
          : ['invalid', 'failed', 'error'].includes(s ?? '') ? 'invalid' : 'suggested'
const humanize = (v?: string) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '')

export const insights = {
  async forLead(leadId: string): Promise<LeadAiInsights | null> {
    const rows = asArray(unwrap(await api.get(`leads/${leadId}/insights`, {}, silent)), 'insights')
    expectShape('GET leads/{id}/insights[0]', rows[0] ?? { kind: 1 }, 'kind', 'result')
    const latest: Record<string, any> = {}
    for (const r of rows) {
      const kind = r.kind ?? r.type
      if (!latest[kind] || (r.createdAt ?? '') > (latest[kind].createdAt ?? '')) latest[kind] = r
    }
    const all = Object.values(latest).filter((r: any) => insightState(r.status) !== 'invalid')
    if (!all.length) return null
    const res = (k: string) => latest[k]?.result ?? latest[k]?.correctedData ?? latest[k]?.data ?? {}
    const cls = res('classification')
    const states = all.map((r: any) => insightState(r.status))
    const status = states.every((s) => s === 'pending') ? 'pending'
      : states.includes('needs_review') ? 'needs_review'
        : states.every((s) => s === 'rejected') ? 'rejected'
          : states.every((s) => s === 'confirmed' || s === 'rejected') ? 'confirmed' : 'suggested'
    const action = res('next_action')
    const confidences = all.map((r: any) => num(r.confidence, NaN)).filter((n) => !Number.isNaN(n))
    return {
      status: status as any,
      classification: humanize(cls.category ?? cls.classification) || '—',
      summary: res('summary').summary ?? res('summary').text ?? cls.intent ?? '',
      priority: res('priority').priority ?? cls.urgency ?? 'medium',
      priorityReason: res('priority').reason ?? '',
      suggestedReply: res('reply').reply ?? res('reply').text ?? res('reply').body ?? '',
      nextBestAction: [humanize(action.action), action.reason].filter(Boolean).join(' — '),
      confidence: confidences.length ? Math.min(...confidences) : 0,
      extracted: cls.extracted ?? {},
      model: [latest.classification?.provider, latest.classification?.model].filter(Boolean).join(' / ') || 'AI',
      generatedAt: all.map((r: any) => r.updatedAt ?? r.createdAt).sort().pop(),
      reviewedBy: null,
      insightIds: all.filter((r: any) => ['suggested', 'needs_review'].includes(insightState(r.status))).map((r: any) => r.id),
    }
  },
  request: (leadId: string) => api.post(`leads/${leadId}/insights/request`, { kinds: INSIGHT_KINDS }),
  async review(ai: LeadAiInsights, decision: 'confirmed' | 'rejected', apply = false) {
    for (const id of ai.insightIds ?? []) {
      // an insight the API can't apply (e.g. invalid) is skipped, the others still get reviewed
      await api.post(`insights/${id}/review`, { decision: decision === 'confirmed' ? 'accept' : 'reject', ...(decision === 'confirmed' ? { apply } : {}) }, silent).catch(() => null)
    }
  },
}

/* ---------- CSV import: the API parses the file, previews, then commits ---------- */

const toImportRow = (r: any): ImportPreviewRow => {
  const raw = r.data ?? r.values ?? r.raw ?? r.payload ?? {}
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [IMPORT_FIELD_IN[k] ?? k, v == null ? '' : String(v)]))
  const errs = r.errors ?? r.error ?? []
  const errors = Array.isArray(errs) ? errs.map((e: any) => (typeof e === 'string' ? e : e.message ?? JSON.stringify(e)))
    : typeof errs === 'object' ? Object.entries(errs).map(([k, v]) => `${k}: ${([] as any[]).concat(v).join(', ')}`) : [String(errs)]
  const s = r.status ?? (errors.length ? 'invalid' : 'valid')
  return {
    row: num(pick(r, 'rowNumber', 'row', 'line', 'index')),
    values,
    status: s === 'duplicate' ? 'duplicate' : ['invalid', 'error', 'failed'].includes(s) ? 'invalid' : 'valid',
    errors,
    duplicateOf: r.duplicateOf ? { id: r.duplicateOf?.id ?? r.duplicateOf, name: r.duplicateOf?.fullName ?? r.duplicateOfName ?? '' } : undefined,
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function pollImport(id: string, until: (s: string) => boolean) {
  let job = unwrap(await api.get(`leads/imports/${id}/`))
  for (let i = 0; i < 30 && !until(job.status); i++) {
    await wait(1000)
    job = unwrap(await api.get(`leads/imports/${id}/`))
  }
  return job
}

export const imports = {
  async preview(file: File, mapping: Record<string, string>, defaultSourceId?: string | null) {
    const form = new FormData()
    form.append('file', file)
    const columnMapping = Object.fromEntries(Object.entries(mapping).filter(([, f]) => f).map(([col, f]) => [col, IMPORT_FIELD_OUT[f] ?? f]))
    form.append('columnMapping', JSON.stringify(columnMapping))
    if (defaultSourceId) form.append('defaultSourceId', defaultSourceId)
    let job = unwrap(await api.post('leads/imports/', form))
    if (job.status === 'processing') job = await pollImport(job.id, (s) => s !== 'processing')
    const rows = asArray(await api.get(`leads/imports/${job.id}/rows/`, { page_size: 200 })).map(toImportRow)
    return {
      importId: job.id as string,
      data: {
        totals: { rows: num(job.totalRows), valid: num(job.validRows), duplicate: num(job.duplicateRows), invalid: num(job.errorRows) },
        rows,
      },
    }
  },
  async commit(id: string, policy: 'skip' | 'merge'): Promise<{ data: ImportJob }> {
    const form = new FormData()
    form.append('duplicateStrategy', policy === 'merge' ? 'update' : 'skip')
    let job = unwrap(await api.post(`leads/imports/${id}/commit/`, form))
    if (!['completed', 'completed_with_errors', 'failed', 'canceled'].includes(job.status)) {
      job = await pollImport(id, (s) => ['completed', 'completed_with_errors', 'failed', 'canceled'].includes(s))
    }
    const failedRows = job.errorRows || job.failedCount
      ? asArray(await api.get(`leads/imports/${id}/rows/`, { status: 'invalid', page_size: 200 }, silent).catch(() => [])).map(toImportRow)
      : []
    return {
      data: {
        id: job.id, status: job.status, fileName: job.originalFilename, totalRows: num(job.totalRows),
        created: num(job.createdCount), updated: num(job.updatedCount), skipped: num(job.skippedCount),
        failed: failedRows.map((r) => ({ row: r.row, message: r.errors.join('; ') })),
        createdAt: job.createdAt,
      },
    }
  },
  cancel: (id: string) => api.post(`leads/imports/${id}/cancel/`),
}

/* ============================== pipeline board ============================== */

export async function board(q: Record<string, any>) {
  const raw = unwrap(await api.get('pipeline/board', { per_stage: 50, owner: q.ownerId, search: q.search, priority: q.priority, source: q.sourceId }))
  const cols = asArray(raw, 'stages', 'columns')
  expectShape('GET pipeline/board[0]', cols[0] ?? { leads: 1 }, 'leads', 'items', 'stage')
  return {
    data: {
      stages: cols.map((c: any) => {
        const stage = c.stage ?? c
        const rows = asArray(c, 'leads', 'items')
        return { ...toStage(stage), total: num(pick(c, 'total', 'count', 'leadsCount'), rows.length), leads: rows.map(toLead) }
      }),
    },
  }
}

/* ============================== tasks ============================== */

function taskBody(b: Record<string, any>) {
  const body: Record<string, any> = {}
  for (const key of ['title', 'type', 'priority', 'dueAt', 'leadId', 'assigneeId']) if (key in b) body[key] = b[key]
  if ('notes' in b) body.description = b.notes ?? ''
  return body
}

export const tasks = {
  async list(q: Record<string, any>) {
    const query: Record<string, any> = { page: q.page, page_size: q.pageSize, assignee: q.assigneeId || undefined, ordering: q.view === 'completed' ? '-completed_at' : 'due_at' }
    if (q.view === 'range') Object.assign(query, { page_size: 200, due_from: q.from, due_to: q.to })
    else query.view = q.view
    if (q.view === 'completed') query.status = 'completed'
    const [res, summary] = await Promise.all([api.get('tasks/', query), api.get('tasks/summary/', { assignee: q.assigneeId || undefined }, silent).catch(() => null)])
    const out = page(res, toTask, q)
    // the range filter may be ignored by the API: always trim to the requested window
    if (q.view === 'range') out.data = out.data.filter((t) => (!q.from || t.dueAt >= q.from) && (!q.to || t.dueAt <= q.to))
    const s = unwrap(summary) ?? {}
    expectShape('GET tasks/summary', s, 'today', 'overdue', 'upcoming', 'dueToday')
    return { ...out, counts: { today: num(pick(s, 'today', 'dueToday', 'due_today')), overdue: num(pick(s, 'overdue')), upcoming: num(pick(s, 'upcoming')) } }
  },
  async create(b: Record<string, any>, idempotencyKey: string = newId()) {
    return { data: toTask(unwrap(await api.post('tasks/', taskBody(b), { idempotencyKey }))) }
  },
  async update(id: string, b: Record<string, any>) {
    return { data: toTask(unwrap(await api.patch(`tasks/${id}/`, taskBody(b)))) }
  },
  async complete(id: string, b: { outcome?: string | null; notes?: string | null; followUp?: { title: string; dueAt: string; type?: string } | null }) {
    const raw = unwrap(await api.post(`tasks/${id}/complete/`, {
      ...(b.outcome ? { outcome: b.outcome } : {}), notes: b.notes ?? '', logAsActivity: true,
      ...(b.followUp ? { followUp: { type: b.followUp.type ?? 'follow_up', title: b.followUp.title, dueAt: b.followUp.dueAt } } : {}),
    }))
    return { data: toTask(raw?.task ?? raw), followUp: raw?.nextTask ? toTask(raw.nextTask) : null }
  },
  async postpone(id: string, dueAt: string) {
    return { data: toTask(unwrap(await api.post(`tasks/${id}/snooze/`, { until: dueAt }))) }
  },
  async cancel(id: string, reason = '') {
    return { data: toTask(unwrap(await api.post(`tasks/${id}/cancel/`, { reason }))) }
  },
}

/* ============================== dashboard & reports ============================== */

const minutes = (o: any, ...keys: string[]) => {
  const m = pick(o, ...keys)
  if (m !== undefined) return num(m)
  const s = pick(o, ...keys.map((k) => k.replace(/Minutes$/, 'Seconds')))
  return s !== undefined ? Math.round(num(s) / 60) : null
}
const pct = (won: number, total: number) => (total ? Math.round((won / total) * 1000) / 10 : 0)
const rate = (v: any, won?: number, total?: number) => {
  if (total) return pct(won ?? 0, total)
  const n = num(v)
  return n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : n
}
const nameOf = (o: any) => o?.fullName ?? o?.name ?? o?.userName ?? o?.ownerName ?? '—'

export async function dashboardSummary(q: { from: string; to: string; ownerId?: string }): Promise<{ data: DashboardSummary }> {
  const raw = unwrap(await api.get('dashboard/summary', { from: q.from, to: q.to, owner: q.ownerId }))
  const k = raw?.kpis ?? raw?.metrics ?? raw?.counters ?? raw ?? {}
  expectShape('GET dashboard/summary', k, 'newLeads', 'leadsCreated', 'uncontacted', 'won')
  const conv = k.conversionRate ?? k.conversion
  return {
    data: {
      period: { from: q.from, to: q.to },
      kpis: {
        newLeads: num(pick(k, 'newLeads', 'leadsCreated', 'new_leads', 'totalLeads', 'leads')),
        notFollowedUp: num(pick(k, 'notFollowedUp', 'uncontacted', 'uncontactedLeads', 'notContacted')),
        tasksDue: num(pick(k, 'tasksDue', 'tasksDueToday', 'dueToday', 'tasksToday')),
        tasksOverdue: num(pick(k, 'tasksOverdue', 'overdueTasks', 'overdue', 'overdueFollowUps')),
        qualified: num(pick(k, 'qualified', 'qualifiedLeads')),
        won: num(pick(k, 'won', 'wonLeads', 'dealsWon')),
        lost: num(pick(k, 'lost', 'lostLeads', 'dealsLost')),
        conversionRate: rate(typeof conv === 'object' ? conv?.rate ?? conv?.value : conv),
        avgFirstResponseMinutes: minutes(k, 'avgFirstResponseMinutes', 'avgResponseMinutes', 'medianFirstResponseMinutes'),
      },
      conversionDefinition: (typeof conv === 'object' && conv?.definition) || raw?.conversionDefinition || '',
      bySource: asArray(raw, 'bySource', 'sources', 'leadsBySource').map((s: any) => ({ source: s.source ?? s.name ?? s.sourceName ?? s.key ?? '—', leads: num(pick(s, 'leads', 'count', 'total')), won: num(s.won) })),
      team: asArray(raw, 'team', 'teamPerformance', 'agents').map((t: any) => ({
        user: { id: t.user?.id ?? t.userId ?? t.id ?? '', name: nameOf(t.user ?? t) },
        assigned: num(pick(t, 'assigned', 'leads', 'leadsAssigned')), contacted: num(pick(t, 'contacted', 'leadsContacted')),
        won: num(t.won), overdueTasks: num(pick(t, 'overdueTasks', 'overdue')),
      })),
      needsAttention: asArray(raw, 'needsAttention', 'attention', 'alerts').map((a: any) => ({
        kind: (['uncontacted', 'overdue_task', 'needs_review'].includes(a.kind ?? a.type) ? a.kind ?? a.type : 'uncontacted') as any,
        lead: { id: a.lead?.id ?? a.leadId ?? '', name: a.lead?.fullName ?? a.leadName ?? '' }, detail: a.detail ?? a.reason ?? a.title ?? '', at: a.at ?? a.createdAt ?? a.dueAt,
      })).filter((a) => a.lead.id),
      recentActivity: asArray(raw, 'recentActivity', 'recentActivities', 'activity').map((a: any) => ({
        ...toActivity(a), lead: { id: a.lead?.id ?? a.leadId ?? '', name: a.lead?.fullName ?? a.leadName ?? '' },
      })).filter((a: any) => a.lead.id),
    },
  }
}

export async function reports(q: { from: string; to: string; ownerId?: string; sourceId?: string }): Promise<{ data: ReportsResponse }> {
  const params = { from: q.from, to: q.to, owner: q.ownerId, source: q.sourceId }
  const call = (path: string, extra: Record<string, any> = {}) => api.get(path, { ...params, ...extra }, silent).then(unwrap).catch(() => null)
  const [sources, team, conversion, response, pipeline, lost] = await Promise.all([
    call('reports/sources'), call('reports/team'), call('reports/conversion', { definition: 'cohort' }),
    call('reports/response-time'), call('reports/pipeline'), call('reports/lost-reasons'),
  ])
  expectShape('GET reports/pipeline', pipeline ?? {}, 'stages', 'funnel', 'data')
  const funnel = asArray(pipeline, 'stages', 'funnel').filter((s: any) => (s.kind ?? s.type) !== 'lost').map((s: any) => ({
    stage: s.name ?? s.stage?.name ?? s.key ?? '—', type: (s.kind ?? s.type ?? 'open') as any, count: num(pick(s, 'reached', 'count', 'leads', 'total')),
  }))
  const rt = response ?? {}
  const buckets = rt.buckets ?? rt.distribution ?? rt
  return {
    data: {
      period: { from: q.from, to: q.to },
      definitions: { conversionRate: conversion?.definition ?? '' },
      funnel,
      bySource: asArray(sources, 'sources', 'rows').map((s: any) => {
        const leadsN = num(pick(s, 'leads', 'count', 'total')), won = num(s.won)
        return { source: s.source ?? s.name ?? s.sourceName ?? s.key ?? '—', leads: leadsN, qualified: num(s.qualified), won, conversionRate: rate(s.conversionRate, won, leadsN) }
      }),
      byCampaign: asArray(sources, 'campaigns').map((c: any) => {
        const leadsN = num(pick(c, 'leads', 'count')), won = num(c.won)
        return { campaign: c.campaign ?? c.name ?? '—', leads: leadsN, won, conversionRate: rate(c.conversionRate, won, leadsN) }
      }),
      team: asArray(team, 'team', 'members', 'rows').map((t: any) => {
        const assigned = num(pick(t, 'assigned', 'leads', 'leadsAssigned')), won = num(t.won)
        return {
          user: { id: t.user?.id ?? t.userId ?? t.id ?? '', name: nameOf(t.user ?? t) }, assigned, won, lost: num(t.lost),
          conversionRate: rate(t.conversionRate, won, assigned), avgFirstResponseMinutes: minutes(t, 'avgFirstResponseMinutes', 'avgResponseMinutes'),
        }
      }),
      lostReasons: asArray(lost, 'reasons', 'lostReasons', 'rows').map((r: any) => ({ reason: r.reason ?? r.name ?? r.label ?? '—', count: num(pick(r, 'count', 'leads', 'total')) })),
      responseTime: {
        medianMinutes: minutes(rt, 'medianMinutes', 'medianFirstResponseMinutes', 'median'),
        within15m: num(pick(buckets, 'within15m', 'lt15m', 'under15m', 'under15')),
        within1h: num(pick(buckets, 'within1h', 'lt60m', 'under1h', '15to60m')),
        over1h: num(pick(buckets, 'over1h', 'gt60m', 'over60m')),
        never: num(pick(buckets, 'never', 'notContacted', 'uncontacted')),
      },
    },
  }
}

/* ============================== automations ============================== */

export const automations = {
  async list() {
    return { data: asArray(await api.get('automations/')).map(toRule) }
  },
  async update(id: string, b: { enabled?: boolean; config?: Record<string, any> }) {
    let raw: any = null
    if (b.config) raw = unwrap(await api.patch(`automations/${id}/`, { config: b.config }))
    if (b.enabled !== undefined) raw = unwrap(await api.post(`automations/${id}/${b.enabled ? 'enable' : 'disable'}/`))
    return { data: toRule(raw?.id ? raw : unwrap(await api.get(`automations/${id}/`))) }
  },
  runNow: (id: string) => api.post(`automations/${id}/run-now/`),
  resetConfig: (id: string) => api.post(`automations/${id}/reset-config/`),
  async runs(q: Record<string, any>) {
    return page(await api.get('automation-runs/', {
      page: q.page, page_size: q.pageSize, search: q.search, lead: q.leadId,
      status: q.status ? RUN_STATUS_OUT[q.status] ?? q.status : undefined,
      rule_type: q.type ? RULE_TYPE_OUT[q.type] ?? q.type : undefined,
    }), toRun, q)
  },
  async retry(id: string) {
    return { data: toRun(unwrap(await api.post(`automation-runs/${id}/retry/`, {}))) }
  },
}

/* ============================== integrations ============================== */

const CATALOG: Array<{ provider: IntegrationProvider; priority: Integration['priority']; available: boolean }> = [
  { provider: 'website_form', priority: 'core', available: true },
  { provider: 'email', priority: 'core', available: true },
  { provider: 'csv_import', priority: 'core', available: true },
  { provider: 'google_sheets', priority: 'later', available: true },
  { provider: 'external_crm', priority: 'later', available: true },
  { provider: 'ad_leads', priority: 'later', available: true },
  { provider: 'calendar', priority: 'later', available: false },
  { provider: 'whatsapp_business', priority: 'future', available: false },
]

// Public ingest URL for website developers (the browser may talk to the API through a dev proxy)
export const publicApiBase = () => {
  const base = import.meta.env.VITE_PUBLIC_API_URL || InterceptorHelper.baseUrl
  return new URL(base, window.location.origin).toString().replace(/\/?$/, '/')
}

function toIntegration(entry: (typeof CATALOG)[number], raw: any): Integration {
  const key = raw?.endpoints?.[0]?.publicKey ?? raw?.publicKey
  const status = raw?.status ?? (raw ? 'connected' : 'disconnected')
  return {
    id: raw?.id ?? entry.provider,
    provider: entry.provider,
    status: !entry.available ? 'coming_soon' : (['connected', 'error', 'expired'].includes(status) ? status : 'disconnected'),
    priority: entry.priority,
    displayName: raw?.displayName,
    config: { ...(raw?.config ?? {}), ...(raw?.config?.fromEmail ? { fromAddress: raw.config.fromEmail } : {}), ...(raw?.secretPreview ? { secretPreview: raw.secretPreview } : {}) },
    endpointUrl: key ? `${publicApiBase()}ingest/${key}` : null,
    lastSyncAt: raw?.lastSyncAt ?? raw?.lastSyncedAt ?? null,
    lastError: raw?.lastError || null,
    eventsLast7d: num(pick(raw, 'eventsLast7d', 'eventsCount', 'events')),
  }
}

export const integrations = {
  async list() {
    const raw = unwrap(await api.get('integrations'))
    const rows = asArray(raw, 'integrations', 'connected')
    expectShape('GET integrations[0]', rows[0] ?? { provider: 1 }, 'provider')
    const byProvider = new Map(rows.map((r: any) => [PROVIDER_IN[r.provider] ?? r.provider, r]))
    return { data: CATALOG.map((c) => toIntegration(c, byProvider.get(c.provider) ?? null)) }
  },
  async connect(provider: IntegrationProvider, b: Record<string, any>) {
    const wire = PROVIDER_OUT[provider] ?? provider
    const body = provider === 'website_form'
      ? { config: { requireSignature: true, allowedOrigins: b.allowedOrigins ?? [], defaultSourceKey: 'website' } }
      : provider === 'email'
        ? { config: { provider: b.provider || 'smtp', fromEmail: b.fromAddress }, ...(b.apiKey ? { credentials: { apiKey: b.apiKey } } : {}) }
        : { config: b.config ?? {} }
    const raw = unwrap(await api.post(`integrations/${wire}/connect`, body))
    return { data: toIntegration(CATALOG.find((c) => c.provider === provider)!, raw), secret: raw?.signingSecret as string | undefined }
  },
  async rotateSecret(provider: IntegrationProvider) {
    const raw = unwrap(await api.post(`integrations/${PROVIDER_OUT[provider] ?? provider}/rotate-secret`))
    return { secret: raw?.signingSecret as string | undefined }
  },
  disconnect: (provider: IntegrationProvider) => api.post(`integrations/${PROVIDER_OUT[provider] ?? provider}/disconnect`),
  async test(provider: IntegrationProvider) {
    const raw = unwrap(await api.post(`integrations/${PROVIDER_OUT[provider] ?? provider}/test`)) ?? {}
    return { data: { ok: raw.ok ?? raw.success ?? true, created: !!raw.leadId, lead: raw.leadId ? { id: raw.leadId, name: raw.leadName ?? 'Test lead' } : undefined, message: raw.message } }
  },
}

/* ============================== notifications ============================== */

export const notifications = {
  async list(q: Record<string, any>) {
    const [res, count] = await Promise.all([
      api.get('notifications/', { page: q.page, page_size: q.pageSize, is_read: q.unread ? 'false' : undefined, unread: q.unread || undefined }, silent),
      api.get('notifications/unread-count/', {}, silent).catch(() => null),
    ])
    const out = page(res, toNotification, q)
    if (q.unread) out.data = out.data.filter((n) => !n.readAt)
    const c = unwrap(count)
    return { ...out, unread: typeof c === 'number' ? c : num(pick(c, 'count', 'unread', 'unreadCount')) }
  },
  read: (id: string) => api.post(`notifications/${id}/read/`),
  readAll: () => api.post('notifications/read-all/'),
  async preferences(): Promise<{ data: NotificationPreferences }> {
    const raw = unwrap(await api.get('notifications/preferences')) ?? {}
    const prefs = raw.preferences ?? raw
    return {
      data: Object.fromEntries(Object.entries(prefs).filter(([, v]) => v && typeof v === 'object').map(([k, v]: [string, any]) => [snake(k), { inApp: !!(v.inApp ?? v.in_app), email: !!v.email }])) as NotificationPreferences,
    }
  },
  async savePreferences(p: NotificationPreferences) {
    await api.put('notifications/preferences', Object.fromEntries(Object.entries(p).map(([k, v]) => [camel(k), v])))
    return notifications.preferences()
  },
}

/* ============================== billing & audit ============================== */

const toPlan = (p: any): Plan => ({ id: p.id ?? p.code, code: p.code, name: p.name, priceMonthly: num(p.priceMonthly), currency: p.currency ?? 'USD', limits: p.limits ?? {} })

export const billing = {
  async subscription(): Promise<{ data: Subscription }> {
    const [subRaw, usageRaw] = await Promise.all([api.get('billing/subscription').then(unwrap), api.get('billing/usage', {}, silent).then(unwrap).catch(() => null)])
    expectShape('GET billing/subscription', subRaw, 'plan', 'status')
    const plan = subRaw?.plan ?? {}
    const limits = plan.limits ?? usageRaw?.limits ?? {}
    const usageSrc = usageRaw?.usage ?? usageRaw ?? {}
    const usage = Array.isArray(usageSrc)
      ? usageSrc.map((u: any) => ({ key: snake(u.metric ?? u.key), used: num(u.used ?? u.value), limit: num(u.limit) }))
      : Object.entries(usageSrc).filter(([k]) => k !== 'limits' && k !== 'period').map(([k, v]: [string, any]) => ({
        key: snake(k), used: num(typeof v === 'object' ? v.used ?? v.value : v), limit: num(typeof v === 'object' ? v.limit : limits[k]),
      }))
    return {
      data: {
        plan: { id: plan.id ?? plan.code ?? '', code: plan.code, name: plan.name ?? plan.code ?? '—', priceMonthly: num(plan.priceMonthly), currency: plan.currency ?? 'USD' },
        status: subRaw?.status ?? 'active',
        currentPeriodEnd: subRaw?.currentPeriodEnd ?? subRaw?.periodEnd ?? subRaw?.trialEndsAt ?? '',
        usage,
      },
    }
  },
  async plans() {
    return { data: asArray(await api.get('billing/plans')).filter((p: any) => p.isActive !== false).map(toPlan) }
  },
  changePlan: (planCode: string) => api.post('billing/change-plan', { planCode }),
}

export async function auditLogs(q: Record<string, any>): Promise<ListResponse<AuditLog>> {
  return page(await api.get('audit-logs/', { page: q.page, page_size: q.pageSize, action: q.action, search: q.action }), (a: any) => ({
    id: a.id, actor: a.actorName ? { id: a.actor ?? '', name: a.actorName } : null, action: a.action,
    entityType: a.targetType ?? '', entityId: a.targetId ?? null, metadata: a.changes ?? {}, ip: a.ipAddress ?? null, createdAt: a.createdAt,
  }), q)
}
