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

export interface Organization {
  id: ID
  name: string
  industry: 'real_estate' | 'clinic' | 'agency' | 'services' | 'other'
  timezone: string
  locale: 'en' | 'ar'
  currency: string
  businessHours: { start: string; end: string; days: number[] }
  onboardingCompleted: boolean
  planId: string
  createdAt: string
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
}

export interface Member {
  id: ID
  user: UserRef
  role: RoleKey
  status: MemberStatus
  specialties: string[]
  lastActiveAt: string | null
  joinedAt: string
}

export interface Invitation {
  id: ID
  email: string
  role: RoleKey
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
  name: string
  type: 'website' | 'manual' | 'import' | 'ads' | 'referral' | 'email' | 'whatsapp' | 'other'
  active: boolean
}

export type AiStatus = 'suggested' | 'needs_review' | 'confirmed' | 'rejected'

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
}

export interface Lead {
  id: ID
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: LeadSource | null
  campaign: string | null
  stage: Pick<PipelineStage, 'id' | 'name' | 'type' | 'color'>
  owner: UserRef | null
  priority: Priority
  tags: string[]
  message: string | null
  customFields: Record<string, string | number | null>
  lastContactedAt: string | null
  nextFollowUpAt: string | null
  doNotContact: boolean
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

export type TaskType = 'call' | 'email' | 'meeting' | 'follow_up' | 'send_proposal' | 'other'
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
  | 'stop_on_close'
  | 'ai_classification'
  | 'daily_report'

export interface AutomationRule {
  id: ID
  type: AutomationType
  enabled: boolean
  config: Record<string, any>
  workflowId: string // fixed n8n workflow id allowed by the backend
  lastRunAt: string | null
  lastRunStatus: RunStatus | null
  runsLast7d: number
  failuresLast7d: number
  updatedAt: string
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'

export interface AutomationRun {
  id: ID
  rule: Pick<AutomationRule, 'id' | 'type'>
  status: RunStatus
  trigger: string
  lead: Pick<Lead, 'id' | 'name'> | null
  eventId: string
  attempt: number
  steps: Array<{ name: string; status: RunStatus; message?: string; durationMs: number }>
  error: string | null
  startedAt: string
  finishedAt: string | null
}

/* ===================== Integrations ===================== */

export type IntegrationProvider =
  | 'website_form'
  | 'email'
  | 'csv_import'
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
  lastSyncAt: string | null
  lastError: string | null
  eventsLast7d: number
}

/* ===================== Notifications ===================== */

export type NotificationType =
  | 'lead_assigned'
  | 'task_due'
  | 'follow_up_overdue'
  | 'integration_failed'
  | 'import_failed_rows'
  | 'automation_finished'
  | 'usage_limit'

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  body: string
  link: { name: string; params?: Record<string, string> } | null
  readAt: string | null
  createdAt: string
}

export type NotificationPreferences = Record<NotificationType, { inApp: boolean; email: boolean }>

/* ===================== Billing & audit ===================== */

export interface Subscription {
  plan: { id: string; name: string; priceMonthly: number; currency: string }
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  currentPeriodEnd: string
  usage: Array<{ key: 'leads' | 'members' | 'automation_runs' | 'ai_requests'; used: number; limit: number }>
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
  status: 'processing' | 'completed' | 'failed'
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  failed: Array<{ row: number; message: string }>
  createdAt: string
}
