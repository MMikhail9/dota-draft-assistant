export type Hero = {
  id: string // internal id like 'npc_dota_hero_axe'
  shortId: string // 'axe'
  name: string // localized
}

export type HeroCatalog = {
  heroes: Hero[]
  byShortId: Map<string, Hero>
}

export function toCatalog(opendota: { name: string; localized_name: string }[]): HeroCatalog {
  const heroes: Hero[] = opendota
    .filter((h) => h.name?.startsWith('npc_dota_hero_'))
    .map((h) => {
      const shortId = h.name.replace('npc_dota_hero_', '')
      return {
        id: h.name,
        shortId,
        name: h.localized_name || shortId,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const byShortId = new Map<string, Hero>()
  for (const h of heroes) byShortId.set(h.shortId, h)

  return { heroes, byShortId }
}
