# LeadFlow AI — Smart Lead Management & Follow-up System

Multi-tenant SaaS web app that collects leads from every source in one place, assigns them to the right salesperson, keeps every lead on a clear next step, and shows managers what actually converts.

This repository is the **web frontend** (Vue 3 + Vite + TypeScript). It is integrated with the **LeadFlow backend** (Django + DRF, `/api/v1`, JWT + `X-Organization-ID`). See [docs/INTEGRATION.md](docs/INTEGRATION.md). An **in-browser mock API** with demo data is still available for demos and offline work (`VITE_USE_MOCK=true`).

## Quick start

```bash
npm install
cp .env.example .env      # set VITE_DEV_PROXY_TARGET to the backend URL (e.g. the ngrok URL)
npm run dev               # http://localhost:5173 — /api is proxied to the backend
```

Create a workspace on `/register`, or sign in with an existing backend account.

**Demo mode** (`VITE_USE_MOCK=true`): sign in with a demo account. Every demo account uses the password `Password123!`.

| Email | Role |
| --- | --- |
| `owner@nileproperties.test` | Owner (everything) |
| `admin@nileproperties.test` | Admin |
| `manager@nileproperties.test` | Sales manager |
| `sara@nileproperties.test` | Sales agent (sees only her leads) |
| `analyst@nileproperties.test` | Analyst (read-only) |
| `owner@smileclinic.test` | Owner of a *second* organization (tenant isolation) |

The mock stores its data in `localStorage` (`leadflow.mock.db.v2`). To restore the demo data, clear site data or `POST __mock/reset`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run build:check` | Type-check (`vue-tsc`), then build |
| `npm run preview` | Serve the production build locally |
| `npm run test:mock` | Business-rule smoke test against the mock API (tenant isolation, dedupe, idempotency, assignment, stop-on-close, import, webhooks, permissions) |
| `npm run test:contract` | Checks every endpoint the backend adapter calls exists in the backend OpenAPI snapshot (`contracts/leadflow-openapi.json`) |
| `API_SCHEMA_URL=https://<api>/api/schema/?format=json npm run contract:update` | Refreshes the OpenAPI snapshot |

## Configuration

| Variable | Description |
| --- | --- |
| `VITE_APP_API_URL` | API base including `/api/v1/` and a trailing slash (`/api/v1/` with the dev proxy) |
| `VITE_DEV_PROXY_TARGET` | Dev only: backend origin the Vite server proxies `/api` to (required for ngrok) |
| `VITE_PUBLIC_API_URL` | Absolute API URL shown to website developers (webhook ingest URL) |
| `VITE_USE_MOCK` | `true` = in-browser mock API. **Must be `false` for staging/production.** |

## Project structure

```text
src/
├── config/permissions.ts      # permission keys + default role matrix (mirrors the backend)
├── constants/                 # option keys (priorities, task types, lost reasons…), status colors
├── types/domain.ts            # API contracts shared by all modules
├── InterceptorHelper.ts       # fetch wrapper: JWT + refresh, X-Organization-ID, idempotency, errors, mock switch
├── api/                       # backend adapter (endpoints + response mapping) and envelope helpers
├── router/                    # guard: session → onboarding → permission
├── store/                     # auth (user, organization, membership), theme
├── composables/               # useFetch/useMutate (TanStack Query), lookups, authorization, locale
├── components/                # shared UI kit: table, forms, modals, charts, stat cards
├── layouts/                   # auth + dashboard shell (sidebar, navbar, notifications bell)
├── locales/                   # en.json, ar.json (RTL)
├── mock/                      # mock API: db seed, business rules (n8n workflows A–E), handlers
└── modules/                   # one folder per product module
    ├── auth/                  # login, register (creates org), reset password, accept invite
    ├── onboarding/            # 4-step organization setup
    ├── dashboard/             # KPIs, needs-attention, sources, team, activity
    ├── leads/                 # table, filters, bulk actions, CSV import, details, AI insights
    ├── pipeline/              # Kanban board
    ├── tasks/                 # today / overdue / upcoming, week agenda
    ├── automations/           # automation templates + execution logs
    ├── integrations/          # website webhook, email, CSV, upcoming providers
    ├── reports/               # funnel, sources, campaigns, team, lost reasons, response time
    ├── notifications/         # notification center
    ├── settings/              # general, members, roles, pipeline, sources, notifications, billing, audit
    └── profile/               # password, active sessions
```

Each module follows the same layout: `*.routes.ts`, `api/index.ts`, `components/`, `composables/`, page components.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Product scope, modules, acceptance criteria, release plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, frontend architecture, data flow, mock API |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | **Backend integration**: setup, auth & tenant flow, endpoint map, verification status |
| [docs/API.md](docs/API.md) | Original API design (the backend OpenAPI in `contracts/` is now authoritative) |
| [docs/DATABASE.md](docs/DATABASE.md) | PostgreSQL schema (DDL), indexes, rules |
| [docs/SECURITY.md](docs/SECURITY.md) | Roles & permissions, tenant isolation, n8n security, privacy |
| [docs/N8N_WORKFLOWS.md](docs/N8N_WORKFLOWS.md) | Workflows A–E, step by step, retry & idempotency rules |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy, mandatory acceptance scenarios, release gate |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environments, env vars, CI/CD, backups, monitoring, rollback |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | How each role uses the product |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Handover checklist, support agreement, proposal template |
