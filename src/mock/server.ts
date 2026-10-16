// Local mock of the LeadFlow REST API (docs/API.md). Enabled with VITE_USE_MOCK=true.
// It is loaded lazily by InterceptorHelper, so it is never bundled into a production build
// that talks to the real backend.

import { getDb, persist } from './db'
import { HttpError, makeCtx, runScheduledChecks, type Ctx } from './rules'
import { registerAuth } from './handlers/auth'
import { registerLeads } from './handlers/leads'
import { registerWork } from './handlers/work'
import { registerAutomation } from './handlers/automation'
import { registerInsights } from './handlers/insights'
import { registerOrg } from './handlers/org'

export interface Req {
  method: string
  path: string
  params: Record<string, string>
  query: Record<string, string>
  body: any
  headers: Record<string, string>
  ctx: Ctx
  token: string | null
}

type Handler = (req: Req) => any | Promise<any>
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler; public: boolean }

const routes: Route[] = []

export function route(method: string, path: string, handler: Handler, opts: { public?: boolean } = {}) {
  const keys: string[] = []
  const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`)
  routes.push({ method, pattern, keys, handler, public: !!opts.public })
}

// Raw (non-JSON) responses such as CSV exports
export class RawResponse {
  constructor(public body: string, public contentType: string, public status = 200) {}
}

registerAuth()
registerLeads()
registerWork()
registerAutomation()
registerInsights()
registerOrg()

const json = (status: number, body: any) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 220))

export async function mockFetch(url: string, init: RequestInit): Promise<Response> {
  await latency()
  const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
  const requestId = headers['x-request-id'] ?? 'mock'
  const parsed = new URL(url, window.location.origin)
  const base = new URL((import.meta as any).env?.VITE_APP_API_URL || 'http://localhost:3000/api/v1/', window.location.origin)
  const path = parsed.pathname.replace(base.pathname, '').replace(/^\/+|\/+$/g, '')
  const method = (init.method ?? 'GET').toUpperCase()
  const query = Object.fromEntries(parsed.searchParams.entries())

  let body: any = undefined
  if (init.body instanceof FormData) body = init.body
  else if (typeof init.body === 'string' && init.body) {
    try { body = JSON.parse(init.body) } catch { body = init.body }
  }
  if (method !== 'GET' && body === undefined) body = {}
  // Request size limit (PRD §4 execution rules)
  if (typeof init.body === 'string' && init.body.length > 2_000_000) {
    return json(413, { error: { code: 'payload_too_large', message: 'Request body is too large.', requestId } })
  }

  const db = getDb()
  const token = headers.authorization?.replace(/^Bearer\s+/i, '') ?? null

  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.pattern)
    if (!m) continue
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))

    try {
      let ctx: Ctx = null as any
      if (!r.public) {
        const session = token && db.sessions.find((s) => s.token === token && !s.revoked)
        if (!session) throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please sign in again.')
        const membership = db.memberships.find((x) => x.organizationId === session.organizationId && x.userId === session.userId)
        if (!membership || membership.status !== 'active') throw new HttpError(401, 'unauthenticated', 'Your account is not active in this organization.')
        session.lastSeenAt = new Date().toISOString()
        membership.lastActiveAt = session.lastSeenAt
        ctx = makeCtx(db, session.organizationId, session.userId)
        // background jobs must never break the user's request (the real system runs them in n8n/a worker)
        try {
          runScheduledChecks(db)
        } catch (e) {
          console.error('[mock scheduler]', e)
        }
      }

      // Idempotency-Key: replay the stored response for a repeated write
      const idemKey = headers['idempotency-key']
      const idemStoreKey = idemKey && ctx ? `idem:${ctx.orgId}:${method}:${path}:${idemKey}` : null
      if (idemStoreKey) {
        const prior = db.processedEvents.find((e) => e.key === idemStoreKey)
        if (prior) return json(prior.status, prior.response)
      }

      const result = await r.handler({ method, path, params, query, body, headers, ctx, token })
      persist()

      if (result instanceof RawResponse) {
        return new Response(result.body, { status: result.status, headers: { 'Content-Type': result.contentType } })
      }
      const status = result?.__status ?? (method === 'POST' ? 201 : 200)
      if (result && '__status' in result) delete result.__status
      if (idemStoreKey) db.processedEvents.push({ organizationId: ctx.orgId, key: idemStoreKey, status, response: result ?? {}, createdAt: new Date().toISOString() })
      persist()
      return json(status, result ?? {})
    } catch (e: any) {
      persist()
      if (e instanceof HttpError) {
        return json(e.status, { error: { code: e.code, message: e.message, details: e.details, requestId } })
      }
      console.error('[mock api]', method, path, e)
      return json(500, { error: { code: 'internal_error', message: 'Something went wrong on our side.', requestId } })
    }
  }

  return json(404, { error: { code: 'not_found', message: `No route for ${method} /${path}`, requestId } })
}
