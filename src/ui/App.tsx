import { useEffect, useMemo, useState } from 'react'
import type { DraftState, HeroId, Role } from '../domain/types'
import type { DatasetSlice } from '../data/StatsProvider'
import { sortRecommendations } from '../scoring/score'
import { fetchOpenDotaHeroStats } from '../data/opendota'
import { toCatalog, type HeroCatalog } from '../data/HeroCatalog'
import { HeroPicker } from './HeroPicker'
import { OpenDotaProvider } from '../data/OpenDotaProvider'
import { useDebouncedEffect } from './useDebouncedEffect'
import { Modal } from './Modal'

export function App() {
  const [catalog, setCatalog] = useState<HeroCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setCatalogError(null)
        const stats = await fetchOpenDotaHeroStats()
        if (cancelled) return
        setCatalog(toCatalog(stats))
      } catch (e) {
        if (cancelled) return
        setCatalogError(e instanceof Error ? e.message : 'Failed to load heroes')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const provider = useMemo(() => (catalog ? new OpenDotaProvider(catalog) : null), [catalog])

  const [allies, setAllies] = useState<HeroId[]>([])
  const [enemies, setEnemies] = useState<HeroId[]>([])
  const [role, setRole] = useState<Role>(1)
  const [slice, setSlice] = useState<DatasetSlice>({ mmrBracket: 'mid', timeWindowDays: 60 })

  const draft: DraftState = useMemo(() => ({ allies, enemies, role }), [allies, enemies, role])

  const [autoRecalc, setAutoRecalc] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<any[]>([])

  const [selected, setSelected] = useState<any | null>(null)

  async function refresh() {
    if (!provider) return
    setLoading(true)
    setError(null)
    try {
      const result = await provider.getRecommendations(draft, slice)
      setRecs(sortRecommendations(result).slice(0, 10))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useDebouncedEffect(
    () => {
      if (!autoRecalc) return
      if (!provider) return
      if (enemies.length === 0) return
      refresh()
    },
    350,
    [autoRecalc, provider, enemies.join(','), allies.join(','), role],
  )

  function addHero(list: HeroId[], setList: (v: HeroId[]) => void, shortId: string) {
    const v = shortId.trim()
    if (!v) return
    if (list.includes(v)) return
    setList([...list, v])
  }

  function remove(list: HeroId[], setList: (v: HeroId[]) => void, value: HeroId) {
    setList(list.filter((x) => x !== value))
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
                <span className="text-lg">⚔️</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">Dota Draft Assistant</div>
                <div className="truncate text-xs text-gray-400">
                  Explainable draft suggestions (OpenDota)
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={autoRecalc}
                onChange={(e) => setAutoRecalc(e.target.checked)}
              />
              Auto recalc
            </label>

            <button
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
              onClick={refresh}
              disabled={loading || !provider}
            >
              {loading ? 'Calculating…' : 'Recalculate'}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        {catalogError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {catalogError}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <Card title="Draft" subtitle="Pick allies/enemies and a role.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Role">
                  <select
                    className="w-full rounded-lg border border-white/10 bg-black/30 p-2"
                    value={role}
                    onChange={(e) => setRole(Number(e.target.value) as Role)}
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        Position {r}
                      </option>
                    ))}
                  </select>
                </Labeled>

                <Labeled label="Filters (coming soon)">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-gray-300 opacity-60"
                      value={slice.mmrBracket}
                      onChange={(e) => setSlice((s) => ({ ...s, mmrBracket: e.target.value as any }))}
                      disabled
                      title="Not wired yet"
                    >
                      <option value="low">Low</option>
                      <option value="mid">Mid</option>
                      <option value="high">High</option>
                    </select>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-gray-300 opacity-60"
                      value={slice.timeWindowDays}
                      onChange={(e) =>
                        setSlice((s) => ({ ...s, timeWindowDays: Number(e.target.value) as any }))
                      }
                      disabled
                      title="Not wired yet"
                    >
                      <option value={30}>30d</option>
                      <option value={60}>60d</option>
                      <option value={90}>90d</option>
                    </select>
                  </div>
                </Labeled>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <PickBox
                  title="Allies"
                  values={allies}
                  catalogReady={!!catalog}
                  picker={
                    catalog ? (
                      <HeroPicker
                        heroes={catalog.heroes}
                        placeholder="Search ally…"
                        onPick={(h) => addHero(allies, setAllies, h.shortId)}
                      />
                    ) : null
                  }
                  onRemove={(v) => remove(allies, setAllies, v)}
                />
                <PickBox
                  title="Enemies"
                  values={enemies}
                  catalogReady={!!catalog}
                  picker={
                    catalog ? (
                      <HeroPicker
                        heroes={catalog.heroes}
                        placeholder="Search enemy…"
                        onPick={(h) => addHero(enemies, setEnemies, h.shortId)}
                      />
                    ) : null
                  }
                  onRemove={(v) => remove(enemies, setEnemies, v)}
                />
              </div>

              {autoRecalc && enemies.length === 0 ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
                  Tip: pick at least 1 enemy to auto-recalculate.
                </div>
              ) : null}
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <Card
              title="Recommendations"
              subtitle={
                provider
                  ? 'Top 10 candidates with explainable breakdown.'
                  : 'Loading data source…'
              }
            >
              <div className="grid gap-3">
                {recs.map((r) => (
                  <button
                    key={r.heroId}
                    className="group w-full rounded-xl border border-white/10 bg-gradient-to-b from-white/6 to-white/4 p-4 text-left hover:border-white/20 hover:bg-white/5"
                    onClick={() => setSelected(r)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold">{r.heroName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                          <Pill label={`Score ${r.score}`} />
                          <Pill label={`Confidence ${r.confidence}`} />
                          <Pill label={`Games ${r.sampleSize}`} />
                          <span className="text-xs text-gray-500">Click for details</span>
                        </div>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-2 text-sm text-gray-200">
                      {r.explanations.slice(0, 2).map((e: any, idx: number) => (
                        <li key={idx} className="leading-snug">
                          <div className="text-xs text-gray-400">{e.label}</div>
                          <div className="text-sm text-gray-200">{e.value}</div>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}

                {recs.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-300">
                    {provider ? (
                      <div>
                        <div className="font-medium text-gray-200">No results yet</div>
                        <div className="mt-1 text-gray-400">
                          Pick enemies (and optionally allies). Auto-recalc will run, or click
                          Recalculate.
                        </div>
                      </div>
                    ) : (
                      <div>Loading…</div>
                    )}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </section>

        <footer className="pb-6 text-xs text-gray-500">
          MVP note: synergy is currently heuristic; counters use OpenDota matchup aggregates. Results
          can be noisy for rare matchups.
        </footer>
      </main>

      <Modal
        open={!!selected}
        title={selected ? `${selected.heroName} — details` : 'Details'}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill label={`Score ${selected.score}`} />
              <Pill label={`Confidence ${selected.confidence}`} />
              <Pill label={`Games ${selected.sampleSize}`} />
            </div>

            <div className="grid gap-3">
              {selected.explanations.map((e: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-medium text-gray-300">{e.label}</div>
                  <div className="mt-1 text-sm text-gray-100">{e.value}</div>
                  {e.evidence ? <div className="mt-1 text-xs text-gray-500">{e.evidence}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Card(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-100">{props.title}</div>
        {props.subtitle ? <div className="mt-1 text-xs text-gray-400">{props.subtitle}</div> : null}
      </div>
      {props.children}
    </section>
  )
}

function Labeled(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-medium text-gray-300">{props.label}</div>
      {props.children}
    </label>
  )
}

function Pill(props: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[11px] text-gray-200">
      {props.label}
    </span>
  )
}

function PickBox(props: {
  title: string
  values: string[]
  onRemove: (v: string) => void
  picker: React.ReactNode
  catalogReady: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-200">{props.title}</div>
      </div>

      <div className="mt-2">
        {props.catalogReady ? (
          props.picker
        ) : (
          <div className="text-xs text-gray-400">Loading heroes…</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {props.values.map((v) => (
          <button
            key={v}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-100 hover:bg-white/10"
            onClick={() => props.onRemove(v)}
            title="Remove"
            type="button"
          >
            {v} ×
          </button>
        ))}
        {props.values.length === 0 ? <div className="text-xs text-gray-500">Empty</div> : null}
      </div>
    </div>
  )
}
