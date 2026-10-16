import appRoutes from '../modules/index.routes.ts'
import authRoutes from '../modules/auth/auth.routes.ts'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/auth.ts'

const router = createRouter({
  history: createWebHistory(),
  routes: [...authRoutes, ...appRoutes] as RouteRecordRaw[],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const isAuthenticated = !!(authStore.token || localStorage.getItem('token'))
  const isGuestOnly = !!to.meta.guestOnly
  const isPublic = !!to.meta.public || to.name === 'notfound'

  if (isPublic) return true

  if (!isAuthenticated && !isGuestOnly) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }

  if (isAuthenticated && isGuestOnly) return { name: 'dashboard' }

  if (isAuthenticated) {
    // permission checks need the membership, so resolve /auth/me before entering the app
    const ok = await authStore.isAuth()
    if (!ok) return { name: 'login' }

    // a brand-new organization finishes setup first
    if (!authStore.organization?.onboardingCompleted && to.name !== 'onboarding' && authStore.can('settings.manage')) {
      return { name: 'onboarding' }
    }

    const required = to.meta.permission as string | string[] | undefined
    if (required && !authStore.can(...([] as string[]).concat(required))) {
      return { name: 'forbidden' }
    }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · LeadFlow AI` : 'LeadFlow AI'
})

export default router
