# Deployment & DevOps

## Environments

| Environment | Purpose | Web build | Data |
| --- | --- | --- | --- |
| Local development | Each developer while building | `npm run dev`, `VITE_USE_MOCK=true` or a local API | Mock seed / local Postgres |
| Staging | Tests and customer review before release | `VITE_USE_MOCK=false`, staging API | Anonymized or test data only |
| Production | What customers use | `VITE_USE_MOCK=false`, production API | Real data |

## Operating requirements

- Secure hosting for the frontend, backend and database.
- n8n in a production-grade environment with **persistent storage** (Postgres as the n8n DB, queue mode with Redis when scaling).
- HTTPS and DNS (`app.`, `api.`, `hooks.` or a path under `api.`).
- Environment variables and secrets management.
- Database migrations run on deploy (Prisma/Drizzle migrate), never by hand.
- Scheduled backups, **with restores verified**.
- Monitoring for errors, response time and resource usage.
- Monitoring of the queue/outbox and of failed or late tasks.
- Health checks for every service (`/healthz` liveness, `/readyz` DB + queue).
- CI/CD to run tests and deploy releases.
- A documented rollback procedure for failed releases.

## Environment variables

Illustrative names. Set them per provider, and **never** commit real values or send them over insecure chats.

```bash
# Web (this repo, build-time)
VITE_APP_API_URL=https://api.example.com/api/v1/
VITE_PUBLIC_API_URL=https://api.example.com/api/v1/
VITE_USE_MOCK=false
# dev only: VITE_DEV_PROXY_TARGET=https://<backend> (Vite proxies /api, needed for ngrok)

# Backend
DATABASE_URL=
AUTH_SECRET=                 # session signing
APP_BASE_URL=                # e.g. https://app.example.com (links in emails)
CORS_ORIGINS=https://app.example.com
CREDENTIALS_KMS_KEY_ID=      # envelope encryption of integration secrets
N8N_SERVICE_TOKEN=           # what n8n presents on /internal/*

# n8n
N8N_ENCRYPTION_KEY=          # stable forever; losing it makes stored credentials unreadable
N8N_HOST=
N8N_WEBHOOK_BASE_URL=
DB_TYPE=postgresdb
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336  # hours (14 days)

# Integrations
EMAIL_PROVIDER_API_KEY=
AI_PROVIDER_API_KEY=
```

In production, encryption keys must be stable and stored securely, with a plan for rotation and recovery.

## Web app hosting

The web app is a static SPA (`npm run build` → `dist/`). Serve it from any static host/CDN:

- Rewrite every unknown path to `/index.html` (history-mode routing).
- Long cache (`immutable`, 1 year) for `/assets/*`; `no-cache` for `index.html`.
- Security headers: `Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.example.com https://api.iconify.design; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`.

> Icons are fetched from the Iconify API at runtime. For a strict CSP or offline installs, bundle the icon set (`@iconify-json/lucide` + offline mode) instead.

Example `nginx` location:

```nginx
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location / { try_files $uri /index.html; add_header Cache-Control "no-cache"; }
```

Example container:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_APP_API_URL
ENV VITE_APP_API_URL=$VITE_APP_API_URL VITE_USE_MOCK=false
RUN npm run build:check

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY infrastructure/nginx.conf /etc/nginx/conf.d/default.conf
```

## CI/CD (suggested pipeline)

1. **On pull request:** `npm ci` → `npm run build:check` → `npm run test:mock` → backend unit/API tests → preview deploy.
2. **On merge to main:** build images → run migrations on staging → deploy staging → Playwright E2E → import n8n workflows into staging n8n.
3. **Release:** manual approval → migrations (backwards compatible, expand/contract) → deploy production → smoke checks → watch error rate for 30 min.

A build with `VITE_USE_MOCK=true` must fail the production pipeline (add a guard step that greps the env).

## Backups & restore

- PostgreSQL: point-in-time recovery (WAL) + daily snapshots, 30-day retention, encrypted, in a different region/account.
- n8n: its database + the `N8N_ENCRYPTION_KEY` (stored separately in the secret manager).
- **Restore drill** at least quarterly, timed, documented (RPO ≤ 15 min, RTO ≤ 4 h as starting targets).

## Monitoring & alerting

| Signal | Alert when |
| --- | --- |
| API 5xx rate | > 1% for 5 min |
| API p95 latency | > 1 s for 10 min |
| Outbox pending age | oldest > 10 min |
| Automation failures | > 5% of runs in 15 min, or any run failed 3 attempts |
| Webhook 401 spike | possible attack or rotated secret |
| DB CPU / storage | > 80% |
| Certificate expiry | < 14 days |

Use structured JSON logs with `requestId`, `organizationId` and `userId` (no PII in log messages).

## Rollback

1. Re-deploy the previous image/tag (web and API are versioned together).
2. Migrations are backwards compatible (expand → migrate → contract), so the previous API runs on the new schema; destructive "contract" steps only ship one release later.
3. n8n: re-import the previous workflow JSON from Git.
4. Record the incident and the cause.

## Operations & support agreement

Before handover, agree with the customer on:

- the support period after launch;
- response time for incidents;
- who is responsible for hosting and renewing services;
- usage limits and external costs;
- the backup and restore policy;
- who is responsible for security updates;
- the process for requesting new features;
- the policy for exporting the customer's data when the contract ends.

Don't promise uptime or an SLA unless you have the operations, monitoring and support to meet it.
