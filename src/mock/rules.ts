// Business rules (PRD §12) and the n8n workflows A–E (PRD §4), implemented the way the
// real backend + n8n must behave. Every function receives the tenant id explicitly:
// nothing here may read or write a row from another organization.

import { type MockDb, type Row, uid, nowIso, permissionsFor } from './db'

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message)
  }
}

export interface Ctx {
  db: MockDb
  orgId: string
  userId: string
  role: string
  permissions: string[]
  can: (p: string) => boolean
}

export function makeCtx(db: MockDb, orgId: string, userId: string): Ctx {
  const membership = db.memberships.find((m) => m.organizationId === orgId && m.userId === userId)
  const permissions: string[] = membership ? permissionsFor(membership.role) : []
  return { db, orgId, userId, role: membership?.role, permissions, can: (p) => permissions.includes(p) }
}

export function require(ctx: Ctx, ...anyOf: string[]) {
  if (!anyOf.some((p) => ctx.can(p))) throw new HttpError(403, 'forbidden', 'You do not have permission to perform this action.')
}

/* ===================== normalization & dedupe ===================== */

export function normalizeEmail(email?: string | null) {
  const v = (email ?? '').trim().toLowerCase()
  return v || null
}

// E.164-ish: keep digits, turn local Egyptian 01x numbers into +201x, keep an explicit +
export function normalizePhone(phone?: string | null) {
  let v = (phone ?? '').replace(/[^\d+]/g, '')
  if (!v) return null
  if (v.startsWith('00')) v = `+${v.slice(2)}`
  if (/^01\d{9}$/.test(v)) v = `+2${v}`
  if (!v.startsWith('+') && v.length > 10) v = `+${v}`
  return v
}

export function validEmail(email: string | null) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function findDuplicates(ctx: Ctx, email: string | null, phone: string | null, excludeId?: string) {
  const rule = automation(ctx, 'lead_ingestion')
  const matchOn: string[] = rule?.config?.matchOn ?? ['email', 'phone']
  return ctx.db.leads
    .filter((l) => l.organizationId === ctx.orgId && !l.deletedAt && l.id !== excludeId)
    .map((l) => {
      const matchedOn: string[] = []
      if (matchOn.includes('email') && email && l.email === email) matchedOn.push('email')
      if (matchOn.includes('phone') && phone && l.phone === phone) matchedOn.push('phone')
      return { lead: l, matchedOn }
    })
    .filter((m) => m.matchedOn.length)
}

/* ===================== lookups ===================== */

export const stagesOf = (ctx: Ctx) =>
  ctx.db.stages.filter((s) => s.organizationId === ctx.orgId).sort((a, b) => a.position - b.position)

export const stageById = (ctx: Ctx, id: string) => ctx.db.stages.find((s) => s.id === id && s.organizationId === ctx.orgId)

export const automation = (ctx: Ctx, type: string) =>
  ctx.db.automations.find((a) => a.organizationId === ctx.orgId && a.type === type)

export const activeMember = (ctx: Ctx, userId: string) =>
  ctx.db.memberships.find((m) => m.organizationId === ctx.orgId && m.userId === userId && m.status === 'active')

export const userRef = (db: MockDb, id: string | null) => {
  if (!id) return null
  const u = db.users.find((x) => x.id === id)
  return u ? { id: u.id, name: u.name, email: u.email } : null
}

/* ===================== activity, audit, notifications ===================== */

export function logActivity(ctx: Ctx, leadId: string, type: string, payload: Row = {}, actorId: string | null = ctx.userId) {
  ctx.db.activities.push({ id: uid('act'), organizationId: ctx.orgId, leadId, type, actorId, payload, createdAt: nowIso() })
}

export function audit(ctx: Ctx, action: string, entityType: string, entityId: string | null, metadata: Row = {}) {
  ctx.db.auditLogs.push({ id: uid('aud'), organizationId: ctx.orgId, actorId: ctx.userId, action, entityType, entityId, metadata, ip: '127.0.0.1', createdAt: nowIso() })
}

// dedupeKey makes a notification idempotent: re-running a scheduled check never spams
export function notify(ctx: Ctx, userId: string, type: string, title: string, body: string, link: Row | null, dedupeKey?: string) {
  if (dedupeKey && ctx.db.notifications.some((n) => n.organizationId === ctx.orgId && n.dedupeKey === dedupeKey && n.userId === userId)) return
  const prefs = ctx.db.preferences.find((p) => p.organizationId === ctx.orgId && p.userId === userId)?.prefs
  if (prefs && prefs[type] && !prefs[type].inApp) return
  ctx.db.notifications.push({ id: uid('ntf'), organizationId: ctx.orgId, userId, type, title, body, link, readAt: null, createdAt: nowIso(), dedupeKey })
}

const managersOf = (ctx: Ctx) =>
  ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.status === 'active' && ['owner', 'admin', 'sales_manager'].includes(m.role))

/* ===================== automation runs ===================== */

export function startRun(ctx: Ctx, type: string, trigger: string, eventId: string, leadId: string | null) {
  const rule = automation(ctx, type)
  const run = {
    id: uid('run'), organizationId: ctx.orgId, ruleId: rule?.id, status: 'running', trigger, leadId, eventId,
    attempt: 1, steps: [] as Row[], error: null as string | null, startedAt: nowIso(), finishedAt: null as string | null,
  }
  ctx.db.runs.push(run)
  const step = (name: string, status = 'succeeded', message?: string) =>
    run.steps.push({ name, status, message, durationMs: Math.floor(5 + Math.random() * 60) })
  const finish = (status: 'succeeded' | 'failed' | 'skipped', error: string | null = null) => {
    run.status = status
    run.error = error
    run.finishedAt = nowIso()
  }
  return { run, step, finish }
}

// Idempotency: the same event id (webhook delivery, retry, import row) is processed once
export function alreadyProcessed(ctx: Ctx, key: string) {
  if (ctx.db.processedEvents.some((e) => e.organizationId === ctx.orgId && e.key === key)) return true
  ctx.db.processedEvents.push({ organizationId: ctx.orgId, key, createdAt: nowIso() })
  return false
}

/* ===================== Workflow B: assignment ===================== */

export function pickOwner(ctx: Ctx, lead: Row): { ownerId: string | null; reason: string } {
  const rule = automation(ctx, 'lead_assignment')
  if (!rule?.enabled) return { ownerId: null, reason: 'assignment_disabled' }
  const strategy = rule.config?.strategy ?? 'round_robin'
  if (strategy === 'manual') return { ownerId: null, reason: 'manual_assignment' }

  // only active agents who can actually see the leads they get
  const agents = ctx.db.memberships
    .filter((m) => m.organizationId === ctx.orgId && m.status === 'active' && m.role === 'sales_agent')
    .sort((a, b) => a.userId.localeCompare(b.userId))
  if (!agents.length) return { ownerId: null, reason: 'no_available_agent' }

  if (strategy === 'specialty') {
    const area = String(lead.customFields?.area ?? lead.ai?.extracted?.area ?? '').toLowerCase()
    const match = area && agents.find((a) => (a.specialties ?? []).some((s: string) => s.toLowerCase() === area))
    if (match) return { ownerId: match.userId, reason: `specialty:${area}` }
  }

  const org = ctx.db.organizations.find((o) => o.id === ctx.orgId)!
  const cursor = (org.roundRobinCursor ?? 0) % agents.length
  org.roundRobinCursor = cursor + 1
  return { ownerId: agents[cursor].userId, reason: strategy === 'specialty' ? 'round_robin_fallback' : 'round_robin' }
}

export function assignOwner(ctx: Ctx, lead: Row, ownerId: string | null, reason: string, actorId: string | null = ctx.userId) {
  if (ownerId && !activeMember(ctx, ownerId)) {
    throw new HttpError(422, 'invalid_owner', 'The owner must be an active member of this organization.', { ownerId: ['Inactive or unknown member'] })
  }
  if (lead.ownerId === ownerId) return
  const from = lead.ownerId
  lead.ownerId = ownerId
  lead.updatedAt = nowIso()
  logActivity(ctx, lead.id, 'owner_changed', { from: userRef(ctx.db, from)?.name ?? null, to: userRef(ctx.db, ownerId)?.name ?? null, reason }, actorId)
  if (ownerId && ownerId !== ctx.userId) {
    notify(ctx, ownerId, 'lead_assigned', 'New lead assigned to you', `${lead.name} was assigned to you.`, { name: 'leadDetails', params: { id: lead.id } })
  }
}

/* ===================== Workflow D: AI classification ===================== */

const AREA_PATTERNS: Array<[RegExp, string]> = [
  [/الشيخ زايد|sheikh zayed|zayed/i, 'Sheikh Zayed'],
  [/التجمع|new cairo|tagamo/i, 'New Cairo'],
  [/العاصمة|new capital/i, 'New Capital'],
  [/أكتوبر|اكتوبر|october/i, '6th of October'],
  [/الساحل|north coast|sahel/i, 'North Coast'],
  [/dubai marina|مارينا/i, 'Dubai Marina'],
]

// Stand-in for the LLM call: returns the same JSON schema the real prompt must return.
// Customer text is treated as data only — instructions inside it are never followed.
export function classifyMessage(text: string, industry: string) {
  const t = text || ''
  const signals: string[] = []
  const extracted: Record<string, any> = {}
  let classification = 'General Inquiry'

  if (/شقة|فيلا|دوبلكس|وحدة|ستوديو|apartment|villa|duplex|studio|unit|property/i.test(t)) {
    classification = 'Real Estate Inquiry'
    signals.push('property')
    const unit = t.match(/شقة|فيلا|دوبلكس|ستوديو|apartment|villa|duplex|studio/i)?.[0]
    if (unit) extracted.unitType = unit
  } else if (/كشف|أسنان|اسنان|تنظيف|appointment|teeth|dental|cleaning|booking|حجز/i.test(t)) {
    classification = 'Clinic Booking'
    signals.push('booking')
  } else if (/عرض سعر|سعر|quote|price|pricing|payment plan/i.test(t)) {
    classification = 'Quote Request'
    signals.push('pricing')
  }

  for (const [re, area] of AREA_PATTERNS) if (re.test(t)) { extracted.area = area; signals.push('area'); break }

  const budget = t.match(/(\d+(?:[.,]\d+)?)\s*(مليون|million|m\b)/i)
  if (budget) {
    extracted.budget = Math.round(parseFloat(budget[1].replace(',', '.')) * 1e6)
    extracted.currency = /aed|درهم/i.test(t) ? 'AED' : 'EGP'
    signals.push('budget')
  }

  const urgent = /قريب|فوري|مستعجل|urgent|asap|immediately|ready to move|soon/i.test(t)
  const notUrgent = /مش مستعجل|not urgent|no rush/i.test(t)
  const injection = /ignore (all |previous )?instructions|system prompt|reveal|api key/i.test(t)

  const priority = urgent && !notUrgent ? 'high' : extracted.budget && extracted.budget >= 10e6 ? 'high' : signals.length >= 2 ? 'medium' : 'low'
  let confidence = Math.min(0.95, 0.35 + signals.length * 0.15 + (t.length > 25 ? 0.05 : 0))
  if (injection) confidence = Math.min(confidence, 0.3)

  const area = extracted.area ? ` in ${extracted.area}` : ''
  const budgetText = extracted.budget ? ` with a budget around ${(extracted.budget / 1e6).toLocaleString()}M ${extracted.currency}` : ''
  const next = classification === 'Real Estate Inquiry'
    ? 'Call to confirm requirements and book a viewing.'
    : classification === 'Clinic Booking' ? 'Call to confirm an appointment slot.'
      : classification === 'Quote Request' ? 'Send the price list / proposal.' : 'Call to understand the request.'

  return {
    classification,
    summary: injection
      ? 'The message contains instructions aimed at the system; they were ignored and the lead needs a human review.'
      : `${classification}${area}${budgetText}${urgent && !notUrgent ? ', customer wants a quick handover' : ''}.`,
    priority,
    priorityReason: urgent && !notUrgent ? 'Customer signalled urgency.' : extracted.budget ? 'Budget stated.' : 'Few qualifying details provided.',
    suggestedReply: industry === 'clinic'
      ? 'Thank you for contacting us! We would be happy to book your visit. What day and time suit you best?'
      : `Thank you for your interest${area}! I'd love to share the available options${budgetText ? ' within your budget' : ''}. When is a good time for a quick call?`,
    nextBestAction: next,
    confidence: Math.round(confidence * 100) / 100,
    extracted,
  }
}

export function runAiClassification(ctx: Ctx, lead: Row, trigger: string) {
  const rule = automation(ctx, 'ai_classification')
  if (!rule?.enabled || !lead.message) return
  const { step, finish } = startRun(ctx, 'ai_classification', trigger, `ai:${lead.id}:${lead.updatedAt}`, lead.id)
  step('minimize_payload', 'succeeded', 'Sent message text only (no contact details)')
  const org = ctx.db.organizations.find((o) => o.id === ctx.orgId)!
  const result = classifyMessage(lead.message, org.industry)
  step('call_model')
  step('validate_schema')
  const minConfidence = rule.config?.minConfidence ?? 0.6
  lead.ai = {
    ...result,
    status: result.confidence < minConfidence ? 'needs_review' : 'suggested',
    model: 'mock-classifier-v1',
    generatedAt: nowIso(),
    reviewedBy: null,
  }
  step('save_as_suggestion', 'succeeded', lead.ai.status === 'needs_review' ? 'Low confidence → needs review' : undefined)
  logActivity(ctx, lead.id, 'ai_classified', { classification: result.classification, confidence: result.confidence, status: lead.ai.status }, null)
  finish('succeeded')
}

/* ===================== stage transitions & stop rules ===================== */

export function stopFollowUps(ctx: Ctx, lead: Row, reason: string) {
  const rule = automation(ctx, 'stop_on_close')
  if (!rule?.enabled) return
  const open = ctx.db.tasks.filter((t) => t.organizationId === ctx.orgId && t.leadId === lead.id && t.status === 'open' && t.automated)
  const { step, finish } = startRun(ctx, 'stop_on_close', reason, `stop:${lead.id}:${reason}:${Date.now()}`, lead.id)
  open.forEach((t) => {
    t.status = 'cancelled'
    t.outcome = `Cancelled automatically: ${reason}`
  })
  lead.nextFollowUpAt = null
  step('cancel_scheduled_follow_ups', 'succeeded', `${open.length} task(s) cancelled`)
  finish(open.length ? 'succeeded' : 'skipped')
}

export function createTask(ctx: Ctx, data: Row, automated = false) {
  const task = {
    id: uid('tsk'), organizationId: ctx.orgId, leadId: data.leadId ?? null, assigneeId: data.assigneeId ?? null,
    title: data.title, type: data.type ?? 'follow_up', status: 'open', priority: data.priority ?? 'medium',
    dueAt: data.dueAt, outcome: null, notes: data.notes ?? null, automated, completedAt: null, createdAt: nowIso(),
  }
  if (task.assigneeId && !activeMember(ctx, task.assigneeId)) {
    throw new HttpError(422, 'invalid_assignee', 'The assignee must be an active member of this organization.', { assigneeId: ['Inactive or unknown member'] })
  }
  ctx.db.tasks.push(task)
  if (task.leadId) {
    logActivity(ctx, task.leadId, 'task_created', { title: task.title, dueAt: task.dueAt, automated }, automated ? null : ctx.userId)
    const lead = ctx.db.leads.find((l) => l.id === task.leadId)
    if (lead && (!lead.nextFollowUpAt || lead.nextFollowUpAt > task.dueAt)) lead.nextFollowUpAt = task.dueAt
  }
  return task
}

export function moveStage(ctx: Ctx, lead: Row, stageId: string, lostReason?: string | null) {
  const to = stageById(ctx, stageId)
  if (!to) throw new HttpError(422, 'invalid_stage', 'Unknown pipeline stage.', { stageId: ['Unknown stage'] })
  if (to.id === lead.stageId) return
  if (to.type === 'lost' && !lostReason) {
    throw new HttpError(422, 'lost_reason_required', 'A reason is required when marking a lead as lost.', { lostReason: ['Required'] })
  }
  const from = stageById(ctx, lead.stageId)
  lead.stageId = to.id
  lead.updatedAt = nowIso()
  lead.lostReason = to.type === 'lost' ? lostReason : null
  lead.wonAt = to.type === 'won' ? nowIso() : null
  lead.lostAt = to.type === 'lost' ? nowIso() : null
  ctx.db.stageHistory.push({ id: uid('sh'), organizationId: ctx.orgId, leadId: lead.id, fromStageId: from?.id, toStageId: to.id, actorId: ctx.userId, at: nowIso() })
  logActivity(ctx, lead.id, 'stage_changed', { from: from?.name, to: to.name, lostReason: lead.lostReason })

  if (to.type !== 'open') stopFollowUps(ctx, lead, `moved_to_${to.type}`)
  else if (to.autoTask?.enabled && lead.ownerId) {
    createTask(ctx, { leadId: lead.id, assigneeId: lead.ownerId, title: to.autoTask.title, type: to.autoTask.type, priority: lead.priority, dueAt: new Date(Date.now() + to.autoTask.dueInHours * 36e5).toISOString() }, true)
  }
}

export function markContacted(ctx: Ctx, lead: Row) {
  lead.lastContactedAt = nowIso()
  lead.firstContactedAt = lead.firstContactedAt ?? lead.lastContactedAt
  lead.updatedAt = nowIso()
}

/* ===================== Workflow A: ingestion ===================== */

export interface IngestInput {
  name?: string
  email?: string | null
  phone?: string | null
  company?: string | null
  sourceId?: string | null
  sourceName?: string | null
  campaign?: string | null
  priority?: string
  tags?: string[]
  message?: string | null
  customFields?: Row
  ownerId?: string | null
  stageId?: string | null
}

export function validateLeadInput(input: IngestInput) {
  const errors: Record<string, string[]> = {}
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  if (!input.name?.trim()) errors.name = ['Name is required']
  if (!email && !phone) errors.phone = ['Provide at least a phone number or an email']
  if (email && !validEmail(email)) errors.email = ['Invalid email address']
  if (phone && phone.replace(/\D/g, '').length < 8) errors.phone = ['Invalid phone number']
  if (input.name && input.name.length > 120) errors.name = ['Name is too long']
  if (input.message && input.message.length > 5000) errors.message = ['Message is too long']
  return { errors, email, phone }
}

export function ingestLead(ctx: Ctx, input: IngestInput, trigger: string, eventId: string): { lead: Row; created: boolean; duplicate: boolean } {
  const { run, step, finish } = startRun(ctx, 'lead_ingestion', trigger, eventId, null)
  const { errors, email, phone } = validateLeadInput(input)
  if (Object.keys(errors).length) {
    step('validate_normalize', 'failed', Object.values(errors).flat().join('; '))
    finish('failed', 'Validation failed')
    throw new HttpError(422, 'validation_failed', 'The lead data is incomplete or invalid.', errors)
  }
  step('validate_normalize')

  const source = input.sourceId
    ? ctx.db.sources.find((s) => s.id === input.sourceId && s.organizationId === ctx.orgId)
    : input.sourceName
      ? ctx.db.sources.find((s) => s.organizationId === ctx.orgId && s.name.toLowerCase() === input.sourceName!.toLowerCase())
      : null

  const ingestionRule = automation(ctx, 'lead_ingestion')
  const policy = ingestionRule?.config?.dedupePolicy ?? 'merge'
  const dup = findDuplicates(ctx, email, phone)[0]
  step('deduplicate', 'succeeded', dup ? `Matched ${dup.lead.id} on ${dup.matchedOn.join(', ')} → ${policy}` : 'No match')

  if (dup && policy === 'reject') {
    finish('skipped', null)
    throw new HttpError(409, 'duplicate_lead', 'A lead with the same contact details already exists.', [{ field: dup.matchedOn[0], message: `Duplicate of ${dup.lead.name}` }])
  }

  if (dup && policy === 'merge') {
    const lead = dup.lead
    // fill gaps only — never overwrite data a salesperson already curated
    lead.email = lead.email ?? email
    lead.phone = lead.phone ?? phone
    lead.company = lead.company ?? input.company ?? null
    lead.campaign = lead.campaign ?? input.campaign ?? null
    if (input.message) lead.message = lead.message ? `${lead.message}\n---\n${input.message}` : input.message
    lead.tags = Array.from(new Set([...(lead.tags ?? []), ...(input.tags ?? [])]))
    lead.updatedAt = nowIso()
    logActivity(ctx, lead.id, 'updated', { reason: 'duplicate_merged', trigger, message: input.message ?? null }, null)
    step('create_or_update_lead', 'succeeded', 'Merged into existing lead')
    run.leadId = lead.id
    finish('succeeded')
    return { lead, created: false, duplicate: true }
  }

  const stages = stagesOf(ctx)
  const lead: Row = {
    id: uid('lead'), organizationId: ctx.orgId, name: input.name!.trim(), email, phone, company: input.company ?? null,
    sourceId: source?.id ?? null, campaign: input.campaign ?? null, stageId: input.stageId && stageById(ctx, input.stageId) ? input.stageId : stages[0].id,
    ownerId: null, priority: input.priority ?? 'medium', tags: input.tags ?? [], message: input.message ?? null,
    customFields: input.customFields ?? {}, lastContactedAt: null, firstContactedAt: null, nextFollowUpAt: null,
    doNotContact: false, lostReason: null, wonAt: null, lostAt: null, ai: null, needsReview: !!dup,
    createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null,
  }
  ctx.db.leads.push(lead)
  run.leadId = lead.id
  logActivity(ctx, lead.id, 'created', { source: source?.name ?? null, trigger, possibleDuplicateOf: dup?.lead.id ?? null }, trigger.startsWith('manual') ? ctx.userId : null)
  step('create_or_update_lead', 'succeeded', dup ? 'Created and flagged as possible duplicate' : 'Created')

  // AI first so a specialty strategy can use the extracted area
  runAiClassification(ctx, lead, trigger)

  if (input.ownerId) {
    assignOwner(ctx, lead, input.ownerId, 'manual')
    step('assign_owner', 'succeeded', 'Owner chosen by user')
  } else {
    const { ownerId, reason } = pickOwner(ctx, lead)
    const assignRun = startRun(ctx, 'lead_assignment', trigger, `assign:${lead.id}`, lead.id)
    if (ownerId) {
      assignOwner(ctx, lead, ownerId, reason, null)
      assignRun.step('select_owner', 'succeeded', reason)
      assignRun.finish('succeeded')
      step('assign_owner', 'succeeded', reason)
    } else {
      // defined fallback: tell the managers instead of silently dropping the lead
      managersOf(ctx).forEach((m) => notify(ctx, m.userId, 'lead_assigned', 'Unassigned lead needs an owner', `${lead.name} could not be assigned automatically (${reason}).`, { name: 'leadDetails', params: { id: lead.id } }))
      assignRun.step('select_owner', 'skipped', reason)
      assignRun.finish('skipped')
      step('assign_owner', 'skipped', reason)
    }
  }

  if (lead.ownerId) {
    createTask(ctx, { leadId: lead.id, assigneeId: lead.ownerId, title: 'First contact with new lead', type: 'call', priority: lead.ai?.priority ?? lead.priority, dueAt: new Date(Date.now() + 15 * 6e4).toISOString() }, true)
  }
  step('notify')
  finish('succeeded')
  return { lead, created: true, duplicate: !!dup }
}

/* ===================== Workflow C: scheduled checks ===================== */

function withinBusinessHours(org: Row, date = new Date()) {
  const local = new Date(date.toLocaleString('en-US', { timeZone: org.timezone || 'UTC' }))
  const [sh, sm] = (org.businessHours?.start ?? '09:00').split(':').map(Number)
  const [eh, em] = (org.businessHours?.end ?? '18:00').split(':').map(Number)
  const minutes = local.getHours() * 60 + local.getMinutes()
  return (org.businessHours?.days ?? [0, 1, 2, 3, 4]).includes(local.getDay()) && minutes >= sh * 60 + sm && minutes <= eh * 60 + em
}

export function runScheduledChecks(db: MockDb) {
  const now = Date.now()
  if (now - (db.meta.lastTickAt ?? 0) < 20_000) return
  db.meta.lastTickAt = now

  for (const org of db.organizations) {
    const ownerMembership = db.memberships.find((m) => m.organizationId === org.id && m.role === 'owner')
    if (!ownerMembership) continue
    const ctx = makeCtx(db, org.id, ownerMembership.userId)
    const openStageIds = new Set(stagesOf(ctx).filter((s) => s.type === 'open').map((s) => s.id))
    const newStageId = stagesOf(ctx)[0]?.id
    const leads = db.leads.filter((l) => l.organizationId === org.id && !l.deletedAt && openStageIds.has(l.stageId))

    const sla = automation(ctx, 'first_response_sla')
    if (sla?.enabled && (!sla.config.businessHoursOnly || withinBusinessHours(org))) {
      const limit = (sla.config.minutes ?? 15) * 6e4
      const late = leads.filter((l) => l.stageId === newStageId && !l.lastContactedAt && !l.doNotContact && now - new Date(l.createdAt).getTime() > limit)
      const fresh = late.filter((l) => !alreadyProcessed(ctx, `sla:${l.id}`))
      if (fresh.length) {
        const { step, finish } = startRun(ctx, 'first_response_sla', 'schedule', `sla:${now}`, null)
        fresh.forEach((l) => {
          const recipients = l.ownerId ? [l.ownerId] : managersOf(ctx).map((m) => m.userId)
          recipients.forEach((u: string) => notify(ctx, u, 'follow_up_overdue', 'Lead waiting for first contact', `${l.name} has not been contacted within ${sla.config.minutes} minutes.`, { name: 'leadDetails', params: { id: l.id } }, `sla:${l.id}`))
        })
        step('alert_owners', 'succeeded', `${fresh.length} lead(s)`)
        finish('succeeded')
      }
    }

    const stale = automation(ctx, 'stale_lead_follow_up')
    if (stale?.enabled) {
      const limit = (stale.config.businessDays ?? 1) * 864e5
      const day = new Date().toISOString().slice(0, 10)
      // leads owned by a deactivated member are left for a manager to reassign (no task to an inactive user)
      const candidates = leads.filter((l) => l.ownerId && activeMember(ctx, l.ownerId) && !l.doNotContact && now - new Date(l.updatedAt).getTime() > limit &&
        !db.tasks.some((t) => t.leadId === l.id && t.status === 'open'))
      const fresh = candidates.filter((l) => !ctx.db.processedEvents.some((e) => e.organizationId === ctx.orgId && e.key === `stale:${l.id}:${day}`))
        .slice(0, 5)
        // mark only the leads handled in this batch; the rest are picked up on the next tick
        .filter((l) => !alreadyProcessed(ctx, `stale:${l.id}:${day}`))
      if (fresh.length) {
        const { step, finish } = startRun(ctx, 'stale_lead_follow_up', 'schedule', `stale:${now}`, null)
        fresh.forEach((l) => createTask(ctx, { leadId: l.id, assigneeId: l.ownerId, title: 'Follow up: no update for a business day', type: 'follow_up', priority: l.priority, dueAt: new Date(now + 2 * 36e5).toISOString() }, true))
        step('create_follow_up_tasks', 'succeeded', `${fresh.length} task(s)`)
        finish('succeeded')
      }
    }

    // reminders for tasks due within the next hour (once per task)
    db.tasks
      .filter((t) => t.organizationId === org.id && t.status === 'open' && t.assigneeId)
      .filter((t) => { const due = new Date(t.dueAt).getTime(); return due > now && due - now < 36e5 })
      .forEach((t) => notify(ctx, t.assigneeId, 'task_due', 'Task due soon', t.title, t.leadId ? { name: 'leadDetails', params: { id: t.leadId } } : { name: 'tasks' }, `due:${t.id}`))
  }
}
