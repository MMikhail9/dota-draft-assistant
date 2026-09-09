import { useMemo, useState } from 'react'
import type { DraftState, HeroId, Role } from '../domain/types'
import type { DatasetSlice } from '../data/StatsProvider'
import { MockProvider } from '../data/MockProvider'
import { sortRecommendations } from '../scoring/score'

const provider = new MockProvider()

export function App() {
  const [allies, setAllies] = useState<HeroId[]>([])
  const [enemies, setEnemies] = useState<HeroId[]>([])
  const [role, setRole] = useState<Role>(1)
  const [slice, setSlice] = useState<DatasetSlice>({ mmrBracket: 'mid', timeWindowDays: 60 })

  const draft: DraftState = useMemo(() => ({ allies, enemies, role }), [allies, enemies, role])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<any[]>([])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const result = await provider.getRecommendations(draft, slice)
      setRecs(sortRecommendations(result))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function add(list: HeroId[], setList: (v: HeroId[]) => void, value: string) {
    const v = value.trim()
    if (!v) return
    if (list.includes(v)) return
    setList([...list, v])
  }

  function remove(list: HeroId[], setList: (v: HeroId[]) => void, value: HeroId) {
    setList(list.filter((x) => x !== value))
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Dota Draft Assistant</h1>
          <p className="text-sm text-gray-400">
            MVP scaffold: picks → recommendations with explanations (mock data).
          </p>
        </header>

        <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">Role</div>
            <select
              className="w-full rounded-md border border-white/10 bg-black/30 p-2"
              value={role}
              onChange={(e) => setRole(Number(e.target.value) as Role)}
            >
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  Position {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">MMR bracket</div>
            <select
              className="w-full rounded-md border border-white/10 bg-black/30 p-2"
              value={slice.mmrBracket}
              onChange={(e) => setSlice((s) => ({ ...s, mmrBracket: e.target.value as any }))}
            >
              <option value="low">Low</option>
              <option value="mid">Mid</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Time window</div>
            <select
              className="w-full rounded-md border border-white/10 bg-black/30 p-2"
              value={slice.timeWindowDays}
              onChange={(e) =>
                setSlice((s) => ({ ...s, timeWindowDays: Number(e.target.value) as any }))
              }
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <PickBox
            title="Allies"
            values={allies}
            onAdd={(v) => add(allies, setAllies, v)}
            onRemove={(v) => remove(allies, setAllies, v)}
          />
          <PickBox
            title="Enemies"
            values={enemies}
            onAdd={(v) => add(enemies, setEnemies, v)}
            onRemove={(v) => remove(enemies, setEnemies, v)}
          />
        </section>

        <section className="flex items-center gap-3">
          <button
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Calculating…' : 'Get recommendations'}
          </button>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
        </section>

        <section className="space-y-3">
          <div className="text-sm font-medium">Recommendations</div>
          <div className="grid gap-3">
            {recs.map((r) => (
              <div
                key={r.heroId}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-lg font-semibold">{r.heroName}</div>
                  <div className="text-sm text-gray-300">
                    Score: <span className="font-mono">{r.score}</span> · Confidence:{' '}
                    <span className="font-mono">{r.confidence}</span> · Games:{' '}
                    <span className="font-mono">{r.sampleSize}</span>
                  </div>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
                  {r.explanations.map((e: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium text-gray-200">{e.label}:</span> {e.value}
                      {e.evidence ? <span className="text-gray-400"> — {e.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {recs.length === 0 ? (
              <div className="text-sm text-gray-400">No results yet. Click the button.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function PickBox(props: {
  title: string
  values: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
}) {
  const [input, setInput] = useState('')

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{props.title}</div>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm"
          placeholder="Type hero id (e.g. axe)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              props.onAdd(input)
              setInput('')
            }
          }}
        />
        <button
          className="rounded-md border border-white/10 bg-white/10 px-3 text-sm hover:bg-white/20"
          onClick={() => {
            props.onAdd(input)
            setInput('')
          }}
        >
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {props.values.map((v) => (
          <button
            key={v}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs hover:bg-black/40"
            onClick={() => props.onRemove(v)}
            title="Remove"
          >
            {v} ×
          </button>
        ))}
        {props.values.length === 0 ? <div className="text-xs text-gray-400">Empty</div> : null}
      </div>
    </div>
  )
}
