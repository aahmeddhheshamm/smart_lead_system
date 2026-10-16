import { P } from "@/config/permissions";

export default [
    {
        path: 'reports',
        name: 'reports',
        component: () => import('./Index.vue'),
        meta: { title: 'Reports', permission: P.reportsView },
    },
]
