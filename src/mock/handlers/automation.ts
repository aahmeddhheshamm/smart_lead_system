import { route, type Req } from '../server'
import { getDb, nowIso, uid } from '../db'
import { HttpError, audit, ingestLead, makeCtx, require, type Ctx } from '../rules'
import { paginate, serializeLead, serializeRun, sortBy } from '../serializers'
import { P } from '@/config/permissions'

// Config each template accepts; anything else is rejected (no free-form workflows in v1)
function validateConfig(type: string, config: any) {
  const errors: Record<string, string[]> = {}
  const c = config ?? {}
  if (type === 'lead_ingestion') {
    if (!['merge', 'flag', 'reject'].includes(c.dedupePolicy)) errors.dedupePolicy = ['Choose merge, flag or reject']
    if (!Array.isArray(c.matchOn) || !c.matchOn.length || c.matchOn.some((m: string) => !['email', 'phone'].includes(m))) errors.matchOn = ['Match on email and/or phone']
  }
  if (type === 'lead_assignment' && !['round_robin', 'specialty', 'manual'].includes(c.strategy)) errors.strategy = ['Invalid strategy']
  if (type === 'first_response_sla' && !(Number(c.minutes) >= 5 && Number(c.minutes) <= 1440)) errors.minutes = ['Between 5 and 1440 minutes']
  if (type === 'stale_lead_follow_up' && !(Number(c.businessDays) >= 1 && Number(c.businessDays) <= 30)) errors.businessDays = ['Between 1 and 30 days']
  if (type === 'ai_classification' && !(Number(c.minConfidence) >= 0.3 && Number(c.minConfidence) <= 0.95)) errors.minConfidence = ['Between 0.3 and 0.95']
  if (type === 'daily_report' && !(Number(c.hour) >= 0 && Number(c.hour) <= 23)) errors.hour = ['Between 0 and 23']
  if (Object.keys(errors).length) throw new HttpError(422, 'validation_failed', 'Invalid automation settings.', errors)
}

function serializeRule(ctx: Ctx, a: any) {
  const runs = ctx.db.runs.filter((r) => r.organizationId === ctx.orgId && r.ruleId === a.id)
  const last = runs.sort((x, y) => (x.startedAt > y.startedAt ? -1 : 1))[0]
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
  const recent = runs.filter((r) => r.startedAt >= weekAgo)
  return {
    id: a.id, type: a.type, enabled: a.enabled, config: a.config, workflowId: a.workflowId,
    lastRunAt: last?.startedAt ?? null, lastRunStatus: last?.status ?? null,
    runsLast7d: recent.length, failuresLast7d: recent.filter((r) => r.status === 'failed').length, updatedAt: a.updatedAt,
  }
}

function serializeIntegration(i: any) {
  const { organizationId, secret, ...rest } = i
  return rest
}

export function registerAutomation() {
  route('GET', 'automations', ({ ctx }: Req) => {
    require(ctx, P.automationsView)
    return { data: ctx.db.automations.filter((a) => a.organizationId === ctx.orgId).map((a) => serializeRule(ctx, a)) }
  })

  route('PATCH', 'automations/:id', ({ ctx, params, body }: Req) => {
    require(ctx, P.automationsManage)
    const rule = ctx.db.automations.find((a) => a.id === params.id && a.organizationId === ctx.orgId)
    if (!rule) throw new HttpError(404, 'not_found', 'Automation not found.')
    if ('config' in (body ?? {})) {
      const next = { ...rule.config, ...body.config }
      validateConfig(rule.type, next)
      rule.config = next
    }
    if ('enabled' in (body ?? {})) rule.enabled = !!body.enabled
    rule.updatedAt = nowIso()
    audit(ctx, 'automation.updated', 'automation_rule', rule.id, { type: rule.type, enabled: rule.enabled, config: rule.config })
    return { data: serializeRule(ctx, rule) }
  })

  route('GET', 'automation-runs', ({ ctx, query }: Req) => {
    require(ctx, P.automationsView)
    let rows = ctx.db.runs.filter((r) => r.organizationId === ctx.orgId)
    if (query.status) rows = rows.filter((r) => r.status === query.status)
    if (query.type) {
      const ids = new Set(ctx.db.automations.filter((a) => a.organizationId === ctx.orgId && a.type === query.type).map((a) => a.id))
      rows = rows.filter((r) => ids.has(r.ruleId))
    }
    if (query.leadId) rows = rows.filter((r) => r.leadId === query.leadId)
    if (query.search) rows = rows.filter((r) => r.eventId.includes(query.search) || r.id.includes(query.search))
    const page = paginate(sortBy(rows, 'startedAt', 'desc'), query)
    return { data: page.data.map((r) => serializeRun(ctx.db, r)), pagination: page.pagination }
  })

  route('GET', 'automation-runs/:id', ({ ctx, params }: Req) => {
    require(ctx, P.automationsView)
    const run = ctx.db.runs.find((r) => r.id === params.id && r.organizationId === ctx.orgId)
    if (!run) throw new HttpError(404, 'not_found', 'Run not found.')
    return { data: serializeRun(ctx.db, run) }
  })

  // Re-executes only the failed steps; succeeded side effects (lead created, task created) are not repeated
  route('POST', 'automation-runs/:id/retry', ({ ctx, params }: Req) => {
    require(ctx, P.automationsManage)
    const run = ctx.db.runs.find((r) => r.id === params.id && r.organizationId === ctx.orgId)
    if (!run) throw new HttpError(404, 'not_found', 'Run not found.')
    if (run.status !== 'failed') throw new HttpError(409, 'not_retryable', 'Only failed runs can be retried.')
    run.attempt += 1
    run.steps = run.steps.map((s: any) => (s.status === 'failed' ? { ...s, status: 'succeeded', message: `Retried (attempt ${run.attempt})` } : s))
    run.status = 'succeeded'
    run.error = null
    run.finishedAt = nowIso()
    audit(ctx, 'automation_run.retried', 'automation_run', run.id, { attempt: run.attempt })
    return { __status: 200, data: serializeRun(ctx.db, run) }
  })

  /* ---------- integrations ---------- */

  route('GET', 'integrations', ({ ctx }: Req) => {
    require(ctx, P.integrationsView)
    return { data: ctx.db.integrations.filter((i) => i.organizationId === ctx.orgId).map(serializeIntegration) }
  })

  route('POST', 'integrations/:provider/connect', ({ ctx, params, body }: Req) => {
    require(ctx, P.integrationsManage)
    const integ = ctx.db.integrations.find((i) => i.organizationId === ctx.orgId && i.provider === params.provider)
    if (!integ) throw new HttpError(404, 'not_found', 'Unknown integration.')
    if (integ.status === 'coming_soon') throw new HttpError(422, 'not_available', 'This integration is not available yet.')
    const org = ctx.db.organizations.find((o) => o.id === ctx.orgId)!
    let secret: string | undefined
    if (params.provider === 'website_form') {
      secret = `whsec_${uid('s').slice(2)}`
      integ.secret = secret
      integ.config = { endpoint: `webhooks/leads/${org.webhookKey}`, secretPreview: `whsec_…${secret.slice(-2)}`, allowedOrigins: body?.allowedOrigins ?? [] }
    } else if (params.provider === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body?.fromAddress ?? '')) throw new HttpError(422, 'validation_failed', 'Enter a valid sender address.', { fromAddress: ['Invalid email'] })
      integ.config = { fromAddress: body.fromAddress, provider: body.provider ?? 'smtp' }
    } else {
      integ.config = { ...(body ?? {}) }
    }
    integ.status = 'connected'
    integ.lastError = null
    integ.lastSyncAt = nowIso()
    audit(ctx, 'integration.connected', 'integration', integ.id, { provider: integ.provider })
    // the signing secret is returned exactly once; afterwards only a masked preview exists
    return { __status: 200, data: serializeIntegration(integ), secret }
  })

  route('POST', 'integrations/:provider/disconnect', ({ ctx, params }: Req) => {
    require(ctx, P.integrationsManage)
    const integ = ctx.db.integrations.find((i) => i.organizationId === ctx.orgId && i.provider === params.provider)
    if (!integ) throw new HttpError(404, 'not_found', 'Unknown integration.')
    integ.status = 'disconnected'
    integ.secret = null
    integ.config = {}
    audit(ctx, 'integration.disconnected', 'integration', integ.id, { provider: integ.provider })
    return { __status: 200, data: serializeIntegration(integ) }
  })

  // Sends a signed sample event through the same path a real webhook takes
  route('POST', 'integrations/:provider/test', ({ ctx, params, body }: Req) => {
    require(ctx, P.integrationsManage)
    const integ = ctx.db.integrations.find((i) => i.organizationId === ctx.orgId && i.provider === params.provider)
    if (!integ || integ.status !== 'connected') throw new HttpError(422, 'not_connected', 'Connect the integration first.')
    integ.lastSyncAt = nowIso()
    if (params.provider !== 'website_form') return { __status: 200, data: { ok: true, message: 'Connection OK' } }
    const sample = body?.sample ?? { name: 'Test Lead', phone: '+201000000000', email: `test.${Date.now()}@example.com`, message: 'محتاج شقة في الشيخ زايد في حدود 5 مليون واستلام قريب.' }
    const website = ctx.db.sources.find((s) => s.organizationId === ctx.orgId && s.type === 'website')
    const { lead, created } = ingestLead(ctx, { ...sample, sourceId: website?.id }, 'webhook.website_form', `test:${uid('evt')}`)
    integ.eventsLast7d += 1
    return { __status: 200, data: { ok: true, created, lead: serializeLead(ctx.db, lead) } }
  })

  /* ---------- public inbound webhook (what a website form / n8n Workflow A calls) ---------- */

  route('POST', 'webhooks/leads/:key', ({ params, body, headers }: Req) => {
    const db = getDb()
    const org = db.organizations.find((o) => o.webhookKey === params.key)
    const integ = org && db.integrations.find((i) => i.organizationId === org.id && i.provider === 'website_form')
    // same response for unknown key and bad signature: don't leak which part was wrong
    if (!org || !integ || integ.status !== 'connected' || headers['x-signature'] !== integ.secret) {
      throw new HttpError(401, 'invalid_signature', 'Webhook signature verification failed.')
    }
    const eventId = headers['x-event-id']
    if (!eventId) throw new HttpError(422, 'missing_event_id', 'X-Event-Id header is required.')
    const owner = db.memberships.find((m) => m.organizationId === org.id && m.role === 'owner')!
    const ctx = makeCtx(db, org.id, owner.userId)
    const key = `webhook:${eventId}`
    if (db.processedEvents.some((e) => e.organizationId === org.id && e.key === key)) {
      return { __status: 200, data: { duplicateEvent: true } }
    }
    db.processedEvents.push({ organizationId: org.id, key, createdAt: nowIso() })
    const website = db.sources.find((s) => s.organizationId === org.id && s.type === 'website')
    const { lead, created } = ingestLead(ctx, { ...body, sourceId: website?.id }, 'webhook.website_form', eventId)
    integ.eventsLast7d += 1
    integ.lastSyncAt = nowIso()
    return { __status: 202, data: { leadId: lead.id, created } }
  }, { public: true })
}
