import { getCached, setCached } from './cache'

export type OpenDotaHeroStats = {
  id: number
  name: string
  localized_name: string
  roles?: string[]
}

export type OpenDotaMatchupRow = {
  hero_id: number
  games_played: number
  wins: number
}

type FetchJsonOptions = {
  cacheKey: string
  ttlMs: number
  retries?: number
  minDelayMs?: number
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const cached = getCached<T>(opts.cacheKey)
  if (cached) return cached

  const retries = opts.retries ?? 2
  const minDelayMs = opts.minDelayMs ?? 350

  let lastErr: unknown = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        // OpenDota returns 429 on rate limit.
        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599)
        const msg = `OpenDota error: ${res.status}`
        if (!retryable) throw new Error(msg)
        throw new RetryableHttpError(msg, res.status)
      }

      const data = (await res.json()) as T
      setCached(opts.cacheKey, data, opts.ttlMs)
      return data
    } catch (e) {
      lastErr = e
      const isRetryable = e instanceof RetryableHttpError
      if (attempt >= retries || !isRetryable) break
      const backoff = minDelayMs * Math.pow(2, attempt)
      await sleep(backoff)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('OpenDota request failed')
}

class RetryableHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function fetchOpenDotaHeroStats(): Promise<OpenDotaHeroStats[]> {
  return fetchJson<OpenDotaHeroStats[]>('https://api.opendota.com/api/heroStats', {
    cacheKey: 'opendota:heroStats:v1',
    ttlMs: 1000 * 60 * 60 * 12, // 12h
  })
}

export async function fetchHeroMatchups(heroId: number): Promise<OpenDotaMatchupRow[]> {
  return fetchJson<OpenDotaMatchupRow[]>(`https://api.opendota.com/api/heroes/${heroId}/matchups`, {
    cacheKey: `opendota:heroMatchups:v1:${heroId}`,
    ttlMs: 1000 * 60 * 60 * 24, // 24h
    retries: 2,
    minDelayMs: 400,
  })
}
