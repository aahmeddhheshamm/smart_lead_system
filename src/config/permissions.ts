import type { RoleKey } from '@/types/domain'

// Permission keys checked by the router, the UI (useAuthorization) and the backend.
// The backend is the source of truth: the frontend only hides what the API would refuse.
export const P = {
  leadsViewAll: 'leads.view_all',
  leadsViewOwn: 'leads.view_own',
  leadsCreate: 'leads.create',
  leadsUpdate: 'leads.update',
  leadsDelete: 'leads.delete',
  leadsAssign: 'leads.assign',
  leadsImport: 'leads.import',
  leadsExport: 'leads.export',
  pipelineManage: 'pipeline.manage',
  tasksViewAll: 'tasks.view_all',
  tasksManage: 'tasks.manage',
  automationsView: 'automations.view',
  automationsManage: 'automations.manage',
  integrationsView: 'integrations.view',
  integrationsManage: 'integrations.manage',
  reportsView: 'reports.view',
  membersView: 'members.view',
  membersManage: 'members.manage',
  settingsManage: 'settings.manage',
  billingManage: 'billing.manage',
  auditView: 'audit.view',
} as const

export type Permission = (typeof P)[keyof typeof P]

const ALL = Object.values(P) as Permission[]

// Default role matrix (PRD §8). Organizations may later narrow these, never widen them.
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  platform_admin: ALL,
  owner: ALL,
  admin: ALL.filter((p) => p !== P.billingManage),
  sales_manager: [
    P.leadsViewAll, P.leadsViewOwn, P.leadsCreate, P.leadsUpdate, P.leadsAssign, P.leadsImport, P.leadsExport,
    P.tasksViewAll, P.tasksManage, P.automationsView, P.integrationsView, P.reportsView, P.membersView,
  ],
  sales_agent: [P.leadsViewOwn, P.leadsCreate, P.leadsUpdate, P.tasksManage],
  analyst: [P.leadsViewAll, P.automationsView, P.integrationsView, P.reportsView, P.membersView],
}

export const ASSIGNABLE_ROLES: RoleKey[] = ['owner', 'admin', 'sales_manager', 'sales_agent', 'analyst']

// Grouped for the read-only permission matrix in Settings → Roles
export const PERMISSION_GROUPS: Array<{ key: string; permissions: Permission[] }> = [
  { key: 'leads', permissions: [P.leadsViewAll, P.leadsViewOwn, P.leadsCreate, P.leadsUpdate, P.leadsDelete, P.leadsAssign, P.leadsImport, P.leadsExport] },
  { key: 'pipeline', permissions: [P.pipelineManage, P.tasksViewAll, P.tasksManage] },
  { key: 'automation', permissions: [P.automationsView, P.automationsManage, P.integrationsView, P.integrationsManage] },
  { key: 'insights', permissions: [P.reportsView, P.auditView] },
  { key: 'organization', permissions: [P.membersView, P.membersManage, P.settingsManage, P.billingManage] },
]
