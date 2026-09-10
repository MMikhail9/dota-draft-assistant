import { useMemo, useState } from 'react'
import type { Hero } from '../data/HeroCatalog'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSubsequence(query: string, target: string): boolean {
  // e.g. 'shad' matches 'shadow'
  let qi = 0
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++
  }
  return qi === query.length
}

export function HeroPicker(props: {
  heroes: Hero[]
  placeholder: string
  onPick: (hero: Hero) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const raw = q.trim()
    const query = normalize(raw)

    if (!query) return props.heroes.slice(0, 30)

    const scored = props.heroes
      .map((h) => {
        const nameNorm = normalize(h.name)
        const idNorm = normalize(h.shortId)

        // Score:
        // 0 = exact/prefix, 1 = substring, 2 = subsequence, 9 = no match
        const score =
          idNorm === query || nameNorm === query
            ? 0
            : idNorm.startsWith(query) || nameNorm.startsWith(query)
              ? 0
              : idNorm.includes(query) || nameNorm.includes(query)
                ? 1
                : isSubsequence(query, idNorm) || isSubsequence(query, nameNorm)
                  ? 2
                  : 9

        return { h, score }
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || a.h.name.localeCompare(b.h.name))
      .slice(0, 30)

    return scored.map((x) => x.h)
  }, [q, props.heroes])

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm"
        placeholder={props.placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-56 overflow-auto rounded-md border border-white/10 bg-black/20">
        {filtered.map((h) => (
          <button
            key={h.id}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/10"
            onClick={() => {
              props.onPick(h)
              setQ('')
            }}
            type="button"
          >
            <span className="text-gray-100">{h.name}</span>
            <span className="font-mono text-xs text-gray-400">{h.shortId}</span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
        ) : null}
      </div>
    </div>
  )
}
