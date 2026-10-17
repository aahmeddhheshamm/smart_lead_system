// Domain contracts shared by every module. They mirror docs/API.md one-to-one:
// the backend (and the local mock in src/mock) must return exactly these shapes.

export type ID = string

export type UserRef = { id: ID; name: string; email?: string }

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number }

export type ListResponse<T> = { data: T[]; pagination: Pagination }

export type ItemResponse<T> = { data: T; message?: string }

export type ApiError = {
  error: {
    code: string
    message: string
    details?: Record<string, string[]> | Array<{ row?: number; field?: string; message: string }>
    requestId?: string
  }
}

/* ===================== Organization & access ===================== */

export type RoleKey = 'platform_admin' | 'owner' | 'admin' | 'sales_manager' | 'sales_agent' | 'analyst'

export type MemberStatus = 'active' | 'inactive' | 'invited'

export interface LeadSettings {
  dedupMatchFields: Array<'email' | 'phone'>
  dedupAction: 'update' | 'skip' | 'flag'
  requiredFields: string[]
  lostReasons: string[]
  defaultCountry: string
}

export interface Organization {
  id: ID
  name: string
  industry: 'real_estate' | 'clinic' | 'agency' | 'other'
  timezone: string
  locale: 'en' | 'ar'
  currency: string
  businessHours: { start: string; end: string; days: number[] }
  onboardingCompleted: boolean
  planId: string
  // backend-only settings (dedupe policy, lost reasons…); absent in mock mode
  leadSettings?: LeadSettings | null
  createdAt: string
}

// An organization the signed-in user belongs to (organization switcher)
export interface OrganizationRef {
  id: ID
  name: string
  role: RoleKey | string
}

export interface CurrentUser {
  id: ID
  name: string
  email: string
  phone?: string | null
  locale?: 'en' | 'ar'
  emailVerified: boolean
}

export interface Membership {
  id: ID
  role: RoleKey
  permissions: string[]
  status: MemberStatus
}

export interface MeResponse {
  user: CurrentUser
  organization: Organization
  membership: Membership
  organizations?: OrganizationRef[]
}

export interface Member {
  id: ID
  user: UserRef
  role: RoleKey
  roleId?: ID
  roleName?: string
  isAvailable?: boolean
  title?: string
  status: MemberStatus
  specialties: string[]
  lastActiveAt: string | null
  joinedAt: string
}

export interface Invitation {
  id: ID
  email: string
  role: RoleKey
  inviteLink?: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  invitedBy: UserRef
  createdAt: string
}

export interface Session {
  id: ID
  userAgent: string
  ip: string
  current: boolean
  lastSeenAt: string
  createdAt: string
}

/* ===================== Leads ===================== */

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type StageType = 'open' | 'won' | 'lost'

export interface PipelineStage {
  id: ID
  name: string
  key: string
  type: StageType
  position: number
  color: string
  // Creates this task automatically when a lead enters the stage (PRD 3.3)
  autoTask: { enabled: boolean; title: string; type: TaskType; dueInHours: number } | null
}

export interface LeadSource {
  id: ID
  key?: string
  name: string
  type: 'website' | 'ads' | 'social' | 'referral' | 'phone' | 'walk_in' | 'import' | 'api' | 'other'
  active: boolean
}

export interface Tag {
  id: ID
  name: string
  color?: string
}

export interface CustomFieldDefinition {
  id: ID
  key: string
  label: string
  fieldType: 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'boolean'
  options: string[]
  isRequired: boolean
}

export type AiStatus = 'pending' | 'suggested' | 'needs_review' | 'confirmed' | 'rejected'

export interface LeadAiInsights {
  status: AiStatus
  classification: string
  summary: string
  priority: Priority
  priorityReason: string
  suggestedReply: string
  nextBestAction: string
  confidence: number
  // Values the AI inferred, kept apart from what the customer actually stated (PRD 3.5)
  extracted: Record<string, string | number | null>
  model: string
  generatedAt: string
  reviewedBy?: UserRef | null
  // backend: one insight per kind; the panel reviews all of them together
  insightIds?: ID[]
}

export interface Lead {
  id: ID
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: LeadSource | null
  campaign: string | null
  stage: Pick<PipelineStage, 'id' | 'name' | 'type' | 'color'> & { key?: string }
  owner: UserRef | null
  priority: Priority
  tags: string[]
  tagRefs?: Tag[]
  message: string | null
  customFields: Record<string, string | number | null>
  lastContactedAt: string | null
  nextFollowUpAt: string | null
  doNotContact: boolean
  needsReview?: boolean
  marketingConsent?: boolean
  lostReason: string | null
  wonAt: string | null
  lostAt: string | null
  ai: LeadAiInsights | null
  createdAt: string
  updatedAt: string
}

export type ActivityType =
  | 'created'
  | 'updated'
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'whatsapp'
  | 'stage_changed'
  | 'owner_changed'
  | 'task_created'
  | 'task_completed'
  | 'ai_classified'
  | 'automation'
  | 'imported'
  | 'do_not_contact'

export interface LeadActivity {
  id: ID
  leadId: ID
  type: ActivityType
  actor: UserRef | null // null = system / automation
  payload: Record<string, any>
  createdAt: string
}

export interface DuplicateMatch {
  lead: Pick<Lead, 'id' | 'name' | 'email' | 'phone' | 'stage' | 'owner' | 'createdAt'>
  matchedOn: Array<'email' | 'phone'>
}

/* ===================== Tasks ===================== */

export type TaskType = 'call' | 'email' | 'meeting' | 'follow_up' | 'send_quote' | 'viewing' | 'whatsapp' | 'other'
export type TaskStatus = 'open' | 'completed' | 'cancelled'

export interface Task {
  id: ID
  title: string
  type: TaskType
  status: TaskStatus
  priority: Priority
  dueAt: string
  lead: Pick<Lead, 'id' | 'name'> | null
  assignee: UserRef | null
  outcome: string | null
  notes: string | null
  // true when created by an automation; such tasks are cancelled when the lead is won/lost/DNC
  automated: boolean
  completedAt: string | null
  createdAt: string
}

/* ===================== Automation ===================== */

export type AutomationType =
  | 'lead_ingestion'
  | 'lead_assignment'
  | 'first_response_sla'
  | 'stale_lead_follow_up'
  | 'stop_on_reply'
  | 'stop_on_close'
  | 'task_reminder'
  | 'ai_classification'
  | 'daily_report'

export interface AutomationRule {
  id: ID
  type: AutomationType
  name?: string
  description?: string
  enabled: boolean
  config: Record<string, any>
  workflowId: string // fixed n8n workflow id allowed by the backend ('' when not exposed)
  lastRunAt: string | null
  lastRunStatus: RunStatus | null
  lastError?: string | null
  runCount: number
  failureCount: number
  updatedAt: string
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'

export interface AutomationRun {
  id: ID
  rule: (Pick<AutomationRule, 'id' | 'type'> & { name?: string }) | null
  status: RunStatus
  trigger: string
  lead: Pick<Lead, 'id' | 'name'> | null
  eventId: string
  attempt: number
  steps: Array<{ name: string; status: RunStatus; message?: string; durationMs: number }>
  error: string | null
  input?: Record<string, any> | null
  output?: Record<string, any> | null
  durationMs?: number | null
  startedAt: string
  finishedAt: string | null
}

/* ===================== Integrations ===================== */

export type IntegrationProvider =
  | 'website_form'
  | 'email'
  | 'csv_import'
  | 'api'
  | 'google_sheets'
  | 'external_crm'
  | 'calendar'
  | 'whatsapp_business'
  | 'ad_leads'

export interface Integration {
  id: ID
  provider: IntegrationProvider
  status: 'connected' | 'disconnected' | 'error' | 'expired' | 'coming_soon'
  priority: 'core' | 'later' | 'future'
  config: Record<string, any> // never contains secrets, only masked previews
  displayName?: string
  endpointUrl?: string | null
  lastSyncAt: string | null
  lastError: string | null
  eventsLast7d: number
}

/* ===================== Notifications ===================== */

export type NotificationType =
  | 'lead_assigned'
  | 'task_due'
  | 'follow_up_overdue'
  | 'uncontacted_lead'
  | 'unassigned_lead'
  | 'integration_failed'
  | 'import_failed_rows'
  | 'import_finished'
  | 'automation_finished'
  | 'automation_failed'
  | 'ai_review_needed'
  | 'daily_report'
  | 'usage_limit'

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  body: string
  // named route (mock) or an in-app path such as "/leads/<id>" (backend)
  link: { name: string; params?: Record<string, string> } | string | null
  readAt: string | null
  createdAt: string
}

export type NotificationPreferences = Partial<Record<NotificationType, { inApp: boolean; email: boolean }>>

/* ===================== Billing & audit ===================== */

export interface Plan {
  id: string
  code: string
  name: string
  priceMonthly: number
  currency: string
  limits: Record<string, number>
}

export interface Subscription {
  plan: { id: string; code?: string; name: string; priceMonthly: number; currency: string }
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  currentPeriodEnd: string
  usage: Array<{ key: string; used: number; limit: number }>
}

export interface AuditLog {
  id: ID
  actor: UserRef | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, any>
  ip: string | null
  createdAt: string
}

/* ===================== Dashboard & reports ===================== */

export interface DashboardSummary {
  period: { from: string; to: string }
  kpis: {
    newLeads: number
    notFollowedUp: number
    tasksDue: number
    tasksOverdue: number
    qualified: number
    won: number
    lost: number
    conversionRate: number
    avgFirstResponseMinutes: number | null
  }
  conversionDefinition: string
  bySource: Array<{ source: string; leads: number; won: number }>
  team: Array<{ user: UserRef; assigned: number; contacted: number; won: number; overdueTasks: number }>
  needsAttention: Array<{ kind: 'uncontacted' | 'overdue_task' | 'needs_review'; lead: Pick<Lead, 'id' | 'name'>; detail: string; at: string }>
  recentActivity: Array<LeadActivity & { lead: Pick<Lead, 'id' | 'name'> }>
}

export interface ReportsResponse {
  period: { from: string; to: string }
  definitions: Record<string, string>
  funnel: Array<{ stage: string; type: StageType; count: number }>
  bySource: Array<{ source: string; leads: number; qualified: number; won: number; conversionRate: number }>
  byCampaign: Array<{ campaign: string; leads: number; won: number; conversionRate: number }>
  team: Array<{ user: UserRef; assigned: number; won: number; lost: number; conversionRate: number; avgFirstResponseMinutes: number | null }>
  lostReasons: Array<{ reason: string; count: number }>
  responseTime: { medianMinutes: number | null; within15m: number; within1h: number; over1h: number; never: number }
}

export interface ImportPreviewRow {
  row: number
  values: Record<string, string>
  status: 'valid' | 'duplicate' | 'invalid'
  errors: string[]
  duplicateOf?: Pick<Lead, 'id' | 'name'>
}

export interface ImportJob {
  id: ID
  status: 'preview' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'canceled'
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  failed: Array<{ row: number; message: string }>
  createdAt: string
}
