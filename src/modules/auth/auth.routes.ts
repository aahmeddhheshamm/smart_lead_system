export default [
  {
    path: '/auth',
    redirect: { name: 'login' },
    component: () => import('@/layouts/auth/Index.vue'),
    children: [
      {
        path: '/login',
        name: 'login',
        component: () => import('./login/Index.vue'),
        meta: { title: 'Sign in', guestOnly: true },
      },
      {
        path: '/register',
        name: 'register',
        component: () => import('./register/Index.vue'),
        meta: { title: 'Create your workspace', guestOnly: true },
      },
      {
        path: '/forget-password',
        name: 'forgetPassword',
        component: () => import('./forgetPassword/Index.vue'),
        meta: { title: 'Forgot password', guestOnly: true },
      },
      {
        path: '/reset-password',
        name: 'resetPassword',
        component: () => import('./resetPassword/Index.vue'),
        meta: { title: 'Reset password', guestOnly: true },
      },
      {
        // reachable signed in or out: an existing user may accept a second organization
        path: '/invite/:token',
        name: 'acceptInvite',
        component: () => import('./acceptInvite/Index.vue'),
        meta: { title: 'Join your team', public: true },
      },
      {
        path: '/accept-invite',
        alias: ['/invitations/accept'],
        name: 'acceptInviteQuery',
        component: () => import('./acceptInvite/Index.vue'),
        meta: { title: 'Join your team', public: true },
      },
      {
        path: '/verify-email',
        name: 'verifyEmail',
        component: () => import('./verifyEmail/Index.vue'),
        meta: { title: 'Verify email', public: true },
      },
    ],
  },
]
