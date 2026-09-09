export type OpenDotaHero = {
  id: number
  name: string
  localized_name: string
}

export async function fetchOpenDotaHeroes(): Promise<OpenDotaHero[]> {
  const res = await fetch('https://api.opendota.com/api/heroStats')
  if (!res.ok) {
    throw new Error(`OpenDota error: ${res.status}`)
  }
  const data = (await res.json()) as OpenDotaHero[]
  return data
}
