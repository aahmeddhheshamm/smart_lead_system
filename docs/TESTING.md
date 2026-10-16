# Testing & quality assurance

A project is ready to hand over when the **whole lead cycle works, including its failure cases**, not when the pages merely open.

## Test types

| Type | Scope | Where / tool |
| --- | --- | --- |
| Unit | Business rules, normalization, CSV parsing, permission helpers | Vitest (frontend), Jest (backend) |
| Integration | Backend with the database and providers (test containers) | Backend |
| API | Validation, permissions, status codes, tenant isolation, idempotency | Backend; start from `tests/mock-api.smoke.ts` |
| E2E | Sign-in → lead → assignment → follow-up → Won → report | Playwright against staging |
| Workflow | n8n success, failure and retry for workflows A–E | Staging n8n + scenario list in [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md#workflow-test-scenarios) |
| Security | Tenant isolation, permissions, webhook protection, OWASP top 10 | Automated + manual review |
| Performance | Lead search, import, dashboard at 50k leads / org | k6 |
| UAT | Customer acceptance with agreed real scenarios | Customer on staging |

## What runs today

```bash
npm run build:check   # vue-tsc type check + production build
npm run test:mock     # 19 business-rule checks against the mock API
```

`test:mock` covers: login failures and inactive members, server pagination, cross-tenant `404`, agent visibility, analyst read-only, minimum lead data, normalization + AI extraction + assignment to active agents only, duplicate merge, `Idempotency-Key` replay, invalid owner, Lost reason required, Won cancels automated follow-ups, CSV import isolation of bad rows, webhook signature and event-id replay, self-role protection, export permission, dashboard/report computation and funnel monotonicity.

## Mandatory acceptance scenarios

| Scenario | Required result | Covered by |
| --- | --- | --- |
| Valid lead received | Lead created and source recorded | smoke test, UI |
| Same event arrives twice | No duplicate business effect | smoke test (webhook + Idempotency-Key) |
| Lead with missing data | Rejected or sent to review per rules | smoke test |
| Email sending fails | Failure logged, safe retry available | Execution logs → Retry (UI); backend test |
| User from another company requests a lead | Access refused | smoke test |
| Inactive employee in rotation | No lead assigned to them | smoke test |
| Lead reaches Won | Inappropriate follow-ups stopped | smoke test |
| Customer asks not to be contacted | Related marketing messages blocked | UI (Do not contact) + backend test |
| AI returns invalid JSON | Untrusted result not saved as confirmed | backend/workflow test |
| CSV import with errors | Failed rows shown, valid rows not corrupted | smoke test + import wizard |
| n8n temporarily down | Event/task kept so it can be completed | outbox test (backend) |
| Integration credentials expire | Clear status shown and owner alerted | integrations page + workflow test |

## Manual UI checklist (per release)

- [ ] Every role (owner, admin, manager, agent, analyst) signs in and only sees permitted menus/buttons; direct URLs to forbidden pages show *Access denied*.
- [ ] Leads: search, each filter, filters persist after opening a lead, sort, pagination, bulk assign/stage/tags/delete, export, CSV import (valid, duplicate, invalid rows).
- [ ] Lead page: edit, change owner, change stage (Lost asks for a reason), log note/call/email, tasks create/complete/postpone, AI analyse/confirm/reject, do-not-contact, delete.
- [ ] Pipeline: drag between stages; dropping on Lost asks for a reason and snaps back on cancel.
- [ ] Tasks: today/overdue/upcoming/done counts, week view, complete with next follow-up.
- [ ] Automations: toggle, edit config (invalid values rejected), runs log, retry a failed run.
- [ ] Integrations: connect website (secret shown once), send test lead, disconnect.
- [ ] Settings: org details, invite (link works, expires), role change, deactivate, pipeline editor rules, sources, notification preferences, billing usage, audit log entries for the actions above.
- [ ] Arabic: every page in RTL, no clipped or untranslated text.
- [ ] Dark mode, keyboard navigation with visible focus, and phone width (no horizontal page scroll) on Dashboard, Leads, Lead page, Pipeline, Tasks.
- [ ] Empty, loading and error states (stop the API to see error states).

## Release gate (definition of done before handover)

- [ ] No unresolved critical or high-severity vulnerabilities.
- [ ] Every role tested.
- [ ] Backup restore tested.
- [ ] Core workflows tested in **staging**.
- [ ] Full user journey tested, from lead source to report.
- [ ] Every expected error has clear handling.
- [ ] Customer approved the agreed acceptance criteria.
