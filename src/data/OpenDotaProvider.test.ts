import { describe, expect, it, vi } from 'vitest'
import { OpenDotaProvider } from './OpenDotaProvider'

vi.mock('./opendota', () => {
  return {
    fetchHeroMatchups: async (_id: number) => [
      // enemy vs candidate: enemy disadvantaged (wins 40% against candidate) => candidate advantaged
      { hero_id: 1, games_played: 200, wins: 80 },
    ],
  }
})

describe('OpenDotaProvider', () => {
  it('produces recommendations and confidence based on sample size', async () => {
    const catalog = {
      heroes: [
        { numericId: 1, id: 'npc_dota_hero_axe', shortId: 'axe', name: 'Axe', roles: ['Initiator'] },
        {
          numericId: 2,
          id: 'npc_dota_hero_lina',
          shortId: 'lina',
          name: 'Lina',
          roles: ['Nuker'],
        },
      ],
      byShortId: new Map([
        ['axe', { numericId: 1, id: 'npc_dota_hero_axe', shortId: 'axe', name: 'Axe', roles: [] }],
      ]),
      byNumericId: new Map(),
    } as any

    const provider = new OpenDotaProvider(catalog)

    const recs = await provider.getRecommendations({ allies: [], enemies: ['axe'], role: 3 }, {})

    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].confidence).toBe('medium')
    expect(recs[0].explanations.length).toBeGreaterThan(0)
  })
})
