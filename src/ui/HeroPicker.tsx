import { useMemo, useState } from 'react'
import type { Hero } from '../data/HeroCatalog'

export function HeroPicker(props: {
  heroes: Hero[]
  placeholder: string
  onPick: (hero: Hero) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return props.heroes.slice(0, 30)
    return props.heroes
      .filter((h) => h.name.toLowerCase().includes(query) || h.shortId.includes(query))
      .slice(0, 30)
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
