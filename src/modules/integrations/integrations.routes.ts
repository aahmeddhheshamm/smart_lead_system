import { P } from "@/config/permissions";

export default [
    {
        path: 'integrations',
        name: 'integrations',
        component: () => import('./Index.vue'),
        meta: { title: 'Integrations', permission: P.integrationsView },
    },
]
