// Color bucket per raw status value, used by StatusBadge
export const statusColor: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
  // members / integrations
  active: 'success',
  connected: 'success',
  inactive: 'danger',
  disconnected: 'danger',
  invited: 'info',
  pending: 'warn',
  error: 'danger',
  expired: 'danger',
  revoked: 'danger',
  accepted: 'success',

  // priorities
  low: 'info',
  medium: 'warn',
  high: 'danger',
  urgent: 'danger',

  // tasks
  open: 'info',
  completed: 'success',
  cancelled: 'danger',
  overdue: 'danger',

  // automation runs
  queued: 'info',
  running: 'warn',
  succeeded: 'success',
  failed: 'danger',

  // AI insights
  suggested: 'info',
  needs_review: 'warn',
  confirmed: 'success',
  rejected: 'danger',

  // pipeline stage types
  won: 'success',
  lost: 'danger',

  // billing
  trialing: 'info',
  past_due: 'danger',

  // imports
  valid: 'success',
  duplicate: 'warn',
  invalid: 'danger',
  processing: 'warn',
}
