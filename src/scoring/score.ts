import type { Recommendation } from '../domain/types'

export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => b.score - a.score)
}
