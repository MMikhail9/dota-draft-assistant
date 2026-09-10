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
    ttlMs: 1000 * 60 * 60 * 12,
  })
}

export async function fetchHeroMatchups(heroId: number): Promise<OpenDotaMatchupRow[]> {
  return fetchJson<OpenDotaMatchupRow[]>(`https://api.opendota.com/api/heroes/${heroId}/matchups`, {
    cacheKey: `opendota:heroMatchups:v1:${heroId}`,
    ttlMs: 1000 * 60 * 60 * 24,
    retries: 2,
    minDelayMs: 400,
  })
}

// OpenDota Explorer provides SQL access to public match data.
// We'll use it to estimate co-play (synergy) for a hero pair.
export type OpenDotaExplorerResult = {
  rows: Array<Record<string, string | number | null>>
}

export async function fetchSynergyWinrate(params: {
  heroA: number
  heroB: number
}): Promise<{ games: number; winrate: number } | null> {
  const { heroA, heroB } = params

  // We query matches where both heroes are on the same team.
  // This is a lightweight MVP query and may be sampled/limited by OpenDota.
  const sql = `
SELECT
  COUNT(*) AS games,
  AVG(CASE WHEN (m.radiant_win = (pmA.player_slot < 128)) THEN 1.0 ELSE 0.0 END) AS winrate
FROM public_matches m
JOIN public_player_matches pmA ON pmA.match_id = m.match_id
JOIN public_player_matches pmB ON pmB.match_id = m.match_id
WHERE pmA.hero_id = ${heroA}
  AND pmB.hero_id = ${heroB}
  AND (pmA.player_slot < 128) = (pmB.player_slot < 128)
LIMIT 1
`.trim()

  const url = `https://api.opendota.com/api/explorer?sql=${encodeURIComponent(sql)}`
  const res = await fetchJson<OpenDotaExplorerResult>(url, {
    cacheKey: `opendota:synergy:v1:${heroA}:${heroB}`,
    ttlMs: 1000 * 60 * 60 * 24,
    retries: 2,
    minDelayMs: 500,
  })

  const row = res.rows[0]
  if (!row) return null

  const games = Number(row.games ?? 0)
  const winrate = Number(row.winrate ?? NaN)
  if (!Number.isFinite(winrate) || games <= 0) return null

  return { games, winrate }
}
