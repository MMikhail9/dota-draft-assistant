import { useEffect } from 'react'

export function useDebouncedEffect(effect: () => void, delayMs: number, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = window.setTimeout(() => effect(), delayMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
