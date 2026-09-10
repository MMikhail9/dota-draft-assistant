import type { Recommendation } from '../domain/types'

export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => b.score - a.score)
}

export function formatPct(x: number): string {
  return `${Math.round(x * 10) / 10}%`
}
