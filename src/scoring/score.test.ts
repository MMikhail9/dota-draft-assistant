import { describe, expect, it } from 'vitest'
import { sortRecommendations } from './score'

describe('sortRecommendations', () => {
  it('sorts by descending score', () => {
    const sorted = sortRecommendations([
      { heroId: 'a', heroName: 'A', score: 1, confidence: 'low', sampleSize: 10, explanations: [] },
      { heroId: 'b', heroName: 'B', score: 3, confidence: 'low', sampleSize: 10, explanations: [] },
      { heroId: 'c', heroName: 'C', score: 2, confidence: 'low', sampleSize: 10, explanations: [] },
    ])

    expect(sorted.map((x) => x.heroId)).toEqual(['b', 'c', 'a'])
  })
})
