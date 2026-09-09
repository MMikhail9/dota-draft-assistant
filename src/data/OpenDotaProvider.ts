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

export class OpenDotaProvider implements StatsProvider {
  constructor(private catalog: HeroCatalog) {}

  async getRecommendations(draft: DraftState, slice: DatasetSlice): Promise<Recommendation[]> {
    const excluded = new Set([...draft.allies, ...draft.enemies])

    // Use enemy matchups to estimate how good a candidate is vs those enemies.
    // We invert enemy-vs-candidate advantage.
    const enemyTables: Record<string, OpenDotaMatchupRow[]> = {}
    for (const e of draft.enemies) {
      const hero = this.catalog.byShortId.get(e)
      if (!hero) continue
      enemyTables[e] = await fetchHeroMatchups(hero.numericId)
    }

    const candidates = this.catalog.heroes
      .filter((h) => !excluded.has(h.shortId))
      .slice(0, 80) // MVP: cap candidate set for performance

    const recs: Recommendation[] = candidates.map((c, idx) => {
      let counterScore = 0
      let counterGames = 0

      for (const enemyShortId of draft.enemies) {
        const rows = enemyTables[enemyShortId]
        if (!rows) continue
        const candidateNumeric = c.numericId
        const row = rows.find((r) => r.hero_id === candidateNumeric)
        if (!row) continue

        const wrEnemyVsCandidate = winrate(row.games_played, row.wins)
        const advEnemy = wrEnemyVsCandidate - 0.5

        // If enemy is advantaged, candidate is disadvantaged and vice versa.
        counterScore += -advEnemy
        counterGames += row.games_played
      }

      const roleFit = roleFitScore(c.roles, draft.role)

      // Normalize to a 0..100-ish score.
      const score =
        60 +
        clamp(counterScore * 120, -30, 30) +
        clamp((roleFit - 0.5) * 30, -15, 15) -
        idx * 0.05

      const sampleSize = counterGames

      return {
        heroId: c.shortId,
        heroName: c.name,
        score: Math.round(score * 10) / 10,
        confidence: confidenceFromSample(sampleSize),
        sampleSize,
        explanations: [
          {
            label: 'Role fit (approx)',
            value: `${Math.round(roleFit * 100)}%`,
            evidence: c.roles.length ? c.roles.join(', ') : 'No roles data',
          },
          {
            label: 'Vs selected enemies',
            value: `${Math.round(counterScore * 1000) / 10}% net`,
            evidence: `Based on enemy matchup tables; games=${counterGames}`,
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
