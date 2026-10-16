import { route, type Req } from '../server'
import { NOTIFICATION_TYPES, PLANS, defaultPreferences, nowIso, permissionsFor, uid } from '../db'
import { HttpError, audit, require, userRef } from '../rules'
import { paginate, serializeMember, serializeOrg, sortBy } from '../serializers'
import { ASSIGNABLE_ROLES, P } from '@/config/permissions'
import { TIMEZONES } from '@/constants/lead'

export function registerOrg() {
  route('GET', 'organizations/current', ({ ctx }: Req) => ({
    data: serializeOrg(ctx.db.organizations.find((o) => o.id === ctx.orgId)),
  }))

  route('PATCH', 'organizations/current', ({ ctx, body }: Req) => {
    require(ctx, P.settingsManage)
    const org = ctx.db.organizations.find((o) => o.id === ctx.orgId)!
    const errors: Record<string, string[]> = {}
    if ('name' in body && !body.name?.trim()) errors.name = ['Required']
    if ('timezone' in body && !TIMEZONES.includes(body.timezone)) errors.timezone = ['Unsupported timezone']
    if ('locale' in body && !['en', 'ar'].includes(body.locale)) errors.locale = ['Unsupported language']
    if (Object.keys(errors).length) throw new HttpError(422, 'validation_failed', 'Please fix the highlighted fields.', errors)
    for (const key of ['name', 'industry', 'timezone', 'locale', 'currency', 'businessHours']) if (key in body) org[key] = key === 'name' ? body.name.trim() : body[key]
    audit(ctx, 'organization.updated', 'organization', org.id, { fields: Object.keys(body) })
    return { data: serializeOrg(org) }
  })

  route('POST', 'organizations/current/complete-onboarding', ({ ctx }: Req) => {
    require(ctx, P.settingsManage)
    const org = ctx.db.organizations.find((o) => o.id === ctx.orgId)!
    org.onboardingCompleted = true
    return { __status: 200, data: serializeOrg(org) }
  })

  /* ---------- members & invitations ---------- */

  route('GET', 'members', ({ ctx, query }: Req) => {
    // every member may list active teammates (needed for owner pickers); full list needs members.view
    let rows = ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId)
    if (!ctx.can(P.membersView) || query.status === 'active') rows = rows.filter((m) => m.status === 'active')
    if (query.role) rows = rows.filter((m) => query.role.split(',').includes(m.role))
    if (query.search) {
      const s = query.search.toLowerCase()
      rows = rows.filter((m) => { const u = userRef(ctx.db, m.userId); return u?.name.toLowerCase().includes(s) || u?.email?.includes(s) })
    }
    const page = paginate(rows, { pageSize: '100', ...query })
    return { data: page.data.map((m) => serializeMember(ctx.db, m)), pagination: page.pagination }
  })

  route('PATCH', 'members/:id', ({ ctx, params, body }: Req) => {
    require(ctx, P.membersManage)
    const m = ctx.db.memberships.find((x) => x.id === params.id && x.organizationId === ctx.orgId)
    if (!m) throw new HttpError(404, 'not_found', 'Member not found.')
    if (m.userId === ctx.userId && ('role' in body || 'status' in body)) {
      throw new HttpError(403, 'self_modification', 'You cannot change your own role or status.')
    }
    const owners = ctx.db.memberships.filter((x) => x.organizationId === ctx.orgId && x.role === 'owner' && x.status === 'active')
    if (m.role === 'owner' && owners.length === 1 && ((body.role && body.role !== 'owner') || body.status === 'inactive')) {
      throw new HttpError(422, 'last_owner', 'An organization must keep at least one active owner.')
    }
    if (body.role) {
      if (!ASSIGNABLE_ROLES.includes(body.role)) throw new HttpError(422, 'validation_failed', 'Unknown role.', { role: ['Invalid'] })
      if (body.role === 'owner' && ctx.role !== 'owner') throw new HttpError(403, 'forbidden', 'Only an owner can grant the owner role.')
      audit(ctx, 'member.role_changed', 'membership', m.id, { from: m.role, to: body.role, user: userRef(ctx.db, m.userId)?.email })
      m.role = body.role
    }
    if (body.status) {
      if (!['active', 'inactive'].includes(body.status)) throw new HttpError(422, 'validation_failed', 'Unknown status.')
      m.status = body.status
      audit(ctx, body.status === 'inactive' ? 'member.deactivated' : 'member.activated', 'membership', m.id, { user: userRef(ctx.db, m.userId)?.email })
      // deactivation ends every session of that user in this org
      if (body.status === 'inactive') ctx.db.sessions.filter((s) => s.userId === m.userId && s.organizationId === ctx.orgId).forEach((s) => (s.revoked = true))
    }
    if (Array.isArray(body.specialties)) m.specialties = body.specialties.map((s: string) => s.trim()).filter(Boolean)
    return { data: serializeMember(ctx.db, m) }
  })

  route('GET', 'invitations', ({ ctx }: Req) => {
    require(ctx, P.membersView)
    const rows = ctx.db.invitations.filter((i) => i.organizationId === ctx.orgId)
    rows.forEach((i) => { if (i.status === 'pending' && new Date(i.expiresAt) < new Date()) i.status = 'expired' })
    return {
      data: sortBy(rows, 'createdAt', 'desc').map((i) => ({
        id: i.id, email: i.email, role: i.role, status: i.status, expiresAt: i.expiresAt, invitedBy: userRef(ctx.db, i.invitedById), createdAt: i.createdAt,
      })),
    }
  })

  route('POST', 'invitations', ({ ctx, body }: Req) => {
    require(ctx, P.membersManage)
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, 'validation_failed', 'Enter a valid email.', { email: ['Invalid email'] })
    if (!ASSIGNABLE_ROLES.includes(body?.role)) throw new HttpError(422, 'validation_failed', 'Choose a role.', { role: ['Required'] })
    if (body.role === 'owner' && ctx.role !== 'owner') throw new HttpError(403, 'forbidden', 'Only an owner can invite another owner.')
    const existingUser = ctx.db.users.find((u) => u.email === email)
    if (existingUser && ctx.db.memberships.some((m) => m.organizationId === ctx.orgId && m.userId === existingUser.id)) {
      throw new HttpError(422, 'validation_failed', 'This person is already a member.', { email: ['Already a member'] })
    }
    const plan = PLANS[ctx.db.organizations.find((o) => o.id === ctx.orgId)!.planId]
    const seats = ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.status === 'active').length
    if (seats >= plan.limits.members) throw new HttpError(402, 'plan_limit', `Your plan allows ${plan.limits.members} members. Upgrade to invite more.`)
    ctx.db.invitations.filter((i) => i.organizationId === ctx.orgId && i.email === email && i.status === 'pending').forEach((i) => (i.status = 'revoked'))
    const inv = { id: uid('inv'), organizationId: ctx.orgId, email, role: body.role, token: uid('tok'), status: 'pending', expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), invitedById: ctx.userId, createdAt: nowIso() }
    ctx.db.invitations.push(inv)
    audit(ctx, 'member.invited', 'invitation', inv.id, { email, role: body.role })
    // the mock exposes the link so the accept flow can be tried without email delivery
    return { data: { id: inv.id, email, role: inv.role, status: inv.status, expiresAt: inv.expiresAt, invitedBy: userRef(ctx.db, ctx.userId), createdAt: inv.createdAt }, debugInviteToken: inv.token }
  })

  route('DELETE', 'invitations/:id', ({ ctx, params }: Req) => {
    require(ctx, P.membersManage)
    const inv = ctx.db.invitations.find((i) => i.id === params.id && i.organizationId === ctx.orgId)
    if (!inv) throw new HttpError(404, 'not_found', 'Invitation not found.')
    inv.status = 'revoked'
    audit(ctx, 'invitation.revoked', 'invitation', inv.id, { email: inv.email })
    return { __status: 204 }
  })

  route('GET', 'roles', ({ ctx }: Req) => ({
    data: ASSIGNABLE_ROLES.map((key) => ({
      key, permissions: permissionsFor(key),
      members: ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.role === key && m.status === 'active').length,
    })),
  }))

  /* ---------- notifications ---------- */

  route('GET', 'notifications', ({ ctx, query }: Req) => {
    let rows = ctx.db.notifications.filter((n) => n.organizationId === ctx.orgId && n.userId === ctx.userId)
    const unread = rows.filter((n) => !n.readAt).length
    if (query.unread === '1') rows = rows.filter((n) => !n.readAt)
    if (query.type) rows = rows.filter((n) => n.type === query.type)
    const page = paginate(sortBy(rows, 'createdAt', 'desc'), query)
    return { data: page.data.map(({ organizationId, userId, dedupeKey, ...n }) => n), pagination: page.pagination, unread }
  })

  route('POST', 'notifications/:id/read', ({ ctx, params }: Req) => {
    const n = ctx.db.notifications.find((x) => x.id === params.id && x.organizationId === ctx.orgId && x.userId === ctx.userId)
    if (!n) throw new HttpError(404, 'not_found', 'Notification not found.')
    n.readAt = n.readAt ?? nowIso()
    return { __status: 204 }
  })

  route('POST', 'notifications/read-all', ({ ctx }: Req) => {
    ctx.db.notifications.filter((n) => n.organizationId === ctx.orgId && n.userId === ctx.userId && !n.readAt).forEach((n) => (n.readAt = nowIso()))
    return { __status: 204 }
  })

  route('GET', 'notification-preferences', ({ ctx }: Req) => {
    let row = ctx.db.preferences.find((p) => p.organizationId === ctx.orgId && p.userId === ctx.userId)
    if (!row) ctx.db.preferences.push((row = { organizationId: ctx.orgId, userId: ctx.userId, prefs: defaultPreferences() }))
    return { data: row.prefs }
  })

  route('PUT', 'notification-preferences', ({ ctx, body }: Req) => {
    let row = ctx.db.preferences.find((p) => p.organizationId === ctx.orgId && p.userId === ctx.userId)
    if (!row) ctx.db.preferences.push((row = { organizationId: ctx.orgId, userId: ctx.userId, prefs: defaultPreferences() }))
    for (const type of NOTIFICATION_TYPES) {
      if (body?.[type]) row.prefs[type] = { inApp: !!body[type].inApp, email: !!body[type].email }
    }
    return { __status: 200, data: row.prefs }
  })

  /* ---------- billing & audit ---------- */

  route('GET', 'billing/subscription', ({ ctx }: Req) => {
    require(ctx, P.billingManage, P.settingsManage)
    const sub = ctx.db.subscriptions.find((s) => s.organizationId === ctx.orgId)!
    const plan = PLANS[sub.planId]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    return {
      data: {
        plan: { id: plan.id, name: plan.name, priceMonthly: plan.priceMonthly, currency: plan.currency },
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        usage: [
          { key: 'leads', used: ctx.db.leads.filter((l) => l.organizationId === ctx.orgId && !l.deletedAt).length, limit: plan.limits.leads },
          { key: 'members', used: ctx.db.memberships.filter((m) => m.organizationId === ctx.orgId && m.status === 'active').length, limit: plan.limits.members },
          { key: 'automation_runs', used: ctx.db.runs.filter((r) => r.organizationId === ctx.orgId && r.startedAt >= monthStart).length, limit: plan.limits.automation_runs },
          { key: 'ai_requests', used: ctx.db.leads.filter((l) => l.organizationId === ctx.orgId && l.ai && l.ai.generatedAt >= monthStart).length, limit: plan.limits.ai_requests },
        ],
      },
    }
  })

  route('GET', 'audit-logs', ({ ctx, query }: Req) => {
    require(ctx, P.auditView)
    let rows = ctx.db.auditLogs.filter((a) => a.organizationId === ctx.orgId)
    if (query.action) rows = rows.filter((a) => a.action.startsWith(query.action))
    if (query.actorId) rows = rows.filter((a) => a.actorId === query.actorId)
    const page = paginate(sortBy(rows, 'createdAt', 'desc'), query)
    return {
      data: page.data.map((a) => ({ id: a.id, actor: userRef(ctx.db, a.actorId), action: a.action, entityType: a.entityType, entityId: a.entityId, metadata: a.metadata, ip: a.ip, createdAt: a.createdAt })),
      pagination: page.pagination,
    }
  })
}
