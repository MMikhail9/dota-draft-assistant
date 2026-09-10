import type { DraftState, Recommendation } from '../domain/types'
import type { DatasetSlice, StatsProvider } from './StatsProvider'
import type { HeroCatalog } from './HeroCatalog'
import { fetchHeroMatchups, type OpenDotaMatchupRow } from './opendota'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function winrate(games: number, wins: number): number {
  if (games <= 0) return 0.5
  return wins / games
}

function confidenceFromSample(sample: number): 'high' | 'medium' | 'low' {
  if (sample >= 600) return 'high'
  if (sample >= 200) return 'medium'
  return 'low'
}

function roleFitScore(roles: string[], pos: number): number {
  // Very approximate mapping for MVP.
  const want =
    pos === 1
      ? ['Carry']
      : pos === 2
        ? ['Nuker', 'Carry', 'Escape']
        : pos === 3
          ? ['Initiator', 'Durable', 'Disabler']
          : pos === 4
            ? ['Support', 'Disabler', 'Initiator']
            : ['Support', 'Disabler', 'Healer']

  const hits = want.filter((r) => roles.includes(r)).length
  return hits / want.length
}

type EnemyCounterDetail = {
  enemyShortId: string
  enemyName: string
  games: number
  candidateWinrate: number // estimated candidate winrate vs enemy
  delta: number // candidate wr - 0.5
}

export class OpenDotaProvider implements StatsProvider {
  constructor(private catalog: HeroCatalog) {}

  async getRecommendations(draft: DraftState, slice: DatasetSlice): Promise<Recommendation[]> {
    const excluded = new Set([...draft.allies, ...draft.enemies])

    const enemyTables: Record<string, OpenDotaMatchupRow[]> = {}
    for (const e of draft.enemies) {
      const hero = this.catalog.byShortId.get(e)
      if (!hero) continue
      enemyTables[e] = await fetchHeroMatchups(hero.numericId)
    }

    const candidates = this.catalog.heroes
      .filter((h) => !excluded.has(h.shortId))
      .slice(0, 100)

    const recs: Recommendation[] = candidates.map((c, idx) => {
      let counterScore = 0
      let counterGames = 0
      const details: EnemyCounterDetail[] = []

      for (const enemyShortId of draft.enemies) {
        const rows = enemyTables[enemyShortId]
        if (!rows) continue

        const row = rows.find((r) => r.hero_id === c.numericId)
        if (!row) continue

        const wrEnemyVsCandidate = winrate(row.games_played, row.wins)
        const wrCandidateVsEnemy = 1 - wrEnemyVsCandidate
        const delta = wrCandidateVsEnemy - 0.5

        counterScore += delta
        counterGames += row.games_played

        const enemyHero = this.catalog.byShortId.get(enemyShortId)
        details.push({
          enemyShortId,
          enemyName: enemyHero?.name ?? enemyShortId,
          games: row.games_played,
          candidateWinrate: wrCandidateVsEnemy,
          delta,
        })
      }

      details.sort((a, b) => b.delta - a.delta)
      const best = details.slice(0, 2)

      const roleFit = roleFitScore(c.roles, draft.role)

      // Normalize to a 0..100-ish score.
      const score =
        60 +
        clamp(counterScore * 110, -35, 35) +
        clamp((roleFit - 0.5) * 30, -15, 15) -
        idx * 0.03

      const sampleSize = counterGames

      const bestStr =
        best.length === 0
          ? 'No matchup rows for selected enemies'
          : best
              .map(
                (b) =>
                  `${b.enemyName}: ${Math.round(b.candidateWinrate * 100)}% (Δ${Math.round(b.delta * 1000) / 10}%, games=${b.games})`,
              )
              .join('; ')

      return {
        heroId: c.shortId,
        heroName: c.name,
        score: Math.round(score * 10) / 10,
        confidence: confidenceFromSample(sampleSize),
        sampleSize,
        explanations: [
          {
            label: 'Top counters (est.)',
            value: bestStr,
            evidence: 'Computed from enemy matchup tables (OpenDota)',
          },
          {
            label: 'Role fit (approx)',
            value: `${Math.round(roleFit * 100)}%`,
            evidence: c.roles.length ? c.roles.join(', ') : 'No roles data',
          },
          {
            label: 'Total matchup sample',
            value: `${counterGames} games`,
          },
          {
            label: 'Slice',
            value: JSON.stringify(slice),
          },
        ],
      }
    })

    return recs
  }
}
