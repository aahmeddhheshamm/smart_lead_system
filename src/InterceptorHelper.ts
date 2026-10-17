import { toast } from 'vue3-toastify'
import { useAuthStore } from '@/store/auth.ts'
import i18n from '@/plugins/i18n.ts'

// Extra per-call options on top of fetch's RequestInit
export type RequestOptions = RequestInit & {
  // Suppress the automatic error toast (caller renders the error itself)
  silent?: boolean
  // Sent as Idempotency-Key so a retried write is applied once
  idempotencyKey?: string
  // Internal: set on the single retry after a token refresh
  _retried?: boolean
}

// import.meta.env only exists under Vite; tests run these modules in plain Node
export const ENV: Record<string, any> = (import.meta as any).env ?? {}

export const USE_MOCK = ENV.VITE_USE_MOCK === 'true'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

// Session keys in localStorage (access token, rotating refresh token, active tenant)
export const STORAGE = { token: 'token', refresh: 'refreshToken', org: 'orgId' } as const

// Endpoints that must never trigger a token refresh / retry loop
const AUTH_PATHS = ['auth/login', 'auth/register', 'auth/refresh', 'auth/password/reset', 'invitations/accept', 'invitations/lookup']

let refreshing: Promise<boolean> | null = null

export default class InterceptorHelper {
  static baseUrl: string = ENV.VITE_APP_API_URL || 'http://localhost:8000/api/v1/'

  static async interceptRequest(options: RequestOptions = {}): Promise<RequestInit> {
    const token = localStorage.getItem(STORAGE.token)
    const orgId = localStorage.getItem(STORAGE.org)
    const lang = localStorage.getItem('locale')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': lang ? lang.toLowerCase() : 'en',
      'X-Request-Id': newId(),
      ...(options.headers as Record<string, string>),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    // tenant context for every organization-scoped endpoint (the API re-checks membership)
    if (orgId && !headers['X-Organization-ID']) headers['X-Organization-ID'] = orgId
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

    const { silent, idempotencyKey, _retried, ...init } = options

    if (init.body instanceof FormData) {
      delete headers['Content-Type']
    } else if (init.body && typeof init.body === 'object') {
      init.body = JSON.stringify(init.body)
    }

    // JWT in the Authorization header — no cookies, so the API's `*` CORS policy works
    return { ...init, headers, credentials: 'omit' }
  }

  // Exchanges the refresh token for a new pair (rotation). One refresh at a time for all callers.
  static refreshSession(): Promise<boolean> {
    if (refreshing) return refreshing
    const refresh = localStorage.getItem(STORAGE.refresh)
    if (!refresh || USE_MOCK) return Promise.resolve(false)
    refreshing = (async () => {
      try {
        const res = await fetch(InterceptorHelper.buildUrl('auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh }),
        })
        if (!res.ok) return false
        const json = await res.json()
        const tokens = json?.data?.tokens ?? json?.tokens ?? json?.data ?? {}
        if (!tokens.access) return false
        localStorage.setItem(STORAGE.token, tokens.access)
        if (tokens.refresh) localStorage.setItem(STORAGE.refresh, tokens.refresh)
        return true
      } catch {
        return false
      } finally {
        setTimeout(() => (refreshing = null), 0)
      }
    })()
    return refreshing
  }

  static async interceptResponse(response: Response, options: RequestOptions = {}): Promise<any> {
    if (response.status === 204) return {}

    const contentType = response.headers.get('Content-Type') || ''
    if (!contentType.includes('application/json')) {
      if (!response.ok) {
        if (!options.silent) toast.error(`${i18n.global.t('messages.error')} (${response.status})`)
        return Promise.reject({ error: { code: 'http_error', message: response.statusText } })
      }
      return await response.blob()
    }

    const json = await response.json()
    if (response.ok) return json

    const error = json?.error ?? {
      code: 'unknown',
      message: json?.detail || json?.message || i18n.global.t('messages.error'),
      details: json?.detail ? undefined : json,
    }

    if (response.status === 401) {
      if (localStorage.getItem(STORAGE.token)) {
        toast.error(i18n.global.t('messages.sessionExpired'))
        useAuthStore().clearAuth()
      } else if (!options.silent) {
        toast.error(error.message)
      }
      return Promise.reject({ error })
    }

    if (!options.silent) {
      const details = error.details
      const first = Array.isArray(details)
        ? details[0]?.message ?? details[0]
        : details && typeof details === 'object'
          ? ([] as any[]).concat(Object.values(details)[0] ?? [])[0]
          : null
      const ref = error.requestId ? ` (${i18n.global.t('messages.reference')}: ${String(error.requestId).slice(0, 12)})` : ''
      toast.error(`${typeof first === 'string' ? first : error.message}${response.status >= 500 ? ref : ''}`)
    }

    return Promise.reject({ error, status: response.status })
  }

  static buildUrl(url: string, queryParams: Record<string, string | number> = {}) {
    const query = Object.keys(queryParams)
      .filter((key) => queryParams[key] !== undefined && queryParams[key] !== null && queryParams[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&')
    return `${InterceptorHelper.baseUrl}${url}${query ? `?${query}` : ''}`
  }

  static async intercept<T = any>(
    url: string,
    options: RequestOptions = {},
    queryParams: Record<string, string | number> = {}
  ): Promise<T & any> {
    const fullUrl = InterceptorHelper.buildUrl(url, queryParams)
    // keep the raw body: the retry after a refresh must serialize it again
    const original = { ...options }
    const requestOptions = await InterceptorHelper.interceptRequest(options)

    let response: Response
    if (USE_MOCK) {
      const { mockFetch } = await import('@/mock/server')
      response = await mockFetch(fullUrl, requestOptions)
    } else {
      try {
        response = await fetch(fullUrl, requestOptions)
      } catch (e) {
        if (!options.silent) toast.error(i18n.global.t('messages.networkError'))
        return Promise.reject({ error: { code: 'network_error', message: String(e) } })
      }
    }

    // expired access token → rotate once and replay the request
    if (response.status === 401 && !USE_MOCK && !options._retried && !AUTH_PATHS.some((p) => url.startsWith(p))) {
      if (await InterceptorHelper.refreshSession()) {
        return InterceptorHelper.intercept<T>(url, { ...original, _retried: true }, queryParams)
      }
    }

    return InterceptorHelper.interceptResponse(response, options)
  }

  static get<T = any>(url: string, query: Record<string, any> = {}, options: RequestOptions = {}) {
    return this.intercept<T>(url, { ...options, method: 'GET' }, query)
  }

  static post<T = any>(url: string, body?: any, options: RequestOptions = {}) {
    return this.intercept<T>(url, { ...options, method: 'POST', body })
  }

  static patch<T = any>(url: string, body?: any, options: RequestOptions = {}) {
    return this.intercept<T>(url, { ...options, method: 'PATCH', body })
  }

  static put<T = any>(url: string, body?: any, options: RequestOptions = {}) {
    return this.intercept<T>(url, { ...options, method: 'PUT', body })
  }

  static delete<T = any>(url: string, options: RequestOptions = {}) {
    return this.intercept<T>(url, { ...options, method: 'DELETE' })
  }
}
