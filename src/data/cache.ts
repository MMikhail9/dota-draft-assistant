type CacheEntry<T> = {
  v: T
  expiresAt: number
}

const mem = new Map<string, CacheEntry<any>>()

export function getCached<T>(key: string): T | null {
  const now = Date.now()

  const m = mem.get(key)
  if (m && m.expiresAt > now) return m.v as T

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (parsed.expiresAt <= now) {
      localStorage.removeItem(key)
      return null
    }
    mem.set(key, parsed)
    return parsed.v
  } catch {
    return null
  }
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  const entry: CacheEntry<T> = { v: value, expiresAt: Date.now() + ttlMs }
  mem.set(key, entry)
  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // ignore quota errors
  }
}
