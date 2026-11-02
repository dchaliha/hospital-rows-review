import { useEffect, useRef } from 'react'

export type KeyHandler = (key: string, e: KeyboardEvent) => void

/** Global single-key shortcuts. Ignored while typing in a field; Escape in a field blurs it. */
export function useKeyboard(handler: KeyHandler, enabled = true): void {
  const ref = useRef(handler)
  useEffect(() => { ref.current = handler })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (typing) { if (e.key === 'Escape') t.blur(); return }
      ref.current(e.key.length === 1 ? e.key.toLowerCase() : e.key, e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
