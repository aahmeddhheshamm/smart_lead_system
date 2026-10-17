# Backend integration

The web app talks to the **LeadFlow backend** (Django + DRF, `/api/v1`). The contract is the backend's OpenAPI schema, snapshotted in [`contracts/leadflow-openapi.json`](../contracts/leadflow-openapi.json), plus the Postman collection *"LeadFlow API — Smart Lead Management & Follow-up (v1)"*.

## Run against the backend

```bash
cp .env.example .env
# .env
VITE_APP_API_URL=/api/v1/
VITE_DEV_PROXY_TARGET=https://<backend-host>          # e.g. the ngrok URL
VITE_PUBLIC_API_URL=https://<backend-host>/api/v1/    # shown to website developers
VITE_USE_MOCK=false
npm run dev
```

In development the browser calls `/api/...` on its own origin and the Vite dev server forwards it to `VITE_DEV_PROXY_TARGET` (see `vite.config.ts`). This avoids CORS preflights and **ngrok's browser warning page**, which otherwise answers browser requests with HTML instead of JSON. The backend's CORS config does not allow the `ngrok-skip-browser-warning` header, so the proxy is required for ngrok.

In production, set `VITE_APP_API_URL=https://api.<domain>/api/v1/` (no proxy). The API's CORS currently answers `Access-Control-Allow-Origin: *`, which works because the app sends no cookies (`credentials: 'omit'`). Restrict it to the app's origin before launch.

`VITE_USE_MOCK=true` switches back to the in-browser demo API (`src/mock`) with seeded data.

## How it's wired

```text
page / component
  └─ modules/<module>/api/index.ts      same function names in both modes
       ├─ VITE_USE_MOCK=true  → InterceptorHelper → src/mock (demo)
       └─ VITE_USE_MOCK=false → src/api/backend.ts → InterceptorHelper → /api/v1
```

- **`src/api/backend.ts`** is the only place that knows backend paths and field names. It maps responses into the domain types (`src/types/domain.ts`), so pages stay unchanged when the wire format changes.
- **`src/api/normalize.ts`** accepts `{data, pagination}` (documented), DRF `{results, count}` and bare arrays.
- **`InterceptorHelper`** adds `Authorization: Bearer <access>`, `X-Organization-ID`, `X-Request-Id`, `Accept-Language` and `Idempotency-Key`. It also handles token refresh.

### Auth & tenant

| Step | Call |
| --- | --- |
| Sign in / sign up | `POST auth/login` / `POST auth/register` → `data.tokens.{access,refresh}` stored in `localStorage` (`token`, `refreshToken`) |
| Session | `GET auth/me` + `GET organizations` + `GET organizations/current` (with `X-Organization-ID`) → user, organization, role, permissions |
| Active organization | Last one used on this device (`localStorage.orgId`), else the first membership. The user menu offers a switcher when there are several. |
| Expired access token | One `POST auth/refresh` (rotation, shared by concurrent requests), then the request is replayed once. If the refresh fails, the user is signed out. |
| Sign out | `POST auth/logout {refresh}` |
| Password reset | Email link → `/reset-password?uid=…&token=…` → `POST auth/password/reset/confirm` |
| Invitation | Email link → `/accept-invite?token=…` (or `/invite/:token`) → `GET invitations/lookup` → `POST invitations/accept`. Signed-in users accept with their current account. |
| Email verification | `/verify-email?token=…` → `POST auth/email/verify`; banner with `POST auth/email/resend` |

Permissions come from the membership's role (`role.permissions`). If the API doesn't return them, the frontend falls back to the default matrix in `src/config/permissions.ts` (the same keys the backend uses: `leads.view_all`, `leads.assign`, …).

### Feature → endpoint map

| Feature | Endpoints |
| --- | --- |
| Leads list / filters / export | `GET leads/`, `GET leads/export/` (see filter names below) |
| Lead create / edit | `POST leads/` (Idempotency-Key; `409` duplicate → "Create anyway" resends with `force:true`), `PATCH leads/{id}/`, tags resolved to `tagIds` (missing tags are created via `POST tags/`) |
| Owner / stage | `POST leads/{id}/assign/`, `POST leads/{id}/move-stage/ {stageId, lostReason}` |
| Do-not-contact | `POST leads/{id}/consent/ {doNotContact, source:'agent'}` |
| Bulk | `POST leads/bulk/` actions `assign`, `move_stage`, `add_tags`, `delete` |
| Timeline / notes / calls | `GET/POST leads/{id}/activities/` |
| AI | `GET leads/{id}/insights`, `POST leads/{id}/insights/request`, `POST insights/{id}/review {decision, apply}`. Insights arrive asynchronously (n8n); the panel polls while they are pending. |
| CSV import | `POST leads/imports/` (multipart file + `columnMapping`) → `GET leads/imports/{id}/rows/` → `POST leads/imports/{id}/commit/ {duplicateStrategy}`; closing the wizard cancels the preview |
| Pipeline | `GET pipeline/board`, stage CRUD + `POST pipeline/stages/reorder/` (the settings editor applies a diff) |
| Tasks | `GET tasks/?view=today\|overdue\|upcoming\|completed&assignee=`, `GET tasks/summary/`, `complete/`, `snooze/ {until}`, `cancel/` |
| Dashboard / reports | `GET dashboard/summary`, `GET reports/{sources,team,conversion,response-time,pipeline,lost-reasons}` |
| Automations | `GET automations/`, `PATCH automations/{id}/ {config}`, `enable/`, `disable/`, `run-now/`, `reset-config/`, `GET automation-runs/`, `retry/` |
| Integrations | `GET integrations`, `POST integrations/{provider}/connect\|disconnect\|test\|rotate-secret` (`email` ↔ `email_api`, `ad_leads` ↔ `meta_lead_ads`) |
| Team | `GET members/`, `PATCH members/{id}/ {roleId}`, `activate/`, `deactivate/`, `GET roles/`, invitations `POST invitations/ {email, roleId}`, `resend/`, `revoke/` |
| Settings | `PATCH organizations/current` (incl. `leadSettings`: dedupe rule and lost reasons), lead sources CRUD, `GET/PUT notifications/preferences` |
| Billing | `GET billing/subscription`, `GET billing/usage`, `GET billing/plans`, `POST billing/change-plan` |
| Audit | `GET audit-logs/` |

### Value mapping

| Concept | Frontend | Backend |
| --- | --- | --- |
| Lead name / message | `name`, `message` | `fullName`, `notes` |
| Stage type | `type` | `kind` |
| Task status | `cancelled` | `canceled` |
| Run status | `succeeded`, `queued` | `success`, `pending` |
| Rule types | `first_response_sla`, `stale_lead_follow_up` | `uncontacted_alert`, `stale_follow_up` |
| Member status | `active` / `inactive` | `isActive` / `deactivatedAt` |
| Notification prefs keys | `task_due` | `taskDue` |
| Duplicate import policy | `skip` / `merge` | `skip` / `update` |

## Verification status

`npm run test:contract` checks that **every endpoint and method the adapter calls exists in the OpenAPI schema** (94/94 at the time of writing). It does not check payloads.

Request bodies were written from the schema's request components and from the Postman collection. Responses fall into two groups:

**Documented in the OpenAPI (mapped exactly):** leads, lead detail, stages, sources, tags, custom fields, tasks, members, roles, invitations, automations, automation runs, notifications, imports, audit logs, plans.

**Not documented (mapped defensively, verify on first use):** `auth/me`, `organizations`, `organizations/current`, `invitations/lookup`, `leads/{id}/insights`, `pipeline/board`, `tasks/summary`, `integrations`, `dashboard/summary`, all `reports/*`, `billing/subscription`, `billing/usage`, `notifications/unread-count`, `notifications/preferences`, `leads/{id}/activities` (the schema documents it as a lead), `leads/bulk`, `leads/check-duplicates`.

In development, `expectShape()` logs a `[LeadFlow API] …` warning in the browser console the first time one of these responses doesn't contain the expected keys. Fix the matching mapper in `src/api/backend.ts`; pages need no changes.

**Lead filter parameter names** other than `page`, `page_size`, `search` and `ordering` aren't in the OpenAPI either. They follow the Postman collection (`status`, `priority`, `owner`, `overdue`) and are collected in `LEAD_FILTER_PARAMS` in `backend.ts`. If a filter has no effect, rename it there.

### Checklist for the first live session

1. Sign in → dashboard loads; user menu shows your name, organization and role.
2. Leads: list, search, a stage filter, create a lead, open it, log a call, move it to Lost (reason required), export CSV.
3. Lead page → **Analyse message** → insights appear after n8n processes them → **Confirm & apply**.
4. Pipeline drag-and-drop; Tasks (complete with follow-up, snooze).
5. Import a small CSV with one bad row.
6. Settings → Members (invite → link), Pipeline (rename + reorder), Lead rules.
7. Integrations → Website form → connect → copy the secret → **Send test**.
8. Check the console for `[LeadFlow API]` warnings and adjust mappers.

### Backend notes found while integrating

- The schema documents `GET leads/{id}/activities/`, `tasks/summary/` and other action endpoints as returning `LeadDetail` / `Task` (a drf-spectacular default). Annotating them with `@extend_schema(responses=…)` would let the frontend map them exactly.
- Function-based views (`auth/*`, `organizations*`, `dashboard`, `reports`, `integrations`, `billing`) have no response schema. Annotating them would remove most of the defensive mapping.
- CORS: add the production app origin instead of `*` once the domain is known.
- No onboarding flag on organizations: the frontend shows the setup wizard right after sign-up only.
- `organizations/current` has no currency field, so the currency selector is hidden in real mode.
