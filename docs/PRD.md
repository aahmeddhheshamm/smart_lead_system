# Product Requirements — LeadFlow AI

**Working name:** LeadFlow AI (may change before launch) · **Type:** multi-tenant B2B SaaS · **Status:** MVP frontend complete against the API contract; backend and n8n in progress.

## 1. Problem

Companies that live on inbound leads (real-estate developers and brokers, clinics, agencies and service companies) collect them from the website, ads, forms, calls and WhatsApp. Leads end up spread across Excel sheets, inboxes and phones. As a result:

- salespeople reply late or forget to follow up;
- managers can't see team performance or which sources produce real sales;
- duplicate and incomplete records waste time;
- nobody can measure acquisition cost or why deals are lost.

## 2. Value proposition

LeadFlow does **not** promise a specific sales uplift. It reduces lost leads, speeds up the first response, standardizes follow-up and gives managers reliable data for decisions.

The core loop: **Capture → Validate → Qualify (AI) → Assign → Follow up → Measure.**

## 3. Target customers

| Segment | Typical need |
|---|---|
| Real estate | Unit inquiries, budgets, areas, viewing appointments, distributing leads to agents |
| Clinics / medical centers | Booking requests and inquiries, reminders for unconfirmed appointments; health-data privacy |
| Agencies & service companies | Leads from many campaigns, quote follow-up, per-source/campaign reporting |

**Launch decision:** the product is built to work for any lead-driven business, but the first commercial launch targets **one vertical (real estate)**. Templates, custom fields and copy are tuned for it; the other verticals are enabled through configuration (industry setting → custom fields).

## 4. Personas & roles

| Role | Goal in the product |
|---|---|
| Organization Owner | Sets up the company, members, integrations and subscription |
| Organization Admin | Manages users, settings and all leads |
| Sales Manager | Sees all leads, distributes them, watches team performance and reports |
| Sales Agent | Works the leads and tasks assigned to them |
| Analyst | Reads reports and permitted data; no commercial edits |
| Platform Admin | Operates the platform and supports customers (logged access) |

The full permission matrix is in [SECURITY.md](SECURITY.md#roles-and-permissions).

## 5. Modules and acceptance criteria

Status legend: ✅ implemented in the frontend + mock API · 🔜 contract defined, ships in a later version.

### 5.1 Authentication & organizations ✅

- Sign in / sign out, password reset by emailed link, organization sign-up (creator becomes Owner).
- Invite members by email with a role; invitation links expire after 7 days and are single-use.
- Activate / deactivate members (deactivation ends their sessions immediately).
- Organization time zone, language, currency, business hours; personal notification preferences.
- Session list with remote sign-out; changing the password signs out other sessions.

**Acceptance**

- A user can't reach another organization's data by changing an id in the URL or API; it returns `404`.
- An expired or revoked invitation can't be used.
- A user can't change their own role or status, and only an Owner can grant the Owner role.
- An organization always keeps at least one active Owner.

### 5.2 Lead management ✅

- Server-side paginated table; search by name, email or phone; filters by stage, source, owner (incl. unassigned), priority, tag, created date, "not contacted", "needs review". Filters persist while navigating.
- Create/edit a lead manually; duplicate warning while typing (email/phone).
- CSV import: upload → column mapping → server-side preview (valid / duplicate / invalid per row) → import. Bad rows never block good rows.
- Bulk actions: assign owner, change stage, add tags, delete.
- CSV export of the filtered list, permission-checked and audit-logged.
- Activity history for every important change.

**Lead fields:** full name, email (optional), phone (with country code), company, source, campaign, stage, owner, priority, tags, last contacted at, next follow-up at, created at, plus **optional** industry fields (real estate: budget, area, unit type, delivery timeline; clinic: service type, preferred date). Industry fields are never mandatory.

**Acceptance:** a lead needs a name and at least a phone or email; duplicates follow the organization's duplicate policy; exports contain only rows the user may see.

### 5.3 Sales pipeline ✅

- Default stages: **New → Contacted → Qualified → Proposal Sent → Won / Lost**.
- Kanban board and table views; drag-and-drop between stages.
- Every transition is timestamped in stage history (used by reports).
- Moving to **Lost requires a reason**.
- Optional auto-task when a lead enters a stage (e.g. Qualified → "Schedule a viewing", due in 24 h).
- Organizations can rename, reorder and add stages (one Won, one Lost and at least one open stage; max 12).

### 5.4 Tasks & follow-up calendar ✅

- Task types: call, email, meeting/viewing, follow-up, send proposal, other; with assignee, due time, priority.
- Views: Today, Overdue, Upcoming, Done, plus a 7-day agenda.
- Reminders (in-app + email per preferences); complete with outcome and notes, optionally scheduling the next follow-up in the same step; postpone (+1 h / tomorrow 10:00); create from the lead page.
- **Every open lead should have a clear next step.** The lead page highlights leads without one.
- When a lead is **Won, Lost or asks not to be contacted**, its scheduled automated follow-ups are cancelled.

### 5.5 AI assistant ✅ (classification) · 🔜 (conversation summaries)

The AI helps the sales team. It is not a replacement for the salesperson and is never the only basis for an important decision.

| Capability | Output |
|---|---|
| Lead classification | Inquiry type + extracted needs (area, budget, unit type…) |
| Lead summary | Short summary of the message/notes |
| Priority suggestion | Priority + the reason |
| Suggested reply | Editable draft (copy to clipboard) |
| Next best action | e.g. call to book a viewing, send proposal |

Example: *"محتاج شقة في الشيخ زايد في حدود 5 مليون واستلام قريب"* → Real Estate Inquiry · Sheikh Zayed · 5,000,000 EGP · urgency High · next step: call to book a viewing.

Rules:

- The original message is always kept; AI output is stored as a **suggestion**, separate from confirmed data, and shown in its own panel.
- A person confirms (optionally applying values to the lead), confirms without applying, or rejects. The review is logged.
- Confidence below the organization threshold (default 60%) → **Needs review**.
- Customer text is untrusted data. Instructions inside it are ignored, and such messages are flagged for review.

### 5.6 Automation center ✅

Ready-made templates (no free-form workflow builder in v1):

| Template | Default |
|---|---|
| Lead intake (validate, normalize, dedupe) | merge duplicates on email + phone |
| Smart assignment | round robin over active agents |
| First-response alert | 15 min, business hours only |
| Stale lead follow-up | task after 1 business day without update |
| Stop follow-ups on close | always on |
| AI qualification | review below 60% confidence |
| Daily report | 09:00 org time (off by default) |

Users see each automation's purpose, on/off state, settings summary, last run, 7-day runs and failures, and the full **execution log** with steps, errors and safe retry.

> The 15-minute target is a configurable default, **not a guarantee**: execution depends on system and integration availability.

### 5.7 Integrations ✅ (core) · 🔜 (later)

| Integration | Priority |
|---|---|
| Website form webhook (signed, idempotent) | Core ✅ |
| Email provider (notifications, reports) | Core ✅ |
| CSV import | Core ✅ |
| Google Sheets, external CRM, calendar | Later 🔜 |
| WhatsApp Business Platform (official API, consent and approved templates only) | Later phase 🔜 |
| Advertising lead APIs | By market 🔜 |

Each integration has connect/disconnect, status, secure credential handling (secrets shown once), connection test, field mapping, retry/error handling, event de-duplication, last-sync log and a note about external costs.

### 5.8 Analytics & reports ✅

- Dashboard: new leads, not yet contacted, tasks due and overdue, qualified, won/lost, conversion rate (with its definition), average first response, leads by source, team performance, needs-attention list, recent activity. Every widget has loading, empty and error states; filters by period and owner.
- Reports: conversion funnel, performance by source and campaign, team table, lost reasons, speed-to-first-contact distribution, CSV export.
- **Every metric states its definition and period.** Conversion rate is a *cohort* metric (of leads created in the period, the share now Won); this differs from "deals closed in the period", and the UI says which one is shown.

### 5.9 Notifications ✅

In-app notification center + email. Events: lead assigned, task due, follow-up overdue, integration failed, import rows failed, automation finished, usage limit near. Each notification has type, read state, timestamp and an in-app link. Preferences never override a customer's contact consent.

### 5.10 Billing & platform administration ✅ (read-only) · 🔜 (self-serve billing)

Plan, status, renewal date and usage against limits (leads, members, automation runs, AI requests). Plan limits are enforced by the API (e.g. inviting beyond the seat limit returns `402`).

## 6. Business rules

Enforced in the **backend** (and mirrored by the mock), never only in Vue components or n8n:

1. No lead without the minimum data (name + phone or email).
2. A lead can't be assigned to a user outside the organization or to an inactive member.
3. Every stage or owner change is written to the activity log.
4. Automatic distribution never targets an inactive member.
5. Every automation has an enabled flag and validated settings.
6. Replaying an event never repeats the message or task unintentionally (idempotency keys / event ids).
7. Scheduled follow-ups are cancelled or re-evaluated when the lead's stage or contact preference changes.
8. An AI suggestion is never treated as confirmed fact without the required review.
9. Users can't export data outside their permissions.
10. Every sales-affecting action is traceable (activity + audit log).
11. Anything needing human review has an explicit state (e.g. *Needs review*).
12. A failed integration call is never recorded as success.
13. Concurrent operations don't create duplicate tasks or conflicting assignments.
14. When an organization account is closed, the contractually agreed retention and deletion policy is applied.

## 7. Non-functional requirements

- **Security & privacy:** see [SECURITY.md](SECURITY.md).
- **Performance:** lead list p95 < 500 ms for 50k leads per organization; dashboard < 1 s; imports up to 5,000 rows per file.
- **UX:** responsive (desktop, tablet, mobile); keyboard accessible with visible focus; clear error messages; confirmation before destructive actions; no data loss on failed save; server-side filtering and pagination; English and Arabic (RTL) from day one; organization time zone everywhere.
- **Reliability:** events persisted before automation runs; failed jobs retryable; n8n downtime must not lose events.

## 8. Release plan

| Version | Scope |
|---|---|
| **MVP — first sellable version** | Authentication & orgs, lead management, pipeline, tasks, website webhook, assignment, email notifications, basic dashboard, workflow logs |
| **v1.1** | AI classification, follow-up rules, CSV import, advanced reports, integrations requested by the first customer |
| **v2** | Automated billing, subscription plans, customizable automation templates, more integrations, deeper usage monitoring |

The frontend in this repository already covers MVP + v1.1 against the API contract, so features can be shown to pilot customers early. Backend delivery should still follow the version order above.

**Why staged:** validate the core problem and willingness to pay before paying to build and maintain features nobody may use. Start with a simple, reliable loop (*lead in → saved → assigned → follow-up → manager sees the result*); add AI and integrations based on real customer needs.

## 9. Delivery plan (single developer)

| Phase | Duration | Output |
|---|---|---|
| 1. Discovery & requirements | 3–5 days | Sales cycle, sources, follow-up rules, permissions, acceptance criteria |
| 2. UX/UI design | 4–7 days | User flows, wireframes, Dashboard/Leads/Pipeline/Settings, every screen state |
| 3. Backend & database | 1–2 weeks | Auth, orgs, schema, APIs, permissions, audit logs |
| 4. Frontend | 1–2 weeks | Pages, forms, tables, filters, charts, responsive UI wired to the API |
| 5. n8n automations | 1–2 weeks | Ingestion, assignment, alerts, follow-up, AI classification, reports |
| 6. QA & security | 4–7 days | E2E, permissions, duplicates, failure & retry, performance |
| 7. Deployment & handover | 2–4 days | Production deploy, runbooks, training, acceptance review |

Estimate: **6–9 working weeks** for one person, depending on integrations and customer requirements. Phases may overlap; new scope needs re-estimation.

## 10. Making it sellable to many customers

1. **Multi-tenancy:** each organization has isolated data, settings and members.
2. **Configuration over hard-coding:** stages, follow-up timing and assignment are settings.
3. **Reusable workflows:** the same n8n logic serves all tenants through isolated, validated configuration.
4. **Usage tracking:** leads, messages, workflow runs and AI usage per organization.
5. **Operational support:** detect failures, know cost per customer, pause or resume failed jobs safely.

> An n8n subscription alone is not the product's subscription model. Review the n8n licence (Sustainable Use / Embed) for your hosting and multi-customer model before launch.

## 11. Out of scope (unless agreed in writing)

Integrations not in the approved scope · native mobile apps · guaranteed sales or conversion improvements · third-party subscription fees · support beyond the agreed period · features requested after scope approval.
