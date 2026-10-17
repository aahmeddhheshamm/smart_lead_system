import type { AutomationType, IntegrationProvider, Priority, TaskType } from '@/types/domain'

// Option lists are stored as keys; labels come from the locale files (options.<group>.<key>)

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

export const TASK_TYPES: TaskType[] = ['call', 'email', 'meeting', 'viewing', 'follow_up', 'send_quote', 'whatsapp', 'other']

export const SOURCE_TYPES = ['website', 'ads', 'social', 'referral', 'phone', 'walk_in', 'import', 'api', 'other'] as const

export const LOST_REASONS = ['price', 'competitor', 'no_response', 'not_qualified', 'timing', 'location', 'other'] as const

export const CALL_OUTCOMES = ['reached', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'interested', 'not_interested'] as const

export const LOGGABLE_ACTIVITIES = ['note', 'call', 'email', 'meeting', 'whatsapp'] as const

export const INDUSTRIES = ['real_estate', 'clinic', 'agency', 'other'] as const

export const TIMEZONES = ['Africa/Cairo', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar', 'Europe/London', 'UTC']

export const CURRENCIES = ['EGP', 'AED', 'SAR', 'KWD', 'QAR', 'USD', 'EUR']

export const STAGE_COLORS = ['#64748B', '#378FF5', '#6D6CF7', '#E0A800', '#8B5CF6', '#03C95A', '#E70D0D']

// Industry-specific custom fields: optional for every lead (PRD 3.2)
export const CUSTOM_FIELDS_BY_INDUSTRY: Record<string, Array<{ key: string; type: 'text' | 'number' }>> = {
  real_estate: [
    { key: 'budget', type: 'number' },
    { key: 'area', type: 'text' },
    { key: 'unitType', type: 'text' },
    { key: 'deliveryTimeline', type: 'text' },
  ],
  clinic: [
    { key: 'serviceType', type: 'text' },
    { key: 'preferredDate', type: 'text' },
  ],
  agency: [
    { key: 'budget', type: 'number' },
    { key: 'serviceType', type: 'text' },
  ],
  other: [],
}

export const AUTOMATION_TYPES: AutomationType[] = [
  'lead_ingestion',
  'lead_assignment',
  'first_response_sla',
  'stale_lead_follow_up',
  'stop_on_reply',
  'stop_on_close',
  'task_reminder',
  'ai_classification',
  'daily_report',
]

export const AUTOMATION_ICONS: Record<AutomationType, string> = {
  lead_ingestion: 'lucide:inbox',
  lead_assignment: 'lucide:shuffle',
  first_response_sla: 'lucide:timer',
  stale_lead_follow_up: 'lucide:calendar-clock',
  stop_on_reply: 'lucide:reply',
  stop_on_close: 'lucide:octagon-x',
  task_reminder: 'lucide:alarm-clock',
  ai_classification: 'lucide:sparkles',
  daily_report: 'lucide:mail',
}

export const INTEGRATION_ICONS: Record<IntegrationProvider, string> = {
  website_form: 'lucide:globe',
  email: 'lucide:mail',
  csv_import: 'lucide:file-spreadsheet',
  google_sheets: 'lucide:sheet',
  external_crm: 'lucide:database',
  calendar: 'lucide:calendar',
  whatsapp_business: 'lucide:message-circle',
  ad_leads: 'lucide:megaphone',
  api: 'lucide:code',
}

// Lead fields a CSV column can be mapped to during import
export const IMPORT_FIELDS = ['name', 'email', 'phone', 'company', 'source', 'campaign', 'priority', 'tags', 'message'] as const
