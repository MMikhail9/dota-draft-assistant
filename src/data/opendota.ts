import { getCached, setCached } from './cache'

export type OpenDotaHeroStats = {
  id: number
  name: string
  localized_name: string
  roles?: string[]
  pro_pick?: number
  pro_win?: number
  '1_pick'?: number
  '1_win'?: number
  '2_pick'?: number
  '2_win'?: number
  '3_pick'?: number
  '3_win'?: number
  '4_pick'?: number
  '4_win'?: number
  '5_pick'?: number
  '5_win'?: number
}

export type OpenDotaMatchupRow = {
  hero_id: number
  games_played: number
  wins: number
}

async function fetchJson<T>(url: string, cacheKey: string, ttlMs: number): Promise<T> {
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OpenDota error: ${res.status}`)
  }
  const data = (await res.json()) as T
  setCached(cacheKey, data, ttlMs)
  return data
}

export async function fetchOpenDotaHeroStats(): Promise<OpenDotaHeroStats[]> {
  return fetchJson<OpenDotaHeroStats[]>(
    'https://api.opendota.com/api/heroStats',
    'opendota:heroStats:v1',
    1000 * 60 * 60 * 12, // 12h
  )
}

export async function fetchHeroMatchups(heroId: number): Promise<OpenDotaMatchupRow[]> {
  return fetchJson<OpenDotaMatchupRow[]>(
    `https://api.opendota.com/api/heroes/${heroId}/matchups`,
    `opendota:heroMatchups:v1:${heroId}`,
    1000 * 60 * 60 * 24, // 24h
  )
}
