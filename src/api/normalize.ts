// Helpers that turn LeadFlow backend envelopes into predictable shapes.
// Documented responses (OpenAPI) are `{ data, pagination }` / `{ data }`; a few endpoints
// are undocumented, so these helpers also accept DRF-style `{ results, count }` and bare values.

import type { Pagination } from '@/types/domain'

export const unwrap = <T = any>(res: any): T => (res && typeof res === 'object' && 'data' in res ? res.data : res)

export function asArray<T = any>(value: any, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    for (const key of [...keys, 'data', 'results', 'items']) {
      if (Array.isArray(value[key])) return value[key]
    }
  }
  return []
}

export function page<T>(res: any, map: (row: any) => T, query: { page?: number; pageSize?: number } = {}) {
  const rows = asArray(res)
  const p = res?.pagination ?? res?.meta ?? {}
  const pageSize = Number(p.pageSize ?? p.page_size ?? query.pageSize ?? rows.length) || rows.length || 20
  const total = Number(p.total ?? p.count ?? res?.count ?? rows.length) || 0
  const pagination: Pagination = {
    page: Number(p.page ?? query.page ?? 1) || 1,
    pageSize,
    total,
    totalPages: Number(p.totalPages ?? p.total_pages ?? Math.max(1, Math.ceil(total / pageSize))) || 1,
  }
  return { data: rows.map(map), pagination }
}

// first defined value among candidate keys (camelCase and snake_case spellings)
export function pick<T = any>(obj: any, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

export const num = (v: any, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

export const truthy = (v: any) => v === true || v === 'true' || v === 1 || v === '1'

export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

export const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 50) || `item_${Date.now().toString(36)}`

const warned = new Set<string>()

// Dev-only hint when an undocumented response doesn't look like what the mapper expects.
// Check the browser console after the first call to each screen against a new backend version.
export function expectShape(name: string, raw: any, ...keys: string[]) {
  if (!import.meta.env.DEV || warned.has(name)) return
  const obj = raw && typeof raw === 'object' ? raw : {}
  const missing = keys.filter((k) => !(k in obj))
  if (missing.length === keys.length) {
    warned.add(name)
    console.warn(`[LeadFlow API] ${name}: none of [${keys.join(', ')}] found — check the mapper in src/api/backend.ts`, raw)
  }
}
