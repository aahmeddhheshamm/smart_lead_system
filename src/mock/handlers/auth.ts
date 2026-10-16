import { route, type Req } from '../server'
import { createOrganizationRows, defaultPreferences, getDb, nowIso, permissionsFor, resetDb, uid } from '../db'
import { HttpError, audit, makeCtx } from '../rules'
import { serializeOrg } from '../serializers'

function me(userId: string, orgId: string) {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)!
  const org = db.organizations.find((o) => o.id === orgId)!
  const membership = db.memberships.find((m) => m.organizationId === orgId && m.userId === userId)!
  return {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, locale: user.locale, emailVerified: user.emailVerified },
    organization: serializeOrg(org),
    membership: { id: membership.id, role: membership.role, status: membership.status, permissions: permissionsFor(membership.role) },
  }
}

function openSession(userId: string, orgId: string) {
  const db = getDb()
  const token = `mock.${uid('ses')}`
  db.sessions.push({ id: uid('ses'), token, userId, organizationId: orgId, userAgent: navigator.userAgent.slice(0, 120), ip: '127.0.0.1', revoked: false, createdAt: nowIso(), lastSeenAt: nowIso() })
  return token
}

// naive per-email throttle for brute-force protection (the real API rate-limits per IP + account)
const failures: Record<string, number[]> = {}

const strongPassword = (p: string) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)

export function registerAuth() {
  route('POST', 'auth/login', ({ body }: Req) => {
    const db = getDb()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const recent = (failures[email] ?? []).filter((t) => Date.now() - t < 5 * 6e4)
    if (recent.length >= 5) throw new HttpError(429, 'too_many_attempts', 'Too many failed attempts. Try again in a few minutes.')

    const user = db.users.find((u) => u.email === email && u.password === body?.password)
    if (!user) {
      failures[email] = [...recent, Date.now()]
      throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.')
    }
    const membership = db.memberships.find((m) => m.userId === user.id && m.status === 'active')
    if (!membership) throw new HttpError(403, 'account_inactive', 'Your account has been deactivated. Contact your administrator.')
    failures[email] = []
    const token = openSession(user.id, membership.organizationId)
    return { __status: 200, data: { token, ...me(user.id, membership.organizationId) } }
  }, { public: true })

  route('POST', 'auth/register', ({ body }: Req) => {
    const db = getDb()
    const errors: Record<string, string[]> = {}
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!body?.name?.trim()) errors.name = ['Required']
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Invalid email']
    if (db.users.some((u) => u.email === email)) errors.email = ['An account with this email already exists']
    if (!strongPassword(body?.password)) errors.password = ['At least 8 characters with letters and numbers']
    if (!body?.organizationName?.trim()) errors.organizationName = ['Required']
    if (Object.keys(errors).length) throw new HttpError(422, 'validation_failed', 'Please fix the highlighted fields.', errors)

    const org = {
      id: uid('org'), name: body.organizationName.trim(), industry: body.industry ?? 'real_estate', timezone: body.timezone ?? 'Africa/Cairo',
      locale: body.locale ?? 'en', currency: body.currency ?? 'EGP', businessHours: { start: '09:00', end: '18:00', days: [0, 1, 2, 3, 4] },
      onboardingCompleted: false, planId: 'starter', webhookKey: uid('wk'), roundRobinCursor: 0, createdAt: nowIso(),
    }
    createOrganizationRows(db, org)
    const user = { id: uid('usr'), name: body.name.trim(), email, password: body.password, phone: null, locale: org.locale, emailVerified: false, createdAt: nowIso() }
    db.users.push(user)
    db.memberships.push({ id: uid('mem'), organizationId: org.id, userId: user.id, role: 'owner', status: 'active', specialties: [], lastActiveAt: nowIso(), joinedAt: nowIso() })
    db.preferences.push({ organizationId: org.id, userId: user.id, prefs: defaultPreferences() })
    const token = openSession(user.id, org.id)
    audit(makeCtx(db, org.id, user.id), 'organization.created', 'organization', org.id, {})
    return { data: { token, ...me(user.id, org.id) } }
  }, { public: true })

  route('GET', 'auth/me', ({ ctx }: Req) => ({ data: me(ctx.userId, ctx.orgId) }))

  route('POST', 'auth/logout', ({ token }: Req) => {
    const s = getDb().sessions.find((x) => x.token === token)
    if (s) s.revoked = true
    return { __status: 204 }
  })

  // Always 200 so the endpoint can't be used to discover accounts.
  // The mock returns the token so the flow can be tested without an inbox.
  route('POST', 'auth/forgot-password', ({ body }: Req) => {
    const db = getDb()
    const user = db.users.find((u) => u.email === String(body?.email ?? '').trim().toLowerCase())
    let debugResetToken: string | undefined
    if (user) {
      debugResetToken = uid('rst')
      db.passwordResets.push({ token: debugResetToken, userId: user.id, expiresAt: new Date(Date.now() + 36e5).toISOString(), usedAt: null })
    }
    return { __status: 200, message: 'If an account exists for this email, a reset link has been sent.', debugResetToken }
  }, { public: true })

  route('POST', 'auth/reset-password', ({ body }: Req) => {
    const db = getDb()
    const reset = db.passwordResets.find((r) => r.token === body?.token)
    if (!reset || reset.usedAt || new Date(reset.expiresAt) < new Date()) throw new HttpError(422, 'invalid_token', 'This reset link is invalid or has expired.')
    if (!strongPassword(body?.password)) throw new HttpError(422, 'validation_failed', 'Weak password.', { password: ['At least 8 characters with letters and numbers'] })
    const user = db.users.find((u) => u.id === reset.userId)!
    user.password = body.password
    reset.usedAt = nowIso()
    // a password reset signs the user out everywhere
    db.sessions.filter((s) => s.userId === user.id).forEach((s) => (s.revoked = true))
    return { __status: 200, message: 'Password updated. You can sign in now.' }
  }, { public: true })

  route('POST', 'auth/change-password', ({ ctx, body, token }: Req) => {
    const user = ctx.db.users.find((u) => u.id === ctx.userId)!
    if (user.password !== body?.currentPassword) throw new HttpError(422, 'validation_failed', 'Current password is incorrect.', { currentPassword: ['Incorrect password'] })
    if (!strongPassword(body?.password)) throw new HttpError(422, 'validation_failed', 'Weak password.', { password: ['At least 8 characters with letters and numbers'] })
    user.password = body.password
    ctx.db.sessions.filter((s) => s.userId === user.id && s.token !== token).forEach((s) => (s.revoked = true))
    audit(ctx, 'user.password_changed', 'user', user.id)
    return { __status: 200, message: 'Password changed. Other sessions were signed out.' }
  })

  route('GET', 'auth/sessions', ({ ctx, token }: Req) => ({
    data: ctx.db.sessions
      .filter((s) => s.userId === ctx.userId && !s.revoked)
      .map((s) => ({ id: s.id, userAgent: s.userAgent, ip: s.ip, current: s.token === token, lastSeenAt: s.lastSeenAt, createdAt: s.createdAt }))
      .reverse(),
  }))

  route('DELETE', 'auth/sessions/:id', ({ ctx, params }: Req) => {
    const s = ctx.db.sessions.find((x) => x.id === params.id && x.userId === ctx.userId)
    if (!s) throw new HttpError(404, 'not_found', 'Session not found.')
    s.revoked = true
    return { __status: 204 }
  })

  // Invitation acceptance (public: the invitee has no session yet)
  route('GET', 'invitations/token/:token', ({ params }: Req) => {
    const db = getDb()
    const inv = db.invitations.find((i) => i.token === params.token)
    if (!inv || inv.status !== 'pending' || new Date(inv.expiresAt) < new Date()) {
      throw new HttpError(410, 'invitation_invalid', 'This invitation is no longer valid. Ask your administrator for a new one.')
    }
    const org = db.organizations.find((o) => o.id === inv.organizationId)!
    return { __status: 200, data: { email: inv.email, role: inv.role, organization: { id: org.id, name: org.name }, expiresAt: inv.expiresAt } }
  }, { public: true })

  route('POST', 'invitations/token/:token/accept', ({ params, body }: Req) => {
    const db = getDb()
    const inv = db.invitations.find((i) => i.token === params.token)
    if (!inv || inv.status !== 'pending' || new Date(inv.expiresAt) < new Date()) {
      throw new HttpError(410, 'invitation_invalid', 'This invitation is no longer valid. Ask your administrator for a new one.')
    }
    let user = db.users.find((u) => u.email === inv.email)
    if (!user) {
      if (!body?.name?.trim()) throw new HttpError(422, 'validation_failed', 'Name is required.', { name: ['Required'] })
      if (!strongPassword(body?.password)) throw new HttpError(422, 'validation_failed', 'Weak password.', { password: ['At least 8 characters with letters and numbers'] })
      user = { id: uid('usr'), name: body.name.trim(), email: inv.email, password: body.password, phone: null, locale: 'en', emailVerified: true, createdAt: nowIso() }
      db.users.push(user)
    }
    if (!db.memberships.some((m) => m.organizationId === inv.organizationId && m.userId === user!.id)) {
      db.memberships.push({ id: uid('mem'), organizationId: inv.organizationId, userId: user.id, role: inv.role, status: 'active', specialties: [], lastActiveAt: nowIso(), joinedAt: nowIso() })
      db.preferences.push({ organizationId: inv.organizationId, userId: user.id, prefs: defaultPreferences() })
    }
    inv.status = 'accepted'
    const token = openSession(user.id, inv.organizationId)
    audit(makeCtx(db, inv.organizationId, user.id), 'invitation.accepted', 'invitation', inv.id, { email: inv.email })
    return { data: { token, ...me(user.id, inv.organizationId) } }
  }, { public: true })

  route('POST', '__mock/reset', () => {
    resetDb()
    return { __status: 200, message: 'Demo data restored.' }
  }, { public: true })
}
