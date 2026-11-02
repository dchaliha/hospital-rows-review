import { useReview } from '../state/reviewStore'
import { navigate } from '../router'
import { viewsToRecords } from '../lib/export'
import { download, toCsv } from '../lib/csv'
import { Button, Chip } from './ui'
import { SOURCES, useHealth, type SourceId } from '../sources'

export function BatchOverview({ source, onSourceChange }: { source: SourceId; onSourceChange: (s: SourceId) => void }) {
  const { docs, summary, runId, restored, api, allViews } = useReview()
  const exportAll = () => download(`review-${runId}.csv`, toCsv(docs.flatMap(d => viewsToRecords(d, allViews(d.id), false))))
  const anyRestored = docs.some(d => restored(d.id))
  const health = useHealth()
  const serverUp = !!health
  const sources = Object.entries(SOURCES).filter(([id]) => serverUp || id !== 'uploads')

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Row review</h1>
          <p className="mt-0.5 text-sm text-stone-600">Confirm, edit, or reject each row before it enters the database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={source} onChange={e => onSourceChange(e.target.value as SourceId)} aria-label="Batch" className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900">
            {sources.map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
          <Button onClick={() => navigate({ name: 'rows' })}>All rows</Button>
          <Button onClick={exportAll}>Export CSV</Button>
          {serverUp && <Button variant="primary" onClick={() => navigate({ name: 'upload' })}>Upload a page</Button>}
        </div>
      </header>

      {anyRestored && (
        <div className="mt-4 flex items-center justify-between rounded border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs text-stone-700">
          <span>Restored your progress.</span>
          <Button size="sm" variant="ghost" onClick={() => docs.forEach(d => api.dismissRestored(d.id))}>OK</Button>
        </div>
      )}

      {docs.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          Nothing here yet. Upload a page to extract rows from it.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {docs.map(d => {
          const s = summary(d.id)
          const pct = s.nRows ? Math.round((s.nReviewed / s.nRows) * 100) : 0
          return (
            <article key={d.id} className="flex flex-col rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="font-medium leading-snug">{d.sourceName}</h2>
              <p className="mt-0.5 text-xs text-stone-500">{d.docType} &middot; {d.year} &middot; {d.pageCount} page{d.pageCount === 1 ? '' : 's'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {s.pendingFlagged > 0 ? <Chip tone="amber">{s.pendingFlagged} need a human</Chip> : s.nRows > 0 ? <Chip tone="green">Nothing flagged left</Chip> : null}
                <span className="text-stone-600">{s.nRows} rows &middot; {s.nNeedsHuman} flagged &middot; {s.nReviewed} reviewed</span>
              </div>
              {d.notes?.length ? <p className="mt-2 text-xs text-amber-900">{d.notes.join(' ')}</p> : null}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-stone-100"><div className="h-full bg-stone-700" style={{ width: `${pct}%` }} /></div>
              <div className="mt-4 flex gap-2">
                <Button variant="primary" onClick={() => navigate({ name: 'wizard', docId: d.id, page: s.firstPageToReview })}>{s.nReviewed ? 'Continue' : 'Review'}</Button>
                <Button onClick={() => navigate({ name: 'done', docId: d.id })}>Summary</Button>
              </div>
            </article>
          )
        })}
      </div>

      <p className="mt-8 text-xs text-stone-500">Decisions save in this browser as you go. Press ? inside the review for keyboard shortcuts.</p>
    </div>
  )
}
