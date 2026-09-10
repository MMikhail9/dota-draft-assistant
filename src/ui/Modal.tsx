import { useEffect } from 'react'

export function Modal(props: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!props.open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={props.onClose}
        aria-label="Close"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-4 pb-4 md:bottom-auto md:top-12">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f17] shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-100">{props.title}</div>
              <div className="text-xs text-gray-500">Press Esc to close</div>
            </div>
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              onClick={props.onClose}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="max-h-[75vh] overflow-auto px-4 py-4">{props.children}</div>
        </div>
      </div>
    </div>
  )
}
