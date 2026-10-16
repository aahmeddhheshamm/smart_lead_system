/**
 * Usage
 * const { mutate, ...args }  = useMutate({
    mutationKey: ['key'],
    mutationFn: AsyncFunction,
  })
  mutate(payload)
 */

import type { TypeResponseError } from '../types/types.ts'
import { type MutationKey, type QueryKey, useMutation, useQueryClient } from '@tanstack/vue-query'

type Options<T, V> = {
  mutationKey: MutationKey
  mutationFn: (variables: V) => Promise<T>
  queryKey?: QueryKey
}

export default function useMutate<T, V>({ mutationFn, mutationKey, queryKey }: Options<T, V>) {
  // Access the client
  const queryClient = useQueryClient()

  // mutation function
  const mutation = useMutation<T, TypeResponseError, V>({
    mutationKey,
    mutationFn,
    onSuccess() {
      if (queryKey) {
        queryClient.invalidateQueries({
          queryKey: queryKey
        })
      }
    },
    onError(err) {
      console.log('err -> ', err)
      // toast.error(err.message)
    }
  })

  return { ...mutation, queryClient }
}
