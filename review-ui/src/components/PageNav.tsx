import { PAGE_STATE_LABEL, type PageState } from '../lib/triage'

const PILL: Record<PageState, string> = {
  done: 'border-stone-800 bg-stone-800 text-white',
  in_progress: 'border-amber-500 bg-amber-50 text-amber-900',
  clean_pending: 'border-stone-500 bg-white text-stone-800',
  untouched: 'border-stone-300 bg-white text-stone-700',
  skipped: 'border-stone-200 bg-stone-100 text-stone-400',
  empty: 'border-stone-200 bg-white text-stone-400',
}

/** One pill per page that has rows. Everything else is reachable from the page box in the header. */
export function PageNav({ states, current, onJump }: { states: PageState[]; current: number; onJump: (p: number) => void }) {
  const withRows = states.map((s, i) => ({ p: i + 1, s })).filter(x => x.s !== 'empty' && x.s !== 'skipped')
  const done = withRows.filter(x => x.s === 'done').length
  return (
    <div className="flex items-center gap-3 border-t border-stone-200 bg-stone-50 px-3 py-1.5 text-xs">
      <span className="whitespace-nowrap text-stone-500">Pages with rows</span>
      {withRows.length === 0 ? (
        <span className="text-stone-400">none yet</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {withRows.map(({ p, s }) => (
            <button key={p} type="button" onClick={() => onJump(p)} title={`Page ${p}: ${PAGE_STATE_LABEL[s]}`} aria-current={p === current ? 'page' : undefined}
              className={`min-w-7 rounded border px-1.5 py-0.5 tabular-nums ${PILL[s]} ${p === current ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:brightness-95'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
      <span className="ml-auto whitespace-nowrap text-stone-500">{done} of {withRows.length} done</span>
    </div>
  )
}
