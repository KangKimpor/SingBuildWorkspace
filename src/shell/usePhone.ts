import { useMediaQuery } from '@/lib/media'

/** Phone means a viewport below 768 px, the same switch as the shell breakpoint and the NBC styles. */
export const PHONE_QUERY = '(max-width: 767px)'

export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY)
}
