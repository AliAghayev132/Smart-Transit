import { useSyncExternalStore } from 'react'

/** CSS media query vəziyyəti (məs. '(min-width: 1024px)') */
export const useMediaQuery = (query) =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
