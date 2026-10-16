# Security, permissions & privacy

Security is a baseline requirement for selling to real companies, not an add-on feature.

## Roles and permissions

Defined once in [`src/config/permissions.ts`](../src/config/permissions.ts) and enforced by the backend on every request. The UI uses the same keys only to hide what the API would refuse anyway.

| Permission | Owner | Admin | Sales manager | Sales agent | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: |
| leads.view_all | ✓ | ✓ | ✓ | | ✓ |
| leads.view_own | ✓ | ✓ | ✓ | ✓ | |
| leads.create | ✓ | ✓ | ✓ | ✓ | |
| leads.update | ✓ | ✓ | ✓ | ✓ | |
| leads.delete | ✓ | ✓ | | | |
| leads.assign | ✓ | ✓ | ✓ | | |
| leads.import | ✓ | ✓ | ✓ | | |
| leads.export | ✓ | ✓ | ✓ | | |
| pipeline.manage | ✓ | ✓ | | | |
| tasks.view_all | ✓ | ✓ | ✓ | | |
| tasks.manage | ✓ | ✓ | ✓ | ✓ | |
| automations.view | ✓ | ✓ | ✓ | | ✓ |
| automations.manage | ✓ | ✓ | | | |
| integrations.view | ✓ | ✓ | ✓ | | ✓ |
| integrations.manage | ✓ | ✓ | | | |
| reports.view | ✓ | ✓ | ✓ | | ✓ |
| members.view | ✓ | ✓ | ✓ | | ✓ |
| members.manage | ✓ | ✓ | | | |
| settings.manage | ✓ | ✓ | | | |
| billing.manage | ✓ | | | | |
| audit.view | ✓ | ✓ | | | |

- **Platform admin** (operator staff): support access is time-boxed, requires a reason, and every access is written to the audit log.
- Organizations must be able to restrict visibility, in particular agents who must not see the whole team's leads (`leads.view_own`).
- Self-protection rules: users can't change their own role/status; an organization always keeps one active Owner; only an Owner grants Owner.

## Security checklist

- [x] Tenant isolation in the backend (every query scoped by `organization_id`; other tenants' ids return `404`) — optionally PostgreSQL RLS as a second layer.
- [x] Authorize every request, **including requests from n8n** (service token + organization check).
- [ ] HTTPS everywhere (HSTS); TLS between services.
- [ ] Secrets in a secret manager or a secure runtime environment; never in Git or chat.
- [x] No API keys in frontend code (the SPA only knows the API URL).
- [ ] Encrypt sensitive contact data and credentials at rest and in backups, per requirements.
- [x] Webhooks protected against forgery and replay (HMAC signature, timestamp window, event-id idempotency).
- [ ] Session auth with `HttpOnly`, `Secure`, `SameSite` cookies + CSRF protection on writes.
- [x] Protect email/password/session changes (current password required; other sessions revoked; reset links single-use, 1 h).
- [x] Log permission changes, exports and deletions (audit log).
- [ ] Scheduled backups **with tested restores**.
- [ ] Defined retention period, deletion and export procedures ([DATABASE.md §5](DATABASE.md#5-retention-defaults-adjust-per-contract)).
- [ ] Comply with the data-protection laws of each customer market (e.g. Egypt PDPL 151/2020, UAE PDPL, KSA PDPL, GDPR for EU data subjects) and collect the required consent before marketing contact.
- [x] Opt-out of marketing contact applied across all relevant workflows (`do-not-contact` cancels automated follow-ups and blocks marketing sends).

[x] = implemented in the frontend + mock contract; the backend must implement it too. [ ] = backend/infrastructure item.

### Application-level controls

| Threat | Control |
| --- | --- |
| IDOR / cross-tenant access | Tenant from the session only; record-level checks; `404` for foreign ids |
| Brute force | Per-account + per-IP throttling on login (5 failures / 5 min); generic error messages |
| Account enumeration | `forgot-password` always returns 200 |
| Privilege escalation | Server-side permission checks; owner-only owner grants; self-modification blocked |
| Mass assignment | Explicit allow-lists of writable fields per endpoint (`workflowId`, `organizationId`, `ownerId` without `leads.assign` are ignored or rejected) |
| Duplicate side effects | `Idempotency-Key` on writes, event ids on webhooks, dedupe keys on tasks/notifications, row locks on assignment |
| XSS | Vue escapes output; no `v-html` with user data; CSP (`default-src 'self'`) on the web host |
| CSRF | SameSite cookies + CSRF token for cookie-authenticated writes |
| Data leakage in errors | Uniform error envelope; no stack traces; `requestId` for support |
| Export abuse | `leads.export` permission, scoped to visible rows, audit-logged, rate-limited |
| Large payloads | Body size limits (1 MB JSON, 64 KB webhooks, 5,000 import rows) |

## n8n security rules

1. **Never expose the n8n editor to end customers** by default.
2. The frontend never sends arbitrary workflow names to trigger.
3. Use **fixed, allow-listed workflow ids** stored on the backend (`automation_rules.workflow_id`).
4. Verify the identity of every request coming from n8n (service token per environment, IP allow-list where possible).
5. Workflows never accept arbitrary URLs, commands or untrusted queries from event data.
6. Don't put full customer data in n8n logs. Pass ids and fetch what's needed from the backend; set n8n execution-data pruning.
7. Restrict n8n credentials and the runtime environment; monitor failures and retries.
8. Separate development and production n8n instances, and review every workflow change before publishing it (export JSON to Git; review the diff).

> **Licensing:** review n8n's licence and usage terms before offering a commercial product built on it, especially if customers get an interface to configure workflows or you host n8n on their behalf. Your commercial model can change the licence requirements (e.g. n8n Embed).

## AI safety & privacy

- Send the **minimum data** needed (message text only; no phone/email) to the AI provider.
- Treat customer messages as **untrusted data**, never as instructions: the prompt states this explicitly. The output must match a strict JSON schema with enumerated values, and invalid output is discarded. Messages that look like prompt injection are flagged *Needs review*.
- Store AI output as a suggestion with model and timestamp; never overwrite confirmed data without a human action.
- Log cost and outcome without storing unnecessary sensitive information.
- Choose a provider and region whose data-processing terms fit the customer's market. Disable training on customer data.

## Health data (clinics)

Clinic leads can contain health information. For that vertical: minimize free-text fields, restrict `leads.view_all`, keep AI classification off unless the customer approves it, and confirm the hosting region and processor agreements meet the applicable health-data rules before onboarding.

## WhatsApp

Use only the **official WhatsApp Business Platform**, respect customer opt-in, and use approved templates outside the 24-hour window. Never automate a personal WhatsApp account or work around platform limits.

## Production keys

Encryption keys (including `N8N_ENCRYPTION_KEY`) must be stable, stored securely, and have a rotation and recovery plan. **Losing the n8n encryption key makes every stored n8n credential unreadable.**
