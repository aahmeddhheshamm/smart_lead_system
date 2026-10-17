# User & admin guide

## Getting started (owner)

1. **Create a workspace** at `/register`. You become the organization **Owner**.
2. The **setup wizard** asks for your company details (time zone, currency), shows the default pipeline, lets you invite your team, and creates your website webhook.
3. **Copy the webhook signing secret** when it is shown; it is displayed only once. Give it, with the webhook URL, to whoever maintains your website.
4. Check **Automations** (assignment strategy, first-response alert time) and **Settings → Members** (add agents' specialties if you assign by area).

## Daily work (sales agent)

- **Dashboard:** your new leads, leads you haven't contacted, tasks due today and overdue, and anything waiting on you.
- **Tasks & Calendar:** work top-down through *Overdue* and *Today*. *Done* asks for the outcome and lets you schedule the next follow-up in the same step. Use ⏰ to postpone by an hour or to tomorrow.
- **Lead page:**
  - Log what happened (call, email, meeting, WhatsApp, note). Contact activities update *Last contacted*.
  - **Change stage** when the lead progresses. Marking a lead **Lost** asks for the reason.
  - **AI insights** suggest the inquiry type, needs, priority, a reply draft and the next step. They are only suggestions: *Confirm & apply* copies the values to the lead, *Not correct* discards them.
  - Every open lead should have a **next step**. The page warns you when it doesn't.
  - If a customer asks not to be contacted, use **Do not contact**. It cancels automated follow-ups and blocks marketing messages.

## Managing the team (sales manager)

- **Leads:** filter by stage, source, owner (including *Unassigned*), priority, tag or date; tick rows to **assign**, **change stage** or **tag** in bulk; **Import CSV** to bring in existing leads (you'll see a preview of valid, duplicate and invalid rows before anything is saved); **Export CSV** for the filtered list.
- **Pipeline:** drag cards between stages; the column header shows the count and total budget.
- **Reports:** conversion funnel, performance by source and campaign, team table, why deals are lost, and how fast the team makes first contact. Hover ⓘ on any metric to see exactly how it is calculated.

## Administration (owner / admin)

| Where | What you can do |
| --- | --- |
| Settings → General | Company name, industry, currency, time zone, default language, business hours |
| Settings → Members | Invite (7-day single-use links), change roles, deactivate (signs the person out immediately; they stop receiving leads), set agent specialties |
| Settings → Roles | See exactly what each role may do |
| Settings → Pipeline | Rename/reorder stages, add stages, add an automatic task when a lead enters a stage |
| Settings → Lead sources | Add/deactivate sources (sources with leads are deactivated, not deleted) |
| Settings → Plan & usage | Plan, renewal and usage against limits |
| Settings → Audit log | Who changed permissions, exported, deleted or changed integrations |
| Automations | Turn templates on/off and adjust their settings |
| Execution logs | Each automation run step by step; **Retry** failed runs safely |
| Integrations | Connect the website form and the email sender, send a test lead, disconnect |

## Roles at a glance

| Role | Typical person | Sees |
| --- | --- | --- |
| Owner | Business owner | Everything, including billing |
| Admin | Operations lead | Everything except billing |
| Sales manager | Team lead | All leads, assignment, imports/exports, reports |
| Sales agent | Salesperson | Only their own leads and tasks |
| Analyst | Marketing / finance | Read-only leads, automations and reports |

## Website form integration (for your web developer)

Send each form submission to the ingest URL from **Integrations → Website form** (`…/api/v1/ingest/<publicKey>`):

```bash
BODY='{"name":"Ahmed Hassan","phone":"+201001234567","email":"ahmed@example.com","message":"Looking for an apartment","utm_campaign":"summer"}'
TS=$(date +%s)
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" -hex | sed 's/^.* //')
curl -X POST "$INGEST_URL" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "X-LeadFlow-Signature: t=$TS,v1=$SIG" \
  -d "$BODY"
```

- Send the request **from your server**, never from browser JavaScript (the secret must stay private).
- Use a new `Idempotency-Key` per submission. If you retry the same submission, reuse its key and it will not be created twice.
- At least a name and a phone number or email are required.

## FAQ

**A lead was assigned to the wrong person.** Change the owner on the lead page (or in bulk). The change and its reason are recorded in the timeline.

**Why didn't the first-response alert fire?** It only runs during business hours (Settings → General) when enabled in Automations, and only for leads still in the first stage with no contact logged.

**Someone left the company.** Deactivate them in Settings → Members, then filter Leads by that owner and reassign in bulk.

**The import says "duplicate".** A lead with the same email or phone already exists. Choose *Skip* or *Merge into existing* before importing.

**Is the AI always right?** No. It is an assistant. Low-confidence results are marked *Needs review*, and nothing is applied to the lead without your confirmation.
