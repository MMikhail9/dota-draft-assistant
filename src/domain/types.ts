export type HeroId = string

export type Role = 1 | 2 | 3 | 4 | 5

export type Confidence = 'high' | 'medium' | 'low'

export type ExplanationItem = {
  label: string
  value: string
  evidence?: string
}

export type Recommendation = {
  heroId: HeroId
  heroName: string
  score: number
  confidence: Confidence
  sampleSize: number
  explanations: ExplanationItem[]
}

export type DraftState = {
  allies: HeroId[]
  enemies: HeroId[]
  role: Role
}
