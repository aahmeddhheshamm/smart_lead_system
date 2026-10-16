import 'moment/locale/ar'
import moment from 'moment/moment'
import { useLocaleSettings } from '@/composables/useLocaleSettings.ts'

export function changeDateFormat(data: any, format: string = 'lll'): string {
  const { locale } = useLocaleSettings()
  if (data) return moment(data).locale(locale.value.toLowerCase()).format(format)
  return '—'
}

// "5 minutes ago" / "in 2 hours" in the active language
export function fromNow(data: any): string {
  const { locale } = useLocaleSettings()
  return data ? moment(data).locale(locale.value.toLowerCase()).fromNow() : '—'
}

export function isOverdue(iso?: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now()
}

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  if (h < 48) return `${h}h ${Math.round(minutes % 60)}m`
  return `${Math.round(h / 24)}d`
}

export function formateNumbers(number: number) {
  return number.toLocaleString('en-US', { maximumFractionDigits: 1, notation: 'compact', compactDisplay: 'short' })
}

export function formatMoney(value: any, currency = '') {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}${currency ? ` ${currency}` : ''}`
}

export const toIsoDate = (d: Date | string | null | undefined) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

type QueryValue = string | number | boolean | null | undefined

const isEmptyQueryValue = (value: unknown) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)

// Builds list query params in the API's shape (docs/API.md → Lists): every filter is a
// top-level param, arrays are comma-joined, and empty values are dropped so an unset
// filter never narrows the list to "matches empty string".
export function buildListParams(
  params: Record<string, QueryValue> = {},
  filters: Record<string, QueryValue | QueryValue[]> = {}
): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  for (const [key, value] of Object.entries({ ...params, ...filters })) {
    if (isEmptyQueryValue(value)) continue
    if (Array.isArray(value)) query[key] = value.join(',')
    else if ((value as any) instanceof Date) query[key] = toIsoDate(value as any)
    else query[key] = typeof value === 'boolean' ? Number(value) : (value as string | number)
  }
  return query
}

export function countActiveParams(...groups: Record<string, any>[]): number {
  const isActive = (v: any): boolean =>
    v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? Object.values(v).some(isActive) : !isEmptyQueryValue(v)
  return groups.reduce((count, group) => count + Object.values(group ?? {}).filter(isActive).length, 0)
}

// RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Returns header + row objects.
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',' || c === ';') { record.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      if (record.some((v) => v.trim() !== '')) records.push(record)
      record = []
      field = ''
    } else field += c
  }
  record.push(field)
  if (record.some((v) => v.trim() !== '')) records.push(record)

  const [header = [], ...body] = records
  const columns = header.map((h, i) => h.trim() || `column_${i + 1}`)
  return { columns, rows: body.map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? '').trim()]))) }
}
