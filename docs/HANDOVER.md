# Handover package

When the project is finished, the customer receives a **working product**, not just source code and workflow JSON.

## Handover checklist (0 / 25)

### Product & source code

- [ ] Frontend source code
- [ ] Backend source code
- [ ] Database migrations and schema
- [ ] Production and staging configuration guide
- [ ] Environment variables template without secrets (`.env.example`)

### n8n automation

- [ ] Exported workflow JSON files
- [ ] Workflow configuration documentation
- [ ] Credentials setup guide
- [ ] Retry and failure-handling documentation
- [ ] Workflow test scenarios

### Documentation

- [x] Product requirements and scope — [PRD.md](PRD.md)
- [x] API documentation — [API.md](API.md)
- [x] Database documentation — [DATABASE.md](DATABASE.md)
- [x] Security and permissions guide — [SECURITY.md](SECURITY.md)
- [x] User manual and admin guide — [USER_GUIDE.md](USER_GUIDE.md)

### Deployment & operations

- [ ] Production deployment guide (base: [DEPLOYMENT.md](DEPLOYMENT.md), plus the actual hosts)
- [ ] Backup and restore instructions (with the last restore-drill result)
- [ ] Monitoring and alerting setup
- [ ] Rollback and recovery instructions
- [ ] Third-party services inventory (provider, account owner, plan, renewal date, cost)

### Client acceptance

- [ ] UAT test results ([TESTING.md](TESTING.md#mandatory-acceptance-scenarios))
- [ ] Known limitations and agreed exclusions
- [ ] Training session
- [ ] Access handover checklist (domains, hosting, email provider, AI provider, n8n, repositories, secret manager)
- [ ] Written acceptance and support terms

---

## Technical & commercial proposal (template)

> Draft. Fill in the final price, both parties' details, payment terms, ownership rights, and warranty/support duration before sending it to a customer.

### Smart Lead Management & Follow-up System

**1. Project overview.** Development of a web-based lead management and sales automation platform that centralizes lead collection, organizes sales pipelines, automates follow-up tasks, and provides actionable reporting for sales teams.

**2. Scope of work**

- User authentication and organization management.
- Role-based access control.
- Lead management, filtering, assignment, and activity history.
- Sales pipeline and task management.
- Website lead capture through secure APIs and webhooks.
- Automated notifications and configurable follow-up rules.
- n8n workflow integration and execution logging.
- Dashboard and reporting.
- Initial deployment, testing, documentation, and handover.

**3. Deliverables**

- Responsive web application.
- Backend API and database.
- Configured n8n workflows.
- Source code and deployment instructions, subject to the agreed ownership terms.
- API and technical documentation.
- User and administrator guides.
- Acceptance testing and handover session.

**4. Estimated timeline.** Approximately 6–9 weeks for the initial scope, subject to requirements confirmation, third-party integrations, and timely client feedback.

**5. Commercial terms**

- Project setup and development fee: *to be agreed after discovery.*
- Hosting and infrastructure: *quoted separately or explicitly included.*
- Third-party API, AI, email, and messaging usage: *billed according to the agreed commercial model.*
- Ongoing support and maintenance: *covered by a separate support agreement or subscription.*

**6. Acceptance criteria.** The project will be considered ready for acceptance when the agreed features pass the documented user acceptance tests, permissions are verified, core automations operate as specified, and the agreed deployment and documentation deliverables have been provided.

**7. Exclusions unless explicitly agreed**

- Integrations not listed in the approved scope.
- Custom mobile applications.
- Guaranteed sales or conversion improvements.
- Third-party subscription fees.
- Ongoing support beyond the agreed support period.
- Additional features requested after scope approval.

**8. Ownership, security & support.** Ownership of deliverables, third-party licensing, source-code access, data retention, confidentiality, security responsibilities, and support terms will be defined in the signed agreement.

---

## First practical steps (recommended order)

1. Pick one vertical to start (e.g. real estate).
2. Talk to 3–5 companies to understand how they collect leads and where follow-up breaks.
3. Map the full user flow from receiving a lead to closing the deal.
4. Validate the Dashboard, Leads table and Lead details designs with them (the frontend in this repo is ready to demo in mock mode).
5. Build the backend and database with tenant isolation and permissions.
6. Build the first n8n workflow: receive a lead and notify the salesperson.
7. Test that workflow for duplicates, failures and retries.
8. Demo it on a prospective customer and collect feedback before building the remaining features.

**Final advice:** don't start with the AI or complex automation. Start with a simple but reliable loop: a lead comes in, is saved, is assigned to a salesperson, gets a follow-up, and the manager can see the result. Once that loop works properly, add AI and integrations based on what customers actually need.
