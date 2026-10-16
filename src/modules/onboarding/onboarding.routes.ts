import { P } from "@/config/permissions";

// Full-screen wizard outside the dashboard shell
export default [
    {
        path: '/onboarding',
        name: 'onboarding',
        component: () => import('./Index.vue'),
        meta: { title: 'Set up your workspace', permission: P.settingsManage },
    },
]
