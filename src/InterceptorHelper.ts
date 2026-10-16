import { toast } from 'vue3-toastify'
import { useAuthStore } from '@/store/auth.ts'
import i18n from '@/plugins/i18n.ts'

// Extra per-call options on top of fetch's RequestInit
export type RequestOptions = RequestInit & {
  // Suppress the automatic error toast (caller renders the error itself)
  silent?: boolean
  // Sent as Idempotency-Key so a retried write is applied once (docs/API.md → Idempotency)
  idempotencyKey?: string
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export default class InterceptorHelper {
  static baseUrl: string = import.meta.env.VITE_APP_API_URL || 'http://localhost:3000/api/v1/'

  static async interceptRequest(options: RequestOptions = {}): Promise<RequestInit> {
    const token = localStorage.getItem('token')
    const lang = localStorage.getItem('locale')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': lang ? lang.toLowerCase() : 'en',
      'X-Request-Id': newId(),
      ...(options.headers as Record<string, string>),
    }
    // Production uses an HttpOnly session cookie (credentials: 'include'); the bearer
    // token is only present for API clients / the local mock that return one.
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

    const { silent, idempotencyKey, ...init } = options

    if (init.body instanceof FormData) {
      delete headers['Content-Type']
    } else if (init.body && typeof init.body === 'object') {
      init.body = JSON.stringify(init.body)
    }

    return { credentials: 'include', ...init, headers }
  }

  static async interceptResponse(response: Response, options: RequestOptions = {}): Promise<any> {
    if (response.status === 204) return {}

    const contentType = response.headers.get('Content-Type') || ''
    if (!contentType.includes('application/json')) {
      if (!response.ok) return Promise.reject({ error: { code: 'http_error', message: response.statusText } })
      return await response.blob()
    }

    const json = await response.json()
    if (response.ok) return json

    const error = json?.error ?? { code: 'unknown', message: json?.message || i18n.global.t('messages.error') }

    if (response.status === 401) {
      // only surface "session expired" for an authenticated session, not a failed login
      if (localStorage.getItem('token')) {
        toast.error(i18n.global.t('messages.sessionExpired'))
        useAuthStore().clearAuth()
      } else if (!options.silent) {
        toast.error(error.message)
      }
      return Promise.reject(json)
    }

    if (!options.silent) {
      const details = error.details
      const first = Array.isArray(details)
        ? details[0]?.message
        : details && typeof details === 'object'
          ? (Object.values(details)[0] as string[] | undefined)?.[0]
          : null
      const ref = error.requestId ? ` (${i18n.global.t('messages.reference')}: ${error.requestId.slice(0, 8)})` : ''
      toast.error(`${first || error.message}${response.status >= 500 ? ref : ''}`)
    }

    return Promise.reject(json)
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
