import { P } from "@/config/permissions";

export default [
    {
        path: 'tasks',
        name: 'tasks',
        component: () => import('./Index.vue'),
        meta: { title: 'Tasks', permission: [P.tasksManage, P.tasksViewAll] },
    },
]
