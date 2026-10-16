import { route, RawResponse, type Req } from '../server'
import { nowIso, uid } from '../db'
import {
  HttpError, alreadyProcessed, assignOwner, audit, createTask, findDuplicates, ingestLead, logActivity, markContacted,
  moveStage, normalizeEmail, normalizePhone, require, runAiClassification, stagesOf, stopFollowUps, validEmail,
  validateLeadInput, type Ctx,
} from '../rules'
import { csvEscape, findLead, paginate, serializeActivity, serializeLead, serializeRun, serializeTask, sortBy, visibleLeads } from '../serializers'
import { P } from '@/config/permissions'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export function filterLeads(ctx: Ctx, q: Record<string, string>) {
  let rows = visibleLeads(ctx)
  const s = q.search?.trim().toLowerCase()
  if (s) {
    const digits = s.replace(/\D/g, '')
    rows = rows.filter((l) =>
      l.name.toLowerCase().includes(s) || (l.email ?? '').includes(s) || (l.company ?? '').toLowerCase().includes(s) ||
      (digits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(digits)))
  }
  if (q.stageId) rows = rows.filter((l) => q.stageId.split(',').includes(l.stageId))
  if (q.sourceId) rows = rows.filter((l) => q.sourceId.split(',').includes(l.sourceId))
  if (q.priority) rows = rows.filter((l) => q.priority.split(',').includes(l.priority))
  if (q.ownerId) rows = rows.filter((l) => (q.ownerId === 'unassigned' ? !l.ownerId : q.ownerId.split(',').includes(l.ownerId)))
  if (q.tag) rows = rows.filter((l) => (l.tags ?? []).includes(q.tag))
  if (q.campaign) rows = rows.filter((l) => l.campaign === q.campaign)
  if (q.createdFrom) rows = rows.filter((l) => l.createdAt >= q.createdFrom)
  if (q.createdTo) rows = rows.filter((l) => l.createdAt <= `${q.createdTo}T23:59:59.999Z`)
  if (q.needsReview === '1') rows = rows.filter((l) => l.needsReview || l.ai?.status === 'needs_review')
  if (q.uncontacted === '1') rows = rows.filter((l) => !l.lastContactedAt)
  return sortBy(rows, q.sort, q.order)
}

function applyUpdate(ctx: Ctx, lead: any, body: any) {
  const errors: Record<string, string[]> = {}
  const changes: Record<string, { from: any; to: any }> = {}
  const set = (key: string, value: any) => {
    if (JSON.stringify(lead[key]) !== JSON.stringify(value)) {
      changes[key] = { from: lead[key], to: value }
      lead[key] = value
    }
  }
  if ('name' in body) body.name?.trim() ? set('name', body.name.trim()) : (errors.name = ['Required'])
  if ('email' in body) {
    const email = normalizeEmail(body.email)
    validEmail(email) ? set('email', email) : (errors.email = ['Invalid email address'])
  }
  if ('phone' in body) set('phone', normalizePhone(body.phone))
  if (('email' in body || 'phone' in body) && !lead.email && !lead.phone) errors.phone = ['Provide at least a phone number or an email']
  if ('company' in body) set('company', body.company || null)
  if ('campaign' in body) set('campaign', body.campaign || null)
  if ('message' in body) set('message', body.message || null)
  if ('priority' in body) PRIORITIES.includes(body.priority) ? set('priority', body.priority) : (errors.priority = ['Invalid priority'])
  if ('tags' in body) set('tags', Array.from(new Set((body.tags ?? []).map((t: string) => t.trim().toLowerCase()).filter(Boolean))))
  if ('customFields' in body) set('customFields', { ...(lead.customFields ?? {}), ...(body.customFields ?? {}) })
  if ('sourceId' in body) {
    if (body.sourceId && !ctx.db.sources.some((s) => s.id === body.sourceId && s.organizationId === ctx.orgId)) errors.sourceId = ['Unknown source']
    else set('sourceId', body.sourceId || null)
  }
  if ('nextFollowUpAt' in body) set('nextFollowUpAt', body.nextFollowUpAt || null)
  if (Object.keys(errors).length) throw new HttpError(422, 'validation_failed', 'Please fix the highlighted fields.', errors)

  if ('ownerId' in body && body.ownerId !== lead.ownerId) {
    require(ctx, P.leadsAssign)
    assignOwner(ctx, lead, body.ownerId || null, 'manual')
  }
  if ('stageId' in body && body.stageId !== lead.stageId) moveStage(ctx, lead, body.stageId, body.lostReason)

  if (Object.keys(changes).length) {
    lead.updatedAt = nowIso()
    logActivity(ctx, lead.id, 'updated', { fields: Object.keys(changes) })
  }
}

export function registerLeads() {
  route('GET', 'leads', ({ ctx, query }: Req) => {
    require(ctx, P.leadsViewAll, P.leadsViewOwn)
    const page = paginate(filterLeads(ctx, query), query)
    return { data: page.data.map((l) => serializeLead(ctx.db, l)), pagination: page.pagination }
  })

  route('GET', 'leads/export', ({ ctx, query }: Req) => {
    require(ctx, P.leadsExport)
    const rows = filterLeads(ctx, query)
    const cols = ['id', 'name', 'email', 'phone', 'company', 'source', 'campaign', 'stage', 'owner', 'priority', 'tags', 'lastContactedAt', 'nextFollowUpAt', 'createdAt']
    const lines = rows.map((r) => {
      const l = serializeLead(ctx.db, r)
      return [l.id, l.name, l.email, l.phone, l.company, l.source?.name, l.campaign, l.stage?.name, l.owner?.name, l.priority, l.tags, l.lastContactedAt, l.nextFollowUpAt, l.createdAt].map(csvEscape).join(',')
    })
    audit(ctx, 'leads.exported', 'lead', null, { count: rows.length, filters: query })
    return new RawResponse([cols.join(','), ...lines].join('\n'), 'text/csv')
  })

  route('POST', 'leads', ({ ctx, body }: Req) => {
    require(ctx, P.leadsCreate)
    // agents can only create leads for themselves
    const ownerId = ctx.can(P.leadsAssign) ? body?.ownerId ?? null : ctx.userId
    const { lead, created } = ingestLead(ctx, { ...body, ownerId }, 'manual.create', `manual:${uid('evt')}`)
    return { __status: created ? 201 : 200, data: serializeLead(ctx.db, lead), message: created ? 'Lead created.' : 'Merged into an existing lead with the same contact details.' }
  })

  route('POST', 'leads/check-duplicates', ({ ctx, body }: Req) => {
    require(ctx, P.leadsCreate, P.leadsUpdate)
    const matches = findDuplicates(ctx, normalizeEmail(body?.email), normalizePhone(body?.phone), body?.excludeId)
    const visibleIds = new Set(visibleLeads(ctx).map((l) => l.id))
    return {
      __status: 200,
      data: matches.map((m) => {
        const l = serializeLead(ctx.db, m.lead)
        // a match outside the user's scope is reported without revealing its details
        return visibleIds.has(l.id)
          ? { lead: { id: l.id, name: l.name, email: l.email, phone: l.phone, stage: l.stage, owner: l.owner, createdAt: l.createdAt }, matchedOn: m.matchedOn }
          : { lead: { id: null, name: 'Lead owned by another team member' }, matchedOn: m.matchedOn }
      }),
    }
  })

  route('POST', 'leads/bulk', ({ ctx, body }: Req) => {
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 500) : []
    if (!ids.length) throw new HttpError(422, 'validation_failed', 'Select at least one lead.')
    const action = body?.action
    if (action === 'assign') require(ctx, P.leadsAssign)
    else if (action === 'delete') require(ctx, P.leadsDelete)
    else require(ctx, P.leadsUpdate)

    const failed: Array<{ id: string; message: string }> = []
    let updated = 0
    for (const id of ids) {
      try {
        const lead = findLead(ctx, id)
        if (action === 'assign') assignOwner(ctx, lead, body.ownerId || null, 'bulk')
        else if (action === 'stage') moveStage(ctx, lead, body.stageId, body.lostReason)
        else if (action === 'add_tags') {
          lead.tags = Array.from(new Set([...(lead.tags ?? []), ...(body.tags ?? []).map((t: string) => t.trim().toLowerCase()).filter(Boolean)]))
          lead.updatedAt = nowIso()
        } else if (action === 'delete') lead.deletedAt = nowIso()
        else throw new HttpError(422, 'invalid_action', 'Unknown bulk action.')
        updated++
      } catch (e: any) {
        failed.push({ id, message: e.message })
      }
    }
    audit(ctx, `leads.bulk_${action}`, 'lead', null, { count: updated, failed: failed.length })
    return { __status: 200, data: { updated, failed } }
  })

  route('GET', 'leads/:id', ({ ctx, params }: Req) => ({ data: serializeLead(ctx.db, findLead(ctx, params.id)) }))

  route('PATCH', 'leads/:id', ({ ctx, params, body }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    applyUpdate(ctx, lead, body ?? {})
    return { data: serializeLead(ctx.db, lead) }
  })

  route('DELETE', 'leads/:id', ({ ctx, params }: Req) => {
    require(ctx, P.leadsDelete)
    const lead = findLead(ctx, params.id)
    lead.deletedAt = nowIso() // soft delete; purged by the retention job
    audit(ctx, 'lead.deleted', 'lead', lead.id, { name: lead.name })
    return { __status: 204 }
  })

  route('POST', 'leads/:id/move', ({ ctx, params, body }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    moveStage(ctx, lead, body?.stageId, body?.lostReason)
    return { __status: 200, data: serializeLead(ctx.db, lead) }
  })

  route('POST', 'leads/:id/do-not-contact', ({ ctx, params, body }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    lead.doNotContact = !!body?.value
    lead.updatedAt = nowIso()
    logActivity(ctx, lead.id, 'do_not_contact', { value: lead.doNotContact, reason: body?.reason ?? null })
    if (lead.doNotContact) stopFollowUps(ctx, lead, 'do_not_contact')
    audit(ctx, lead.doNotContact ? 'lead.opted_out' : 'lead.opted_in', 'lead', lead.id)
    return { __status: 200, data: serializeLead(ctx.db, lead) }
  })

  route('GET', 'leads/:id/activities', ({ ctx, params, query }: Req) => {
    const lead = findLead(ctx, params.id)
    const rows = sortBy(ctx.db.activities.filter((a) => a.organizationId === ctx.orgId && a.leadId === lead.id), 'createdAt', 'desc')
    const page = paginate(rows, { pageSize: '50', ...query })
    return { data: page.data.map((a) => serializeActivity(ctx.db, a)), pagination: page.pagination }
  })

  route('POST', 'leads/:id/activities', ({ ctx, params, body }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    const type = body?.type
    if (!['note', 'call', 'email', 'meeting', 'whatsapp'].includes(type)) throw new HttpError(422, 'validation_failed', 'Unknown activity type.', { type: ['Invalid'] })
    if (!body?.note?.trim() && type === 'note') throw new HttpError(422, 'validation_failed', 'Write a note first.', { note: ['Required'] })
    if (type !== 'note') {
      if (lead.doNotContact && type !== 'call') throw new HttpError(422, 'do_not_contact', 'This lead asked not to be contacted.')
      markContacted(ctx, lead)
    }
    logActivity(ctx, lead.id, type, { note: body?.note?.trim() ?? null, outcome: body?.outcome ?? null })
    return { data: serializeActivity(ctx.db, ctx.db.activities[ctx.db.activities.length - 1]) }
  })

  route('GET', 'leads/:id/tasks', ({ ctx, params }: Req) => {
    const lead = findLead(ctx, params.id)
    const rows = sortBy(ctx.db.tasks.filter((t) => t.organizationId === ctx.orgId && t.leadId === lead.id), 'dueAt', 'asc')
    return { data: rows.map((t) => serializeTask(ctx.db, t)) }
  })

  route('POST', 'leads/:id/tasks', ({ ctx, params, body }: Req) => {
    require(ctx, P.tasksManage)
    const lead = findLead(ctx, params.id)
    if (!body?.title?.trim()) throw new HttpError(422, 'validation_failed', 'Title is required.', { title: ['Required'] })
    if (!body?.dueAt) throw new HttpError(422, 'validation_failed', 'Due date is required.', { dueAt: ['Required'] })
    const assigneeId = ctx.can(P.tasksViewAll) ? body.assigneeId ?? lead.ownerId ?? ctx.userId : ctx.userId
    const task = createTask(ctx, { ...body, title: body.title.trim(), leadId: lead.id, assigneeId })
    return { data: serializeTask(ctx.db, task) }
  })

  route('POST', 'leads/:id/ai/classify', ({ ctx, params }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    if (!lead.message) throw new HttpError(422, 'nothing_to_classify', 'This lead has no message to analyse.')
    if (!alreadyProcessed(ctx, `ai-manual:${lead.id}:${Math.floor(Date.now() / 5000)}`)) runAiClassification(ctx, lead, 'manual.ai')
    if (!lead.ai) throw new HttpError(422, 'ai_disabled', 'AI classification is turned off in Automations.')
    return { __status: 200, data: serializeLead(ctx.db, lead) }
  })

  // Human review of the AI suggestion: confirm (optionally applying values) or reject
  route('PATCH', 'leads/:id/ai', ({ ctx, params, body }: Req) => {
    require(ctx, P.leadsUpdate)
    const lead = findLead(ctx, params.id)
    if (!lead.ai) throw new HttpError(404, 'not_found', 'No AI insights for this lead.')
    if (!['confirmed', 'rejected'].includes(body?.status)) throw new HttpError(422, 'validation_failed', 'Invalid review status.')
    lead.ai = { ...lead.ai, ...(body.corrections ? { extracted: { ...lead.ai.extracted, ...body.corrections } } : {}), status: body.status, reviewedById: ctx.userId }
    if (body.status === 'confirmed' && body.apply) {
      const { area, budget, unitType } = lead.ai.extracted ?? {}
      lead.customFields = { ...lead.customFields, ...(area ? { area } : {}), ...(budget ? { budget } : {}), ...(unitType ? { unitType } : {}) }
      if (body.applyPriority) lead.priority = lead.ai.priority
    }
    lead.needsReview = false
    lead.updatedAt = nowIso()
    logActivity(ctx, lead.id, 'updated', { reason: `ai_${body.status}` })
    return { data: serializeLead(ctx.db, lead) }
  })

  route('GET', 'leads/:id/automation-runs', ({ ctx, params }: Req) => {
    const lead = findLead(ctx, params.id)
    const runs = sortBy(ctx.db.runs.filter((r) => r.organizationId === ctx.orgId && r.leadId === lead.id), 'startedAt', 'desc')
    return { data: runs.map((r) => serializeRun(ctx.db, r)) }
  })

  /* ---------- CSV import: preview (validate + dedupe, nothing written) then commit ---------- */

  const mapRow = (row: Record<string, string>, mapping: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const [column, field] of Object.entries(mapping ?? {})) if (field) out[field] = (row[column] ?? '').trim()
    return out
  }

  const previewRows = (ctx: Ctx, rows: Record<string, string>[], mapping: Record<string, string>) => {
    const seenEmail = new Map<string, number>()
    const seenPhone = new Map<string, number>()
    return rows.map((raw, i) => {
      const values = mapRow(raw, mapping)
      const { errors, email, phone } = validateLeadInput({ name: values.name, email: values.email, phone: values.phone })
      const errs = Object.values(errors).flat()
      if (values.priority && !PRIORITIES.includes(values.priority.toLowerCase())) errs.push(`Unknown priority "${values.priority}"`)
      const dupInFile = (email && seenEmail.has(email)) || (phone && seenPhone.has(phone))
      if (email) seenEmail.set(email, i)
      if (phone) seenPhone.set(phone, i)
      const existing = !errs.length ? findDuplicates(ctx, email, phone)[0] : null
      return {
        row: i + 2, // +1 header, +1 one-based
        values,
        status: errs.length ? 'invalid' : existing || dupInFile ? 'duplicate' : 'valid',
        errors: dupInFile && !errs.length ? ['Duplicate of an earlier row in this file'] : errs,
        duplicateOf: existing ? { id: existing.lead.id, name: existing.lead.name } : undefined,
      }
    })
  }

  route('POST', 'leads/imports/preview', ({ ctx, body }: Req) => {
    require(ctx, P.leadsImport)
    const rows = Array.isArray(body?.rows) ? body.rows : []
    if (!rows.length) throw new HttpError(422, 'validation_failed', 'The file has no data rows.')
    if (rows.length > 5000) throw new HttpError(422, 'too_many_rows', 'Import up to 5,000 rows per file.')
    if (!Object.values(body?.mapping ?? {}).includes('name')) throw new HttpError(422, 'validation_failed', 'Map a column to "Name".', { mapping: ['Name is required'] })
    const preview = previewRows(ctx, rows, body.mapping)
    return {
      __status: 200,
      data: {
        totals: {
          rows: preview.length,
          valid: preview.filter((r) => r.status === 'valid').length,
          duplicate: preview.filter((r) => r.status === 'duplicate').length,
          invalid: preview.filter((r) => r.status === 'invalid').length,
        },
        rows: preview.slice(0, 200),
      },
    }
  })

  route('POST', 'leads/imports', ({ ctx, body }: Req) => {
    require(ctx, P.leadsImport)
    const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 5000) : []
    const duplicatePolicy = body?.duplicatePolicy === 'merge' ? 'merge' : 'skip'
    const preview = previewRows(ctx, rows, body?.mapping ?? {})
    const importSource = ctx.db.sources.find((s) => s.organizationId === ctx.orgId && s.type === 'import')
    const job = {
      id: uid('imp'), organizationId: ctx.orgId, status: 'completed', fileName: body?.fileName ?? 'import.csv', totalRows: rows.length,
      created: 0, updated: 0, skipped: 0, failed: [] as Array<{ row: number; message: string }>, createdAt: nowIso(),
    }
    // each row is processed on its own: one bad row never rolls back the good ones
    for (const r of preview) {
      if (r.status === 'invalid') { job.failed.push({ row: r.row, message: r.errors.join('; ') }); continue }
      if (r.status === 'duplicate' && duplicatePolicy === 'skip') { job.skipped++; continue }
      try {
        const v = r.values
        const source = v.source ? ctx.db.sources.find((s) => s.organizationId === ctx.orgId && s.name.toLowerCase() === v.source.toLowerCase()) : null
        const { created } = ingestLead(ctx, {
          name: v.name, email: v.email, phone: v.phone, company: v.company || null, campaign: v.campaign || null,
          sourceId: (source ?? importSource)?.id, priority: v.priority ? v.priority.toLowerCase() : 'medium',
          tags: v.tags ? v.tags.split(/[|;]/).map((t) => t.trim().toLowerCase()).filter(Boolean) : [], message: v.message || null,
          ownerId: ctx.can(P.leadsAssign) ? body?.ownerId ?? null : ctx.userId,
        }, 'import.csv', `import:${job.id}:${r.row}`)
        created ? job.created++ : job.updated++
      } catch (e: any) {
        job.failed.push({ row: r.row, message: e.message })
      }
    }
    ctx.db.imports.push(job)
    if (job.failed.length) {
      ctx.db.notifications.push({ id: uid('ntf'), organizationId: ctx.orgId, userId: ctx.userId, type: 'import_failed_rows', title: 'Some rows were not imported', body: `${job.failed.length} row(s) in ${job.fileName} failed validation.`, link: { name: 'leads' }, readAt: null, createdAt: nowIso() })
    }
    audit(ctx, 'leads.imported', 'import', job.id, { created: job.created, updated: job.updated, skipped: job.skipped, failed: job.failed.length })
    const { organizationId, ...out } = job
    return { data: out }
  })

  route('GET', 'leads/imports/:id', ({ ctx, params }: Req) => {
    const job = ctx.db.imports.find((j) => j.id === params.id && j.organizationId === ctx.orgId)
    if (!job) throw new HttpError(404, 'not_found', 'Import not found.')
    const { organizationId, ...out } = job
    return { data: out }
  })

  /* ---------- pipeline board ---------- */

  route('GET', 'pipeline/board', ({ ctx, query }: Req) => {
    require(ctx, P.leadsViewAll, P.leadsViewOwn)
    const rows = filterLeads(ctx, { ...query, sort: 'updatedAt', order: 'desc' })
    return {
      data: {
        stages: stagesOf(ctx).map((s) => {
          const inStage = rows.filter((l) => l.stageId === s.id)
          return {
            id: s.id, name: s.name, key: s.key, type: s.type, color: s.color, position: s.position, autoTask: s.autoTask,
            total: inStage.length,
            leads: inStage.slice(0, 50).map((l) => serializeLead(ctx.db, l)),
          }
        }),
      },
    }
  })

  route('GET', 'tags', ({ ctx }: Req) => ({
    data: Array.from(new Set(visibleLeads(ctx).flatMap((l) => l.tags ?? []))).sort(),
  }))

}
