/**
 * Usage
 * const { data, isLoading, ...args }  = useFetch({
    queryKey: ['key'],
    queryFn: AsyncFunction,
  })
 */

import type { TypeResponseError } from '../types/types.ts'
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'

type Options<T> = {
  queryKey: MaybeRefOrGetter<QueryKey>
  queryFn: () => Promise<T>
  enabled?: MaybeRefOrGetter<boolean | undefined>
  options?: any
}

export default function useFetch<T>({ queryFn, queryKey, enabled, options = {} }: Options<T>) {
  return useQuery<T, TypeResponseError>({
    queryKey: queryKey,
    queryFn,
    placeholderData: keepPreviousData,
    retry: false,
    enabled: enabled,
    ...options
  })
}
