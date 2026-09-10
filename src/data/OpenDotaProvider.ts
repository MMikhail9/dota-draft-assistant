import type { DraftState, Recommendation } from '../domain/types'
import type { DatasetSlice, StatsProvider } from './StatsProvider'
import type { Hero, HeroCatalog } from './HeroCatalog'
import { fetchHeroMatchups, type OpenDotaMatchupRow } from './opendota'
import { mapPool } from './pool'

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

type EnemyDetail = {
  heroShortId: string
  heroName: string
  games: number
  candidateWinrate: number
  delta: number
}

type AllyDetail = {
  heroShortId: string
  heroName: string
  score: number
  reason: string
}

function overlapCount(a: string[], b: string[]): number {
  const s = new Set(a)
  let c = 0
  for (const x of b) if (s.has(x)) c++
  return c
}

function synergyHeuristic(candidate: Hero, ally: Hero): AllyDetail {
  const c = candidate.roles
  const a = ally.roles

  const overlap = overlapCount(c, a)

  const supportish = ['Support', 'Disabler', 'Healer']
  const coreish = ['Carry', 'Nuker', 'Escape', 'Durable']

  const candSupport = overlapCount(c, supportish)
  const candCore = overlapCount(c, coreish)
  const allySupport = overlapCount(a, supportish)
  const allyCore = overlapCount(a, coreish)

  let score = 0
  const parts: string[] = []

  if (candCore > 0 && allySupport > 0) {
    score += 1.2
    parts.push('core+support')
  }
  if (candSupport > 0 && allyCore > 0) {
    score += 1.2
    parts.push('support+core')
  }

  score -= overlap * 0.25
  if (overlap > 0) parts.push(`role overlap x${overlap}`)

  return {
    heroShortId: ally.shortId,
    heroName: ally.name,
    score,
    reason: parts.length ? parts.join(', ') : 'no strong signal',
  }
}

function explainCounterRow(d: EnemyDetail): string {
  const wr = Math.round(d.candidateWinrate * 100)
  const delta = Math.round(d.delta * 1000) / 10
  return `${d.heroName}: ${wr}% (Δ${delta}%, games=${d.games})`
}

export class OpenDotaProvider implements StatsProvider {
  constructor(private catalog: HeroCatalog) {}

  async getRecommendations(draft: DraftState, slice: DatasetSlice): Promise<Recommendation[]> {
    const excluded = new Set([...draft.allies, ...draft.enemies])

    const enemiesResolved = draft.enemies
      .map((e) => ({ shortId: e, hero: this.catalog.byShortId.get(e) }))
      .filter((x) => x.hero)
      .map((x) => ({ shortId: x.shortId, hero: x.hero! }))

    const tables = await mapPool(enemiesResolved, 2, async (e) => {
      const rows = await fetchHeroMatchups(e.hero.numericId)
      return [e.shortId, rows] as const
    })

    const enemyTables: Record<string, OpenDotaMatchupRow[]> = Object.fromEntries(tables)

    const alliesResolved = draft.allies
      .map((a) => this.catalog.byShortId.get(a))
      .filter(Boolean) as Hero[]

    const candidates = this.catalog.heroes
      .filter((h) => !excluded.has(h.shortId))
      .slice(0, 100)

    const recs: Recommendation[] = candidates.map((c, idx) => {
      let counterDeltaSum = 0
      let counterGames = 0
      const enemyDetails: EnemyDetail[] = []

      for (const enemyShortId of draft.enemies) {
        const rows = enemyTables[enemyShortId]
        if (!rows) continue

        const row = rows.find((r) => r.hero_id === c.numericId)
        if (!row) continue

        const wrEnemyVsCandidate = winrate(row.games_played, row.wins)
        const wrCandidateVsEnemy = 1 - wrEnemyVsCandidate
        const delta = wrCandidateVsEnemy - 0.5

        counterDeltaSum += delta
        counterGames += row.games_played

        const enemyHero = this.catalog.byShortId.get(enemyShortId)
        enemyDetails.push({
          heroShortId: enemyShortId,
          heroName: enemyHero?.name ?? enemyShortId,
          games: row.games_played,
          candidateWinrate: wrCandidateVsEnemy,
          delta,
        })
      }

      enemyDetails.sort((a, b) => b.delta - a.delta)
      const bestVs = enemyDetails.slice(0, 2)
      const worstVs = [...enemyDetails].sort((a, b) => a.delta - b.delta).slice(0, 1)

      const bestVsStr = bestVs.length ? bestVs.map(explainCounterRow).join('; ') : '—'
      const worstVsStr = worstVs.length ? worstVs.map(explainCounterRow).join('; ') : '—'

      const allySynergy = alliesResolved
        .map((a) => synergyHeuristic(c, a))
        .sort((x, y) => y.score - x.score)

      const bestWith = allySynergy.slice(0, 2).filter((x) => x.score > 0)

      const bestWithStr =
        draft.allies.length === 0
          ? 'No allies selected'
          : bestWith.length === 0
            ? 'No positive heuristic signal'
            : bestWith.map((x) => `${x.heroName} (${x.reason})`).join('; ')

      const roleFit = roleFitScore(c.roles, draft.role)

      // Score breakdown (simple + explainable):
      // - Counter delta sum dominates (data-driven)
      // - Role fit nudges
      // - Synergy heuristic small bonus
      const counterComponent = clamp(counterDeltaSum * 110, -35, 35)
      const roleComponent = clamp((roleFit - 0.5) * 30, -15, 15)
      const synergyComponent = clamp(bestWith.reduce((s, x) => s + x.score, 0) * 6, 0, 12)

      const score = 60 + counterComponent + synergyComponent + roleComponent - idx * 0.03

      return {
        heroId: c.shortId,
        heroName: c.name,
        score: Math.round(score * 10) / 10,
        confidence: confidenceFromSample(counterGames),
        sampleSize: counterGames,
        explanations: [
          {
            label: 'Score breakdown',
            value: `Counters ${Math.round(counterComponent * 10) / 10} + Synergy ${Math.round(synergyComponent * 10) / 10} + Role ${Math.round(roleComponent * 10) / 10}`,
            evidence: 'Heuristic weights; counters are data-driven',
          },
          {
            label: 'Best vs (est.)',
            value: bestVsStr,
            evidence: 'OpenDota matchup tables',
          },
          {
            label: 'Worst vs (est.)',
            value: worstVsStr,
            evidence: 'OpenDota matchup tables',
          },
          {
            label: 'Best with (heuristic)',
            value: bestWithStr,
            evidence: 'Role-tag based heuristic (not winrate)',
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
