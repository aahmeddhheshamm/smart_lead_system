import { route, type Req } from '../server'
import { require, stagesOf, userRef, type Ctx } from '../rules'
import { serializeActivity, visibleLeads } from '../serializers'
import { P } from '@/config/permissions'

// Metric definitions are part of the response so every screen shows the same wording (PRD §4 E)
export const DEFINITIONS = {
  newLeads: 'Leads created inside the selected period.',
  conversionRate: 'Cohort conversion: of the leads created in the period, the share that is now Won.',
  qualified: 'Leads that entered the Qualified stage (or later) during the period.',
  won: 'Leads moved to Won during the period, whenever they were created.',
  lost: 'Leads moved to Lost during the period, whenever they were created.',
  firstResponse: 'Minutes from lead creation to the first logged call, email, meeting or WhatsApp.',
  notFollowedUp: 'Open leads with no contact logged yet.',
}

function period(query: Record<string, string>) {
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date()
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(to.getTime() - 29 * 864e5)
  return { from: from.toISOString(), to: to.toISOString() }
}

const inRange = (iso: string | null, p: { from: string; to: string }) => !!iso && iso >= p.from && iso <= p.to
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}
const responseMinutes = (l: any) => (l.firstContactedAt ? (new Date(l.firstContactedAt).getTime() - new Date(l.createdAt).getTime()) / 6e4 : null)

function scope(ctx: Ctx, query: Record<string, string>) {
  let leads = visibleLeads(ctx)
  if (query.ownerId) leads = leads.filter((l) => l.ownerId === query.ownerId)
  if (query.sourceId) leads = leads.filter((l) => l.sourceId === query.sourceId)
  return leads
}

function qualifiedIds(ctx: Ctx, p: { from: string; to: string }) {
  const stages = stagesOf(ctx)
  const qIndex = stages.findIndex((s) => s.key === 'qualified')
  const atOrAfter = new Set(stages.filter((s, i) => (qIndex >= 0 ? i >= qIndex : s.type !== 'open') && s.type !== 'lost').map((s) => s.id))
  return new Set(ctx.db.stageHistory.filter((h) => h.organizationId === ctx.orgId && atOrAfter.has(h.toStageId) && inRange(h.at, p)).map((h) => h.leadId))
}

export function registerInsights() {
  route('GET', 'dashboard/summary', ({ ctx, query }: Req) => {
    const p = period(query)
    const leads = scope(ctx, query)
    const stages = stagesOf(ctx)
    const openIds = new Set(stages.filter((s) => s.type === 'open').map((s) => s.id))
    const cohort = leads.filter((l) => inRange(l.createdAt, p))
    const now = new Date()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    const leadIds = new Set(leads.map((l) => l.id))
    const tasks = ctx.db.tasks.filter((t) => t.organizationId === ctx.orgId && t.status === 'open' && (ctx.can(P.tasksViewAll) ? true : t.assigneeId === ctx.userId))
      .filter((t) => !query.ownerId || t.assigneeId === query.ownerId)
    const qualified = qualifiedIds(ctx, p)
    const responses = cohort.map(responseMinutes).filter((x): x is number => x !== null)

    const sources = ctx.db.sources.filter((s) => s.organizationId === ctx.orgId)
    const bySource = sources.map((s) => ({
      source: s.name,
      leads: cohort.filter((l) => l.sourceId === s.id).length,
      won: cohort.filter((l) => l.sourceId === s.id && l.wonAt).length,
    })).filter((s) => s.leads).sort((a, b) => b.leads - a.leads)

    const team = ctx.can(P.leadsViewAll)
      ? ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.role === 'sales_agent').map((m) => ({
        user: userRef(ctx.db, m.userId),
        assigned: cohort.filter((l) => l.ownerId === m.userId).length,
        contacted: cohort.filter((l) => l.ownerId === m.userId && l.lastContactedAt).length,
        won: leads.filter((l) => l.ownerId === m.userId && inRange(l.wonAt, p)).length,
        overdueTasks: ctx.db.tasks.filter((t) => t.organizationId === ctx.orgId && t.assigneeId === m.userId && t.status === 'open' && new Date(t.dueAt) < now).length,
      }))
      : []

    const needsAttention = [
      ...leads.filter((l) => openIds.has(l.stageId) && !l.lastContactedAt && !l.doNotContact)
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)).slice(0, 5)
        .map((l) => ({ kind: 'uncontacted', lead: { id: l.id, name: l.name }, detail: userRef(ctx.db, l.ownerId)?.name ?? 'Unassigned', at: l.createdAt })),
      ...tasks.filter((t) => new Date(t.dueAt) < now && t.leadId && leadIds.has(t.leadId))
        .sort((a, b) => (a.dueAt > b.dueAt ? 1 : -1)).slice(0, 5)
        .map((t) => ({ kind: 'overdue_task', lead: { id: t.leadId, name: leads.find((l) => l.id === t.leadId)?.name }, detail: t.title, at: t.dueAt })),
      ...leads.filter((l) => l.ai?.status === 'needs_review' || l.needsReview).slice(0, 3)
        .map((l) => ({ kind: 'needs_review', lead: { id: l.id, name: l.name }, detail: l.ai?.classification ?? 'Possible duplicate', at: l.updatedAt })),
    ]

    const recentActivity = ctx.db.activities
      .filter((a) => a.organizationId === ctx.orgId && leadIds.has(a.leadId))
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 10)
      .map((a) => ({ ...serializeActivity(ctx.db, a), lead: { id: a.leadId, name: leads.find((l) => l.id === a.leadId)?.name } }))

    return {
      data: {
        period: p,
        kpis: {
          newLeads: cohort.length,
          notFollowedUp: leads.filter((l) => openIds.has(l.stageId) && !l.lastContactedAt && !l.doNotContact).length,
          tasksDue: tasks.filter((t) => new Date(t.dueAt) >= now && t.dueAt < endOfToday).length,
          tasksOverdue: tasks.filter((t) => new Date(t.dueAt) < now).length,
          qualified: leads.filter((l) => qualified.has(l.id)).length,
          won: leads.filter((l) => inRange(l.wonAt, p)).length,
          lost: leads.filter((l) => inRange(l.lostAt, p)).length,
          conversionRate: pct(cohort.filter((l) => l.wonAt).length, cohort.length),
          avgFirstResponseMinutes: responses.length ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : null,
        },
        conversionDefinition: DEFINITIONS.conversionRate,
        bySource,
        team,
        needsAttention,
        recentActivity,
      },
    }
  })

  route('GET', 'reports', ({ ctx, query }: Req) => {
    require(ctx, P.reportsView)
    const p = period(query)
    const leads = scope(ctx, query)
    const cohort = leads.filter((l) => inRange(l.createdAt, p))
    const stages = stagesOf(ctx)
    const qualified = qualifiedIds(ctx, p)

    // funnel: how many of the cohort ever reached each stage. Every lead starts in the first
    // stage; later stages count leads that are there now or have a history row into them.
    const history = ctx.db.stageHistory.filter((h) => h.organizationId === ctx.orgId)
    const reached = (stageId: string) => {
      if (stages[0]?.id === stageId) return cohort.length
      return cohort.filter((l) => l.stageId === stageId || history.some((h) => h.leadId === l.id && h.toStageId === stageId)).length
    }

    const sources = ctx.db.sources.filter((s) => s.organizationId === ctx.orgId)
    const campaigns = Array.from(new Set(cohort.map((l) => l.campaign).filter(Boolean))) as string[]
    const responses = cohort.map(responseMinutes)
    const lostReasons: Record<string, number> = {}
    leads.filter((l) => inRange(l.lostAt, p)).forEach((l) => (lostReasons[l.lostReason ?? 'other'] = (lostReasons[l.lostReason ?? 'other'] ?? 0) + 1))

    return {
      data: {
        period: p,
        definitions: DEFINITIONS,
        funnel: stages.filter((s) => s.type !== 'lost').map((s) => ({ stage: s.name, type: s.type, count: reached(s.id) })),
        bySource: sources.map((s) => {
          const rows = cohort.filter((l) => l.sourceId === s.id)
          const won = rows.filter((l) => l.wonAt).length
          return { source: s.name, leads: rows.length, qualified: rows.filter((l) => qualified.has(l.id)).length, won, conversionRate: pct(won, rows.length) }
        }).filter((r) => r.leads).sort((a, b) => b.leads - a.leads),
        byCampaign: campaigns.map((c) => {
          const rows = cohort.filter((l) => l.campaign === c)
          const won = rows.filter((l) => l.wonAt).length
          return { campaign: c, leads: rows.length, won, conversionRate: pct(won, rows.length) }
        }).sort((a, b) => b.leads - a.leads),
        team: ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.role === 'sales_agent').map((m) => {
          const rows = cohort.filter((l) => l.ownerId === m.userId)
          const won = rows.filter((l) => l.wonAt).length
          const times = rows.map(responseMinutes).filter((x): x is number => x !== null)
          return {
            user: userRef(ctx.db, m.userId), assigned: rows.length, won, lost: rows.filter((l) => l.lostAt).length,
            conversionRate: pct(won, rows.length), avgFirstResponseMinutes: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
          }
        }),
        lostReasons: Object.entries(lostReasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        responseTime: {
          medianMinutes: median(responses.filter((x): x is number => x !== null)),
          within15m: responses.filter((x) => x !== null && x <= 15).length,
          within1h: responses.filter((x) => x !== null && x > 15 && x <= 60).length,
          over1h: responses.filter((x) => x !== null && x > 60).length,
          never: responses.filter((x) => x === null).length,
        },
      },
    }
  })
}
