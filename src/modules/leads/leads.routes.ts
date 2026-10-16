import { P } from "@/config/permissions";

export default [
    {
        path: 'leads',
        name: 'leads',
        component: () => import('./Index.vue'),
        meta: { title: 'Leads', permission: [P.leadsViewAll, P.leadsViewOwn] },
    },
    {
        path: 'leads/:id',
        name: 'leadDetails',
        component: () => import('./LeadDetails.vue'),
        meta: { title: 'Lead', permission: [P.leadsViewAll, P.leadsViewOwn] },
    },
]
