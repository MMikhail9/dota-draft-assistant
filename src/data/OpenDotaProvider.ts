import type { DraftState, Recommendation } from '../domain/types'
import type { DatasetSlice, StatsProvider } from './StatsProvider'
import type { Hero, HeroCatalog } from './HeroCatalog'
import { fetchHeroMatchups, fetchSynergyWinrate, type OpenDotaMatchupRow } from './opendota'
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

type AllySynergy = {
  heroName: string
  games: number
  winrate: number
  delta: number
}

function explainCounterRow(d: EnemyDetail): string {
  const wr = Math.round(d.candidateWinrate * 100)
  const delta = Math.round(d.delta * 1000) / 10
  return `${d.heroName}: ${wr}% (Δ${delta}%, games=${d.games})`
}

function explainSynergyRow(s: AllySynergy): string {
  const wr = Math.round(s.winrate * 100)
  const delta = Math.round(s.delta * 1000) / 10
  return `${s.heroName}: ${wr}% (Δ${delta}%, games=${s.games})`
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
      .slice(0, 80)

    const recs: Recommendation[] = []

    // We compute synergy per candidate only for selected allies (usually 0-2),
    // with low concurrency to keep Explorer usage gentle.
    for (const c of candidates) {
      // --- counters ---
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

      // --- synergy (data-driven via Explorer) ---
      const synergyRows: AllySynergy[] = []
      for (const ally of alliesResolved.slice(0, 2)) {
        const r = await fetchSynergyWinrate({ heroA: c.numericId, heroB: ally.numericId })
        if (!r) continue
        synergyRows.push({
          heroName: ally.name,
          games: r.games,
          winrate: r.winrate,
          delta: r.winrate - 0.5,
        })
      }
      synergyRows.sort((a, b) => b.delta - a.delta)

      const bestWithStr =
        draft.allies.length === 0
          ? 'No allies selected'
          : synergyRows.length === 0
            ? 'No synergy data'
            : synergyRows.map(explainSynergyRow).join('; ')

      const synergyGames = synergyRows.reduce((s, x) => s + x.games, 0)
      const synergyDelta = synergyRows.reduce((s, x) => s + x.delta, 0)

      const roleFit = roleFitScore(c.roles, draft.role)

      const counterComponent = clamp(counterDeltaSum * 110, -35, 35)
      const roleComponent = clamp((roleFit - 0.5) * 30, -15, 15)
      const synergyComponent = clamp(synergyDelta * 80, -10, 14)

      const score = 60 + counterComponent + synergyComponent + roleComponent

      recs.push({
        heroId: c.shortId,
        heroName: c.name,
        score: Math.round(score * 10) / 10,
        confidence: confidenceFromSample(counterGames),
        sampleSize: counterGames,
        explanations: [
          {
            label: 'Score breakdown',
            value: `Counters ${Math.round(counterComponent * 10) / 10} + Synergy ${Math.round(synergyComponent * 10) / 10} + Role ${Math.round(roleComponent * 10) / 10}`,
            evidence: 'Counters from OpenDota matchups; Synergy from OpenDota Explorer co-play winrate',
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
            label: 'Best with (data-driven)',
            value: bestWithStr,
            evidence: `OpenDota Explorer (public matches); synergy games=${synergyGames}`,
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
      })
    }

    return recs
  }
}
