export default [
    {
        // each tab checks its own permission; the page itself is open to every member
        path: 'settings/:tab?',
        name: 'settings',
        component: () => import('./Index.vue'),
        meta: { title: 'Settings' },
    },
]
