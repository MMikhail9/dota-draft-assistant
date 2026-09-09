import type { OpenDotaHeroStats } from './opendota'

export type Hero = {
  numericId: number
  id: string // internal id like 'npc_dota_hero_axe'
  shortId: string // 'axe'
  name: string // localized
  roles: string[]
}

export type HeroCatalog = {
  heroes: Hero[]
  byShortId: Map<string, Hero>
  byNumericId: Map<number, Hero>
}

export function toCatalog(heroStats: OpenDotaHeroStats[]): HeroCatalog {
  const heroes: Hero[] = heroStats
    .filter((h) => h.name?.startsWith('npc_dota_hero_'))
    .map((h) => {
      const shortId = h.name.replace('npc_dota_hero_', '')
      return {
        numericId: h.id,
        id: h.name,
        shortId,
        name: h.localized_name || shortId,
        roles: h.roles ?? [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const byShortId = new Map<string, Hero>()
  const byNumericId = new Map<number, Hero>()
  for (const h of heroes) {
    byShortId.set(h.shortId, h)
    byNumericId.set(h.numericId, h)
  }

  return { heroes, byShortId, byNumericId }
}
