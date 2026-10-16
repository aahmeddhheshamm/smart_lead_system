import { P } from "@/config/permissions";

export default [
    {
        path: 'pipeline',
        name: 'pipeline',
        component: () => import('./Index.vue'),
        meta: { title: 'Pipeline', permission: [P.leadsViewAll, P.leadsViewOwn] },
    },
]
