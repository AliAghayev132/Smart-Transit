import { useEffect, useRef } from 'react'

const isTyping = (e) => {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/**
 * Qlobal klaviatura qısa yolları. map: { 'j': fn, '?': fn, 'Escape': fn, ... }
 * Input/textarea daxilində yazarkən işləmir (Escape istisna).
 */
export const useKeyboardShortcuts = (map, enabled = true) => {
  const ref = useRef(map)
  useEffect(() => {
    ref.current = map
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e) && e.key !== 'Escape') return
      const fn = ref.current[e.key] || ref.current[e.key.toLowerCase()]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

export default useKeyboardShortcuts
