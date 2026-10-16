import dashboardRoutes from "./dashboard/dashboard.routes.ts";
import onboardingRoutes from "./onboarding/onboarding.routes.ts";
import leadsRoutes from "./leads/leads.routes.ts";
import pipelineRoutes from "./pipeline/pipeline.routes.ts";
import tasksRoutes from "./tasks/tasks.routes.ts";
import automationsRoutes from "./automations/automations.routes.ts";
import integrationsRoutes from "./integrations/integrations.routes.ts";
import reportsRoutes from "./reports/reports.routes.ts";
import notificationsRoutes from "./notifications/notifications.routes.ts";
import settingsRoutes from "./settings/settings.routes.ts";
import profileRoutes from "./profile/profile.routes.ts";

export default [
    {
        path: '/',
        redirect: { name: 'dashboard' },
        component: () => import('../layouts/dashboard/index.vue'),
        children: [
            ...dashboardRoutes,
            ...leadsRoutes,
            ...pipelineRoutes,
            ...tasksRoutes,
            ...automationsRoutes,
            ...integrationsRoutes,
            ...reportsRoutes,
            ...notificationsRoutes,
            ...settingsRoutes,
            ...profileRoutes,
            {
                path: 'forbidden',
                name: 'forbidden',
                component: () => import('../Forbidden.vue'),
                meta: { title: 'Access denied' },
            },
        ],
    },
    ...onboardingRoutes,
    {
        path: '/:pathMatch(.*)*',
        name: 'notfound',
        component: () => import('../NotFound.vue'),
        meta: { title: 'Not found' },
    },
];
