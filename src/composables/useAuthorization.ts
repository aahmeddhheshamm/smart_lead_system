import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/store/auth'

// UI-side permission checks. Hiding a button is a convenience only:
// every request is authorized again by the backend.
export function useAuthorization() {
  const authStore = useAuthStore()
  const { permissions, role } = storeToRefs(authStore)

  const can = (...anyOf: string[]) => authStore.can(...anyOf)

  return {
    can,
    hasPermission: (action: string) => can(action),
    role,
    allPermissions: permissions,
  }
}
