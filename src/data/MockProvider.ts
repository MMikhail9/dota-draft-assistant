import type { DraftState, Recommendation } from '../domain/types'
import type { DatasetSlice, StatsProvider } from './StatsProvider'

const HEROES = [
  { id: 'axe', name: 'Axe' },
  { id: 'crystal_maiden', name: 'Crystal Maiden' },
  { id: 'juggernaut', name: 'Juggernaut' },
  { id: 'lina', name: 'Lina' },
  { id: 'mars', name: 'Mars' },
  { id: 'snapfire', name: 'Snapfire' },
]

export class MockProvider implements StatsProvider {
  async getRecommendations(draft: DraftState, slice: DatasetSlice): Promise<Recommendation[]> {
    const excluded = new Set([...draft.allies, ...draft.enemies])

    const base = HEROES.filter((h) => !excluded.has(h.id))

    // Very naive scoring for scaffold.
    return base.map((h, i) => ({
      heroId: h.id,
      heroName: h.name,
      score: 100 - i * 7,
      confidence: i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
      sampleSize: 1200 - i * 140,
      explanations: [
        { label: 'Role fit', value: 'Good', evidence: `Role ${draft.role}` },
        { label: 'Vs enemies', value: '+2 matchups', evidence: 'Mock data' },
        { label: 'With allies', value: '+1 synergy', evidence: 'Mock data' },
        { label: 'Slice', value: JSON.stringify(slice) },
      ],
    }))
  }
}
