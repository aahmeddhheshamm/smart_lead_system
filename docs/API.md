# API Specification — `/api/v1`

The contract between the web app, n8n and the backend. TypeScript shapes live in [`src/types/domain.ts`](../src/types/domain.ts), and the mock implementation in [`src/mock/handlers`](../src/mock/handlers) follows this document exactly. Publish the final version as OpenAPI/Swagger from the backend.

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `https://api.<domain>/api/v1/` |
| Format | JSON, UTF-8, `camelCase` fields, ISO-8601 UTC timestamps (`2026-10-16T10:30:00Z`) |
| IDs | Opaque strings (UUID/ULID). Clients must not parse them. |
| Auth (browser) | HttpOnly, `Secure`, `SameSite=Lax` session cookie; send `credentials: include`. CSRF token for cookie-auth writes. |
| Auth (API clients / mock) | `Authorization: Bearer <token>` |
| Auth (n8n) | Per-environment service token on `/internal/*` only; each call still carries `organizationId` and is authorized against it |
| Tenant | Derived from the session, **never** from the request body or URL. Another tenant's id → `404`. |
| Language | `Accept-Language: en` or `ar` (error messages, generated text) |
| Tracing | Client sends `X-Request-Id`; the server echoes it and includes it in every error |
| Idempotency | `Idempotency-Key` header on create/import/task writes; the same key + same route returns the stored response for 24 h |
| Rate limits | Auth: 5 failed logins / 5 min / account + IP. Writes: 120/min/user. Webhooks: 60/min/key. `429` with `Retry-After`. |
| Body limit | 1 MB JSON (2 MB for import batches); larger → `413` |

### Lists

```http
GET /leads?page=1&pageSize=20&search=ahmed&stageId=stg_1,stg_2&sort=createdAt&order=desc
```

- `page` (1-based), `pageSize` (1–100, default 20)
- `search`: free text (endpoint-specific fields)
- Filters are plain top-level params; multiple values are comma-separated
- `sort` + `order` (`asc` | `desc`)

```json
{
  "data": [ { "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 }
}
```

### Single resource

```json
{ "data": { "...": "..." }, "message": "Optional human message" }
```

### Errors

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Please fix the highlighted fields.",
    "details": { "email": ["Invalid email address"] },
    "requestId": "8f9c…"
  }
}
```

`details` is either a field map (forms) or an array of `{ row?, field?, message }` (imports, bulk). Responses never contain stack traces or secrets.

| Status | Code examples | Meaning |
| --- | --- | --- |
| 400 | `bad_request` | Malformed request |
| 401 | `unauthenticated`, `invalid_credentials`, `invalid_signature` | No or invalid session / signature |
| 402 | `plan_limit` | Plan limit reached |
| 403 | `forbidden`, `self_modification`, `account_inactive` | Authenticated but not allowed |
| 404 | `not_found` | Doesn't exist **or belongs to another tenant** |
| 409 | `duplicate_lead`, `already_closed`, `not_retryable` | State conflict |
| 410 | `invitation_invalid` | Expired / used / revoked invitation |
| 413 | `payload_too_large` | Body too large |
| 422 | `validation_failed`, `lost_reason_required`, `invalid_owner`, `stage_in_use`, `last_owner` | Business rule failed |
| 429 | `too_many_attempts` | Rate limited |
| 5xx | `internal_error` | Server error; safe to retry idempotent calls |

## 2. Authentication & session

| Method | Endpoint | Body → Response | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{email, password}` → `{data: {token?, user, organization, membership}}` | Sets the session cookie. Throttled. |
| POST | `/auth/register` | `{name, email, password, organizationName, industry, timezone, locale}` → session | Creates the org; the caller becomes `owner`; `onboardingCompleted=false` |
| POST | `/auth/logout` | — → `204` | Revokes the session server-side |
| GET | `/auth/me` | → `{data: MeResponse}` | `membership.permissions` drives the UI |
| POST | `/auth/forgot-password` | `{email}` → `200` always | Doesn't reveal whether the account exists. Link valid 1 h. |
| POST | `/auth/reset-password` | `{token, password}` | Single use; revokes all sessions |
| POST | `/auth/change-password` | `{currentPassword, password}` | Revokes other sessions |
| GET | `/auth/sessions` | → `{data: Session[]}` | |
| DELETE | `/auth/sessions/:id` | → `204` | |
| GET | `/invitations/token/:token` | → `{data: {email, role, organization, expiresAt}}` | Public. `410` if invalid. |
| POST | `/invitations/token/:token/accept` | `{name?, password?}` → session | Public. Single use. |

Password policy: ≥ 8 characters with letters and numbers (stronger rules optional).

`MeResponse`:

```json
{
  "user": { "id": "usr_1", "name": "Hesham Adel", "email": "owner@…", "emailVerified": true },
  "organization": { "id": "org_1", "name": "Nile Properties", "industry": "real_estate", "timezone": "Africa/Cairo",
    "locale": "en", "currency": "EGP", "businessHours": { "start": "09:00", "end": "18:00", "days": [0,1,2,3,4] },
    "onboardingCompleted": true, "planId": "starter", "createdAt": "…" },
  "membership": { "id": "mem_1", "role": "owner", "status": "active", "permissions": ["leads.view_all", "…"] }
}
```

## 3. Organization, members, roles

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/organizations/current` | any member | |
| PATCH | `/organizations/current` | `settings.manage` | `name, industry, timezone, locale, currency, businessHours` |
| POST | `/organizations/current/complete-onboarding` | `settings.manage` | |
| GET | `/members?status=active&role=&search=` | any (active only) / `members.view` (all) | Pickers use `status=active` |
| PATCH | `/members/:id` | `members.manage` | `{role?, status?, specialties?}`. Can't change self; keeps ≥1 active owner; only an owner grants `owner`; deactivation revokes that user's sessions |
| GET | `/invitations` | `members.view` | |
| POST | `/invitations` | `members.manage` | `{email, role}`; 7-day expiry; replaces older pending invites to the same email; seat limit → `402` |
| DELETE | `/invitations/:id` | `members.manage` | Revoke |
| GET | `/roles` | any | `[{key, permissions[], members}]` |

## 4. Leads

`Lead` (response shape):

```json
{
  "id": "lead_123",
  "name": "Example Customer",
  "email": "customer@example.com",
  "phone": "+201001234567",
  "company": null,
  "source": { "id": "src_1", "name": "Website", "type": "website", "active": true },
  "campaign": "Summer Launch",
  "stage": { "id": "stg_1", "name": "New", "type": "open", "color": "#64748B" },
  "owner": { "id": "user_456", "name": "Sales Agent" },
  "priority": "high",
  "tags": ["investor"],
  "message": "محتاج شقة في الشيخ زايد في حدود 5 مليون",
  "customFields": { "budget": 5000000, "area": "Sheikh Zayed" },
  "lastContactedAt": null,
  "nextFollowUpAt": "2026-10-16T10:45:00Z",
  "doNotContact": false,
  "lostReason": null,
  "wonAt": null,
  "lostAt": null,
  "needsReview": false,
  "ai": {
    "status": "suggested", "classification": "Real Estate Inquiry", "summary": "…", "priority": "high",
    "priorityReason": "Customer signalled urgency.", "suggestedReply": "…", "nextBestAction": "…",
    "confidence": 0.8, "extracted": { "area": "Sheikh Zayed", "budget": 5000000, "currency": "EGP" },
    "model": "…", "generatedAt": "…", "reviewedBy": null
  },
  "createdAt": "2026-10-16T10:30:00Z",
  "updatedAt": "2026-10-16T10:30:00Z"
}
```

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/leads` | `leads.view_all` or `leads.view_own` | Filters: `search` (name/email/company/phone digits), `stageId`, `sourceId`, `ownerId` (`unassigned` allowed), `priority`, `tag`, `campaign`, `createdFrom`, `createdTo`, `uncontacted=1`, `needsReview=1`. `view_own` ⇒ only `owner = me`. |
| GET | `/leads/export?format=csv&…filters` | `leads.export` | `text/csv`; same filters and visibility; audit-logged |
| POST | `/leads` | `leads.create` | Runs Workflow A synchronously. `201` created, `200` merged into a duplicate, `409` if the policy is `reject`. Without `leads.assign`, the owner is forced to the caller. Use `Idempotency-Key`. |
| POST | `/leads/check-duplicates` | `leads.create` or `leads.update` | `{email?, phone?, excludeId?}` → matches; leads outside the caller's scope are reported without details |
| POST | `/leads/bulk` | per action | `{ids (≤500), action: assign\|stage\|add_tags\|delete, ownerId?, stageId?, lostReason?, tags?}` → `{data: {updated, failed[]}}`. Each id is authorized individually. |
| GET | `/leads/:id` | view | |
| PATCH | `/leads/:id` | `leads.update` (`leads.assign` for `ownerId`) | Partial update. Changing `stageId` follows the move rules. Logged. |
| DELETE | `/leads/:id` | `leads.delete` | Soft delete; purged after the retention period |
| POST | `/leads/:id/move` | `leads.update` | `{stageId, lostReason?}`. Lost requires a reason (`422 lost_reason_required`). Won/Lost cancels automated follow-ups. Entering a stage with `autoTask` creates the task. |
| POST | `/leads/:id/do-not-contact` | `leads.update` | `{value, reason?}`. `true` cancels automated follow-ups and blocks marketing messages. Audit-logged. |
| GET | `/leads/:id/activities` | view | Newest first |
| POST | `/leads/:id/activities` | `leads.update` | `{type: note\|call\|email\|meeting\|whatsapp, note?, outcome?}`. Non-note types update `lastContactedAt`. Blocked when DNC, except calls. |
| GET | `/leads/:id/tasks` | view | |
| POST | `/leads/:id/tasks` | `tasks.manage` | Same body as `POST /tasks` |
| POST | `/leads/:id/ai/classify` | `leads.update` | Runs Workflow D now; `422` without a message or when disabled |
| PATCH | `/leads/:id/ai` | `leads.update` | `{status: confirmed\|rejected, apply?, applyPriority?, corrections?}`. `apply` copies extracted values into `customFields`. |
| GET | `/leads/:id/automation-runs` | view | |
| GET | `/tags` | view | Distinct tags in the caller's scope |

### CSV import

The browser parses the file (RFC 4180, header row) and sends rows with a column mapping. Large files can later move to `multipart/form-data` + async processing with the same responses.

| Method | Endpoint | Body → Response |
| --- | --- | --- |
| POST | `/leads/imports/preview` | `{rows: object[] (≤5000), mapping: {column: field}}` → `{data: {totals: {rows, valid, duplicate, invalid}, rows: ImportPreviewRow[] (first 200)}}`. Writes nothing. |
| POST | `/leads/imports` | `{rows, mapping, duplicatePolicy: skip\|merge, fileName, ownerId?}` + `Idempotency-Key` → `{data: ImportJob}` |
| GET | `/leads/imports/:id` | → `{data: ImportJob}` |

Mappable fields: `name, email, phone, company, source, campaign, priority, tags` (`|` or `;` separated), `message`. Rows are processed individually. Failed rows are reported as `failed[{row, message}]`, and good rows are still imported. Row numbers are 1-based and include the header.

## 5. Pipeline

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/pipeline/board?search=&ownerId=` | view | `{data: {stages: [{…stage, total, leads (≤50, most recently updated)}]}}` |
| GET | `/pipeline-stages` | any | Ordered |
| PUT | `/pipeline-stages` | `pipeline.manage` | Replaces the ordered list: `{stages: [{id?, name, type: open\|won\|lost, color, autoTask?: {enabled, title, type, dueInHours}}]}`. Rules: ≥1 open, exactly 1 won and 1 lost, ≤12; a removed stage must have no leads (`422 stage_in_use`). |
| GET | `/lead-sources` | any | Includes `leads` count |
| POST | `/lead-sources` | `settings.manage` | `{name, type}`; unique name per org |
| PATCH | `/lead-sources/:id` | `settings.manage` | `{name?, type?, active?}` |
| DELETE | `/lead-sources/:id` | `settings.manage` | Deactivates instead if leads reference it |

## 6. Tasks

`Task`: `{id, title, type, status: open|completed|cancelled, priority, dueAt, lead: {id,name}|null, assignee, outcome, notes, automated, completedAt, createdAt}`

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/tasks?view=today\|overdue\|upcoming\|completed\|range&from=&to=&assigneeId=&type=` | `tasks.manage` | Agents get their own tasks; `tasks.view_all` sees everyone's. Response adds `counts: {today, overdue, upcoming}`. "Today" = still ahead today; already past = overdue. |
| POST | `/tasks` | `tasks.manage` | `{title, type, priority, dueAt, leadId?, assigneeId?, notes?}`. Assignee must be an active member; agents always assign to themselves. |
| PATCH | `/tasks/:id` | `tasks.manage` | Open tasks only; `assigneeId` requires `tasks.view_all` |
| POST | `/tasks/:id/complete` | `tasks.manage` | `{outcome?, notes?, followUp?: {title, dueAt, type?}}`. Contact-type tasks update the lead's `lastContactedAt`; recomputes `nextFollowUpAt`. `409` if already closed. |
| POST | `/tasks/:id/postpone` | `tasks.manage` | `{dueAt}` (future) |
| POST | `/tasks/:id/cancel` | `tasks.manage` | |

## 7. Dashboard & reports

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard/summary?from=&to=&ownerId=` | any | `DashboardSummary`; scoped to what the caller may see. Defaults to the last 30 days. |
| GET | `/reports?from=&to=&ownerId=&sourceId=` | `reports.view` | `ReportsResponse`, including `definitions` |

Metric definitions (returned by the API so every client uses the same wording):

| Metric | Definition |
| --- | --- |
| New leads | Leads created in the period |
| Not contacted | Open leads with no contact activity logged (all time) |
| Qualified | Leads that entered Qualified or a later stage during the period |
| Won / Lost | Leads moved to Won / Lost during the period, regardless of creation date |
| Conversion rate | **Cohort:** of leads created in the period, the share now Won |
| First response | Creation → first logged call/email/meeting/WhatsApp |

All date ranges are interpreted in the **organization's time zone**.

## 8. Automations & runs

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/automations` | `automations.view` | `AutomationRule[]` with `lastRunAt`, `lastRunStatus`, `runsLast7d`, `failuresLast7d` |
| PATCH | `/automations/:id` | `automations.manage` | `{enabled?, config?}`. Config validated per type (below). The `workflowId` is fixed server-side and never accepted from clients. |
| GET | `/automation-runs?status=&type=&leadId=&search=` | `automations.view` | Paginated |
| GET | `/automation-runs/:id` | `automations.view` | |
| POST | `/automation-runs/:id/retry` | `automations.manage` | Failed runs only (`409` otherwise). Re-executes failed steps only; never repeats a succeeded side effect. |

Config per type:

| Type | Config |
| --- | --- |
| `lead_ingestion` | `dedupePolicy: merge\|flag\|reject`, `matchOn: ("email"\|"phone")[]` |
| `lead_assignment` | `strategy: round_robin\|specialty\|manual`, `fallback: managers` |
| `first_response_sla` | `minutes: 5–1440`, `businessHoursOnly: boolean` |
| `stale_lead_follow_up` | `businessDays: 1–30` |
| `stop_on_close` | — |
| `ai_classification` | `minConfidence: 0.3–0.95` |
| `daily_report` | `hour: 0–23`, `channels: ["email"]` |

## 9. Integrations & webhooks

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/integrations` | `integrations.view` | `config` contains no secrets (only `secretPreview`) |
| POST | `/integrations/:provider/connect` | `integrations.manage` | `website_form`: `{allowedOrigins[]}` → response includes `secret` **once**; reconnect rotates it. `email`: `{fromAddress, provider}`. |
| POST | `/integrations/:provider/disconnect` | `integrations.manage` | |
| POST | `/integrations/:provider/test` | `integrations.manage` | `website_form` sends a sample lead through the real ingestion path |

### Inbound lead webhook (website forms)

```http
POST /webhooks/leads/:webhookKey
Content-Type: application/json
X-Event-Id: 6f1d…            # unique per submission (required)
X-Signature: sha256=<hex>     # HMAC-SHA256(rawBody, signingSecret)
X-Timestamp: 1760610600       # reject if older than 5 minutes

{ "name": "Ahmed Hassan", "phone": "+201001234567", "email": "a@example.com",
  "message": "…", "campaign": "Summer Launch", "utm": { "source": "facebook" } }
```

- Unknown key, bad signature or stale timestamp → `401 invalid_signature` (same response for each, so callers can't tell which part failed).
- Same `X-Event-Id` again → `200 {data: {duplicateEvent: true}}` with no new side effects.
- Valid → `202 {data: {leadId, created}}`; processing continues asynchronously.
- Origin allow-list (CORS) for browser submissions; body ≤ 64 KB; 60 req/min per key.

> The mock compares `X-Signature` to the raw secret for simplicity. The backend must verify the HMAC with a constant-time comparison.

### Internal endpoints for n8n (service token, not exposed to browsers)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/internal/events?status=pending&limit=` | Outbox events to process (`lead.created`, `lead.stage_changed`, …) |
| POST | `/internal/events/:id/ack` | Mark processed (idempotent) |
| POST | `/internal/leads/:id/assign` | Run assignment with lock: `{strategy}` → owner + reason |
| GET | `/internal/follow-ups/due?organizationId=` | Leads/tasks due for SLA alerts, stale follow-ups and reminders |
| POST | `/internal/leads/:id/ai-result` | Store a validated AI result as a suggestion |
| GET | `/internal/reports/daily?organizationId=&date=` | Aggregated data for Workflow E |
| POST | `/internal/notifications` | Create notification(s) with `dedupeKey` |
| POST | `/internal/automation-runs` | Record a run `{ruleId, eventId, status, steps[], error}` |

Every internal call includes `organizationId`. The backend re-checks that the referenced records belong to it.

## 10. Notifications, billing, audit

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/notifications?unread=1&type=` | self | Adds `unread` count |
| POST | `/notifications/:id/read` | self | `204` |
| POST | `/notifications/read-all` | self | `204` |
| GET / PUT | `/notification-preferences` | self | `{[type]: {inApp, email}}` |
| GET | `/billing/subscription` | `billing.manage` or `settings.manage` | Plan, status, period end, usage vs limits |
| GET | `/audit-logs?action=&actorId=` | `audit.view` | Paginated; `action` is a prefix match (`member.`, `leads.`) |

## 11. Endpoint checklist (backend definition of done)

For every endpoint: request/response schema, validation rules, permission, tenant scoping, error codes, idempotency (writes), rate limit class, audit/activity side effects, and an API test (happy path + forbidden + other-tenant + invalid input).
