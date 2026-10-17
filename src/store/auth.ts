import { defineStore } from 'pinia'
import type { CurrentUser, Membership, MeResponse, Organization, OrganizationRef } from '@/types/domain'
import { STORAGE } from '@/InterceptorHelper'
import { apiLogout, apiSwitchOrganization, getMe } from '@/modules/auth/api'

interface AuthState {
  token: string | null
  user: CurrentUser | null
  organization: Organization | null
  membership: Membership | null
  organizations: OrganizationRef[]
  loaded: boolean
}

export const useAuthStore = defineStore('authUser', {
  state: (): AuthState => ({
    token: localStorage.getItem(STORAGE.token),
    user: null,
    organization: null,
    membership: null,
    organizations: [],
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
    // The backend adapter has already stored the JWT pair; the mock hands back a `token`
    setSession(res: { token?: string } & MeResponse) {
      if (res.token) localStorage.setItem(STORAGE.token, res.token)
      this.token = localStorage.getItem(STORAGE.token)
      this.setMe(res)
    },

    setMe(me: MeResponse) {
      this.user = me.user
      this.organization = me.organization
      this.membership = me.membership
      this.organizations = me.organizations ?? []
      this.loaded = true
    },

    // Loads the session once per page load; the router guard awaits it before permission checks
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

    // Re-scopes every request to another organization (X-Organization-ID) and reloads the app state
    async switchOrganization(id: string) {
      const res = await apiSwitchOrganization(id)
      this.setMe(res.data)
      window.location.assign('/dashboard')
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
      this.organizations = []
      this.loaded = false
      localStorage.removeItem(STORAGE.token)
      localStorage.removeItem(STORAGE.refresh)
      this.$router?.push({ name: 'login' })
    },
  },
})
