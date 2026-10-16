import { defineStore } from 'pinia'
import type { CurrentUser, Membership, MeResponse, Organization } from '@/types/domain'
import { apiLogout, getMe } from '@/modules/auth/api'

interface AuthState {
  token: string | null
  user: CurrentUser | null
  organization: Organization | null
  membership: Membership | null
  loaded: boolean
}

export const useAuthStore = defineStore('authUser', {
  state: (): AuthState => ({
    token: localStorage.getItem('token'),
    user: null,
    organization: null,
    membership: null,
    loaded: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    username: (state) => state.user?.name ?? '',
    userId: (state) => state.user?.id,
    role: (state) => state.membership?.role,
    permissions: (state) => state.membership?.permissions ?? [],
    // anyOf: true when the member holds at least one of the given permissions
    can: (state) => (...anyOf: string[]) =>
      !anyOf.length || anyOf.some((p) => (state.membership?.permissions ?? []).includes(p)),
  },

  actions: {
    setSession(res: { token?: string } & MeResponse) {
      if (res.token) {
        this.token = res.token
        localStorage.setItem('token', res.token)
      }
      this.setMe(res)
    },

    setMe(me: MeResponse) {
      this.user = me.user
      this.organization = me.organization
      this.membership = me.membership
      this.loaded = true
    },

    // Loads /auth/me once per page load; the router guard awaits it before permission checks
    async isAuth() {
      if (this.loaded) return true
      try {
        const res = await getMe()
        this.setMe(res.data)
        return true
      } catch {
        return false
      }
    },

    async logout() {
      try {
        await apiLogout()
      } catch {
        // an expired/revoked session still logs out locally
      } finally {
        this.clearAuth()
      }
    },

    clearAuth() {
      this.token = null
      this.user = null
      this.organization = null
      this.membership = null
      this.loaded = false
      localStorage.removeItem('token')
      this.$router?.push({ name: 'login' })
    },
  },
})
