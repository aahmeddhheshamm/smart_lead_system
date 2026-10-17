import { route, type Req } from '../server'
import { nowIso, uid } from '../db'
import { HttpError, audit, createTask, logActivity, markContacted, require, stagesOf, type Ctx } from '../rules'
import { paginate, serializeTask, sortBy, visibleLeads } from '../serializers'
import { P } from '@/config/permissions'

function visibleTasks(ctx: Ctx) {
  const all = ctx.db.tasks.filter((t) => t.organizationId === ctx.orgId)
  if (ctx.can(P.tasksViewAll)) return all
  const myLeads = new Set(visibleLeads(ctx).map((l) => l.id))
  return all.filter((t) => t.assigneeId === ctx.userId || (t.leadId && myLeads.has(t.leadId) && !t.assigneeId))
}

function findTask(ctx: Ctx, id: string) {
  const task = visibleTasks(ctx).find((t) => t.id === id)
  if (!task) throw new HttpError(404, 'not_found', 'Task not found.')
  return task
}

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function registerWork() {
  route('GET', 'tasks', ({ ctx, query }: Req) => {
    let rows = visibleTasks(ctx)
    const now = new Date()
    const todayStart = startOfDay(now).getTime()
    const tomorrowStart = todayStart + 864e5
    const view = query.view ?? 'today'
    // "today" = still ahead of us today; anything already past due is "overdue"
    if (view === 'today') rows = rows.filter((t) => t.status === 'open' && new Date(t.dueAt) >= now && new Date(t.dueAt).getTime() < tomorrowStart)
    if (view === 'overdue') rows = rows.filter((t) => t.status === 'open' && new Date(t.dueAt) < now)
    if (view === 'upcoming') rows = rows.filter((t) => t.status === 'open' && new Date(t.dueAt).getTime() >= tomorrowStart)
    if (view === 'completed') rows = rows.filter((t) => t.status !== 'open')
    if (query.assigneeId) rows = rows.filter((t) => t.assigneeId === query.assigneeId)
    if (query.from) rows = rows.filter((t) => t.dueAt >= query.from)
    if (query.to) rows = rows.filter((t) => t.dueAt <= query.to)
    if (query.type) rows = rows.filter((t) => t.type === query.type)
    rows = sortBy(rows, query.sort || 'dueAt', query.order || (view === 'completed' ? 'desc' : 'asc'))
    const page = paginate(rows, query)

    const all = visibleTasks(ctx).filter((t) => !query.assigneeId || t.assigneeId === query.assigneeId)
    const counts = {
      today: all.filter((t) => t.status === 'open' && new Date(t.dueAt) >= now && new Date(t.dueAt).getTime() < tomorrowStart).length,
      overdue: all.filter((t) => t.status === 'open' && new Date(t.dueAt) < now).length,
      upcoming: all.filter((t) => t.status === 'open' && new Date(t.dueAt).getTime() >= tomorrowStart).length,
    }
    return { data: page.data.map((t) => serializeTask(ctx.db, t)), pagination: page.pagination, counts }
  })

  route('POST', 'tasks', ({ ctx, body }: Req) => {
    require(ctx, P.tasksManage)
    if (!body?.title?.trim()) throw new HttpError(422, 'validation_failed', 'Title is required.', { title: ['Required'] })
    if (!body?.dueAt) throw new HttpError(422, 'validation_failed', 'Due date is required.', { dueAt: ['Required'] })
    if (body.leadId && !visibleLeads(ctx).some((l) => l.id === body.leadId)) throw new HttpError(404, 'not_found', 'Lead not found.')
    const assigneeId = ctx.can(P.tasksViewAll) ? body.assigneeId ?? ctx.userId : ctx.userId
    return { data: serializeTask(ctx.db, createTask(ctx, { ...body, title: body.title.trim(), assigneeId })) }
  })

  route('PATCH', 'tasks/:id', ({ ctx, params, body }: Req) => {
    require(ctx, P.tasksManage)
    const task = findTask(ctx, params.id)
    if (task.status !== 'open') throw new HttpError(422, 'task_closed', 'Closed tasks cannot be edited.')
    for (const key of ['title', 'type', 'priority', 'dueAt', 'notes']) if (key in (body ?? {})) task[key] = body[key]
    if ('assigneeId' in (body ?? {})) {
      require(ctx, P.tasksViewAll)
      if (body.assigneeId && !ctx.db.memberships.some((m) => m.organizationId === ctx.orgId && m.userId === body.assigneeId && m.status === 'active')) {
        throw new HttpError(422, 'invalid_assignee', 'The assignee must be an active member.', { assigneeId: ['Inactive or unknown member'] })
      }
      task.assigneeId = body.assigneeId
    }
    return { data: serializeTask(ctx.db, task) }
  })

  route('POST', 'tasks/:id/complete', ({ ctx, params, body }: Req) => {
    require(ctx, P.tasksManage)
    const task = findTask(ctx, params.id)
    if (task.status !== 'open') throw new HttpError(409, 'already_closed', 'This task is already closed.')
    task.status = 'completed'
    task.completedAt = nowIso()
    task.outcome = body?.outcome ?? null
    task.notes = body?.notes ?? task.notes
    if (task.leadId) {
      const lead = ctx.db.leads.find((l) => l.id === task.leadId && l.organizationId === ctx.orgId)
      if (lead && ['call', 'email', 'meeting', 'viewing', 'follow_up', 'send_quote', 'whatsapp'].includes(task.type)) markContacted(ctx, lead)
      logActivity(ctx, task.leadId, 'task_completed', { title: task.title, outcome: task.outcome, notes: task.notes })
      if (lead) {
        const next = ctx.db.tasks.filter((t) => t.leadId === lead.id && t.status === 'open').sort((a, b) => (a.dueAt > b.dueAt ? 1 : -1))[0]
        lead.nextFollowUpAt = next?.dueAt ?? null
      }
    }
    let followUp = null
    if (body?.followUp?.title && body?.followUp?.dueAt) {
      followUp = serializeTask(ctx.db, createTask(ctx, { leadId: task.leadId, assigneeId: task.assigneeId, title: body.followUp.title, type: body.followUp.type ?? 'follow_up', priority: task.priority, dueAt: body.followUp.dueAt }))
    }
    return { __status: 200, data: serializeTask(ctx.db, task), followUp }
  })

  route('POST', 'tasks/:id/postpone', ({ ctx, params, body }: Req) => {
    require(ctx, P.tasksManage)
    const task = findTask(ctx, params.id)
    if (task.status !== 'open') throw new HttpError(422, 'task_closed', 'Closed tasks cannot be postponed.')
    if (!body?.dueAt || new Date(body.dueAt) < new Date()) throw new HttpError(422, 'validation_failed', 'Pick a time in the future.', { dueAt: ['Must be in the future'] })
    task.dueAt = body.dueAt
    return { __status: 200, data: serializeTask(ctx.db, task) }
  })

  route('POST', 'tasks/:id/cancel', ({ ctx, params }: Req) => {
    require(ctx, P.tasksManage)
    const task = findTask(ctx, params.id)
    task.status = 'cancelled'
    task.completedAt = nowIso()
    return { __status: 200, data: serializeTask(ctx.db, task) }
  })

  /* ---------- pipeline stages ---------- */

  route('GET', 'pipeline-stages', ({ ctx }: Req) => ({ data: stagesOf(ctx).map(({ organizationId, ...s }) => s) }))

  // Replace the whole ordered list (create / rename / reorder / remove in one call)
  route('PUT', 'pipeline-stages', ({ ctx, body }: Req) => {
    require(ctx, P.pipelineManage)
    const incoming: any[] = Array.isArray(body?.stages) ? body.stages : []
    const types = incoming.map((s) => s.type)
    if (!types.includes('open') || types.filter((t) => t === 'won').length !== 1 || types.filter((t) => t === 'lost').length !== 1) {
      throw new HttpError(422, 'invalid_pipeline', 'A pipeline needs at least one open stage, exactly one Won and one Lost stage.')
    }
    if (incoming.some((s) => !s.name?.trim())) throw new HttpError(422, 'invalid_pipeline', 'Every stage needs a name.')
    if (incoming.length > 12) throw new HttpError(422, 'invalid_pipeline', 'Use at most 12 stages.')
    const current = stagesOf(ctx)
    const keepIds = new Set(incoming.filter((s) => s.id).map((s) => s.id))
    const removed = current.filter((s) => !keepIds.has(s.id))
    const inUse = removed.filter((s) => ctx.db.leads.some((l) => l.stageId === s.id && !l.deletedAt))
    if (inUse.length) throw new HttpError(422, 'stage_in_use', `Move the leads out of "${inUse[0].name}" before removing it.`)
    ctx.db.stages = ctx.db.stages.filter((s) => s.organizationId !== ctx.orgId || keepIds.has(s.id))
    incoming.forEach((s, position) => {
      const existing = s.id && ctx.db.stages.find((x) => x.id === s.id && x.organizationId === ctx.orgId)
      const data = { name: s.name.trim(), type: s.type, color: s.color ?? '#64748B', autoTask: s.autoTask ?? null, position }
      if (existing) Object.assign(existing, data)
      else ctx.db.stages.push({ id: uid('stg'), organizationId: ctx.orgId, key: s.name.trim().toLowerCase().replace(/\W+/g, '_'), ...data })
    })
    audit(ctx, 'pipeline.updated', 'pipeline_stage', null, { stages: incoming.map((s) => s.name) })
    return { __status: 200, data: stagesOf(ctx).map(({ organizationId, ...s }) => s) }
  })

  /* ---------- lead sources ---------- */

  route('GET', 'lead-sources', ({ ctx }: Req) => ({
    data: ctx.db.sources.filter((s) => s.organizationId === ctx.orgId).map(({ organizationId, ...s }) => ({
      ...s, leads: ctx.db.leads.filter((l) => l.sourceId === s.id && !l.deletedAt).length,
    })),
  }))

  route('POST', 'lead-sources', ({ ctx, body }: Req) => {
    require(ctx, P.settingsManage)
    if (!body?.name?.trim()) throw new HttpError(422, 'validation_failed', 'Name is required.', { name: ['Required'] })
    if (ctx.db.sources.some((s) => s.organizationId === ctx.orgId && s.name.toLowerCase() === body.name.trim().toLowerCase())) {
      throw new HttpError(422, 'validation_failed', 'A source with this name already exists.', { name: ['Already exists'] })
    }
    const src = { id: uid('src'), organizationId: ctx.orgId, name: body.name.trim(), type: body.type ?? 'other', active: true }
    ctx.db.sources.push(src)
    const { organizationId, ...out } = src
    return { data: out }
  })

  route('PATCH', 'lead-sources/:id', ({ ctx, params, body }: Req) => {
    require(ctx, P.settingsManage)
    const src = ctx.db.sources.find((s) => s.id === params.id && s.organizationId === ctx.orgId)
    if (!src) throw new HttpError(404, 'not_found', 'Source not found.')
    for (const key of ['name', 'type', 'active']) if (key in (body ?? {})) src[key] = body[key]
    const { organizationId, ...out } = src
    return { data: out }
  })

  route('DELETE', 'lead-sources/:id', ({ ctx, params }: Req) => {
    require(ctx, P.settingsManage)
    const src = ctx.db.sources.find((s) => s.id === params.id && s.organizationId === ctx.orgId)
    if (!src) throw new HttpError(404, 'not_found', 'Source not found.')
    // sources referenced by leads are deactivated, not deleted, so reports stay correct
    if (ctx.db.leads.some((l) => l.sourceId === src.id)) src.active = false
    else ctx.db.sources = ctx.db.sources.filter((s) => s !== src)
    return { __status: 204 }
  })
}
