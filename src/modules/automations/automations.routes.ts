import { P } from "@/config/permissions";

export default [
    {
        path: 'automations',
        name: 'automations',
        component: () => import('./Index.vue'),
        meta: { title: 'Automations', permission: P.automationsView },
    },
    {
        path: 'automation-runs',
        name: 'automationRuns',
        component: () => import('./Runs.vue'),
        meta: { title: 'Execution logs', permission: P.automationsView },
    },
]
