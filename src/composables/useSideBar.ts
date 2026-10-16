import { computed } from 'vue'
import { useAuthStore } from '@/store/auth.ts'
import { P } from '@/config/permissions'

// Iconify (lucide) icon per sidebar entry
export const icons: Record<string, string> = {
  DashboardIcon: 'lucide:layout-dashboard',
  LeadsIcon: 'lucide:users',
  PipelineIcon: 'lucide:square-kanban',
  TasksIcon: 'lucide:calendar-check',
  AutomationsIcon: 'lucide:workflow',
  RunsIcon: 'lucide:activity',
  IntegrationsIcon: 'lucide:plug',
  ReportsIcon: 'lucide:bar-chart-3',
  NotificationsIcon: 'lucide:bell',
  SettingsIcon: 'lucide:settings',
}

export const sidebarGroups = ['sales', 'automation', 'insights', 'administration'] as const

const items = [
  { title: 'dashboard', icon: 'DashboardIcon', routeName: 'dashboard' },

  { title: 'leads', icon: 'LeadsIcon', routeName: 'leads', group: 'sales', permission: [P.leadsViewAll, P.leadsViewOwn] },
  { title: 'pipeline', icon: 'PipelineIcon', routeName: 'pipeline', group: 'sales', permission: [P.leadsViewAll, P.leadsViewOwn] },
  { title: 'tasks', icon: 'TasksIcon', routeName: 'tasks', group: 'sales', permission: [P.tasksManage, P.tasksViewAll] },

  { title: 'automations', icon: 'AutomationsIcon', routeName: 'automations', group: 'automation', permission: [P.automationsView] },
  { title: 'automationRuns', icon: 'RunsIcon', routeName: 'automationRuns', group: 'automation', permission: [P.automationsView] },
  { title: 'integrations', icon: 'IntegrationsIcon', routeName: 'integrations', group: 'automation', permission: [P.integrationsView] },

  { title: 'reports', icon: 'ReportsIcon', routeName: 'reports', group: 'insights', permission: [P.reportsView] },

  { title: 'notifications', icon: 'NotificationsIcon', routeName: 'notifications', group: 'administration' },
  { title: 'settings', icon: 'SettingsIcon', routeName: 'settings', group: 'administration' },
] as Array<{ title: string; icon: string; routeName: string; group?: string; permission?: string[]; children?: any[]; badge?: number }>

// Entries the current member can open; the router enforces the same permissions
export const sidebarItems = computed(() => {
  const auth = useAuthStore()
  return items.filter((item) => !item.permission || auth.can(...item.permission))
})
