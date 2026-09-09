import type { DraftState, Recommendation } from '../domain/types'

export type DatasetSlice = {
  patch?: string
  mmrBracket?: 'low' | 'mid' | 'high'
  timeWindowDays?: 30 | 60 | 90
}

export interface StatsProvider {
  getRecommendations(draft: DraftState, slice: DatasetSlice): Promise<Recommendation[]>
}
