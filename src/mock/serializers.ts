// Row → API shape. Joins are always scoped to the row's own organization.
import type { MockDb, Row } from './db'
import { HttpError, type Ctx, userRef } from './rules'

export function paginate<T>(items: T[], query: Record<string, string>) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const total = items.length
  return {
    data: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  }
}

export function sortBy<T extends Row>(items: T[], field: string | undefined, order: string | undefined, fallback = 'createdAt') {
  const key = field || fallback
  const dir = order === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    return av > bv ? dir : av < bv ? -dir : 0
  })
}

export function serializeLead(db: MockDb, l: Row) {
  const stage = db.stages.find((s) => s.id === l.stageId && s.organizationId === l.organizationId)
  const source = db.sources.find((s) => s.id === l.sourceId && s.organizationId === l.organizationId)
  return {
    id: l.id, name: l.name, email: l.email, phone: l.phone, company: l.company,
    source: source ? { id: source.id, name: source.name, type: source.type, active: source.active } : null,
    campaign: l.campaign,
    stage: stage ? { id: stage.id, name: stage.name, type: stage.type, color: stage.color } : null,
    owner: userRef(db, l.ownerId), priority: l.priority, tags: l.tags ?? [], message: l.message,
    customFields: l.customFields ?? {}, lastContactedAt: l.lastContactedAt, nextFollowUpAt: l.nextFollowUpAt,
    doNotContact: !!l.doNotContact, lostReason: l.lostReason, wonAt: l.wonAt, lostAt: l.lostAt,
    needsReview: !!l.needsReview || l.ai?.status === 'needs_review',
    ai: l.ai ? { ...l.ai, reviewedBy: userRef(db, l.ai.reviewedById ?? null) } : null,
    createdAt: l.createdAt, updatedAt: l.updatedAt,
  }
}

export function serializeTask(db: MockDb, t: Row) {
  const lead = t.leadId ? db.leads.find((l) => l.id === t.leadId && l.organizationId === t.organizationId) : null
  return {
    id: t.id, title: t.title, type: t.type, status: t.status, priority: t.priority, dueAt: t.dueAt,
    lead: lead ? { id: lead.id, name: lead.name } : null, assignee: userRef(db, t.assigneeId),
    outcome: t.outcome, notes: t.notes, automated: !!t.automated, completedAt: t.completedAt, createdAt: t.createdAt,
  }
}

export function serializeActivity(db: MockDb, a: Row) {
  return { id: a.id, leadId: a.leadId, type: a.type, actor: userRef(db, a.actorId), payload: a.payload ?? {}, createdAt: a.createdAt }
}

export function serializeRun(db: MockDb, r: Row) {
  const rule = db.automations.find((a) => a.id === r.ruleId)
  const lead = r.leadId ? db.leads.find((l) => l.id === r.leadId && l.organizationId === r.organizationId) : null
  return {
    id: r.id, rule: rule ? { id: rule.id, type: rule.type } : null, status: r.status, trigger: r.trigger,
    lead: lead ? { id: lead.id, name: lead.name } : null, eventId: r.eventId, attempt: r.attempt,
    steps: r.steps ?? [], error: r.error, startedAt: r.startedAt, finishedAt: r.finishedAt,
  }
}

export function serializeMember(db: MockDb, m: Row) {
  return {
    id: m.id, user: userRef(db, m.userId), role: m.role, status: m.status, specialties: m.specialties ?? [],
    lastActiveAt: m.lastActiveAt, joinedAt: m.joinedAt,
  }
}

export function serializeOrg(o: Row) {
  const { webhookKey, roundRobinCursor, ...rest } = o
  return rest
}

// Record-level authorization: tenant check first, then own-vs-all visibility
export function visibleLeads(ctx: Ctx) {
  const all = ctx.db.leads.filter((l) => l.organizationId === ctx.orgId && !l.deletedAt)
  if (ctx.can('leads.view_all')) return all
  if (ctx.can('leads.view_own')) return all.filter((l) => l.ownerId === ctx.userId)
  return []
}

export function findLead(ctx: Ctx, id: string) {
  // 404 (not 403) for other tenants' ids so ids can't be probed
  const lead = visibleLeads(ctx).find((l) => l.id === id)
  if (!lead) throw new HttpError(404, 'not_found', 'Lead not found.')
  return lead
}

export function csvEscape(v: any) {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('|') : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
