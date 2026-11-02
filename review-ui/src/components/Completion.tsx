import { useState } from 'react'
import { useReview } from '../state/reviewStore'
import { navigate } from '../router'
import { viewsToRecords } from '../lib/export'
import { download, slug, toCsv } from '../lib/csv'
import { Button, Chip, Screen } from './ui'

export function Completion({ docId }: { docId: string }) {
  const { docs, summary, allViews, review, runId } = useReview()
  const [includeAll, setIncludeAll] = useState(false)
  const doc = docs.find(d => d.id === docId)
  if (!doc) return <Screen>No document with id "{docId}". <a className="underline" href="#/">Back to overview</a></Screen>
  const s = summary(docId)
  const r = review(docId)
  const pending = s.nRows - s.nReviewed
  const exportCsv = () => download(`${slug(doc.sourceName)}-${runId}${includeAll ? '-all' : ''}.csv`, toCsv(viewsToRecords(doc, allViews(docId), includeAll)))

  return (
    <div className="mx-auto max-w-3xl p-8">
      <a href="#/" className="text-sm text-stone-600 hover:underline">Overview</a>
      <h1 className="mt-2 text-xl font-semibold">{doc.sourceName}</h1>
      <p className="text-sm text-stone-600">{doc.docType} · {doc.year} · {doc.pageCount} pages · run {runId}</p>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <Stat label="Accepted" value={s.accepted} tone="green" />
        <Stat label="Edited" value={s.edited} />
        <Stat label="Rejected" value={s.rejected} />
        <Stat label="Added" value={s.added} />
      </div>
      {pending > 0 && (
        <p className="mt-3 text-sm text-amber-900">
          {pending} row{pending === 1 ? ' is' : 's are'} still pending ({s.pendingFlagged} flagged).{' '}
          <button className="underline" onClick={() => navigate({ name: 'wizard', docId, page: s.firstPageToReview })}>Go to page {s.firstPageToReview}</button>
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Rows where no label fit ({s.noFit.length})</h2>
        {s.noFit.length === 0 ? <p className="mt-1 text-sm text-stone-500">None.</p> : (
          <ul className="mt-2 space-y-2">
            {s.noFit.map(v => (
              <li key={v.row.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
                  <button className="underline" onClick={() => navigate({ name: 'wizard', docId, page: v.row.pdfPage })}>Page {v.row.pdfPage}</button>
                  <Chip>{v.row.role}</Chip>
                  <Chip>{v.row.status}</Chip>
                </div>
                <blockquote className="font-serif text-stone-800">“{v.row.quote}”</blockquote>
                {v.row.reviewerNote && <p className="mt-1 text-xs text-stone-600">Note: {v.row.reviewerNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.routerMisses.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Router misses logged</h2>
          <p className="mt-1 text-sm text-stone-700">Pages marked as having content although the router skipped them: {r.routerMisses.join(', ')}</p>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Export</h2>
        <p className="mt-1 text-xs text-stone-600">Columns: doc, pdf_page, label, role, quote, evidence_type, inferred_note, entity_named, population, section, reviewer_decision, reviewer_note, label_set_version, run_id. Every edit made here is reflected.</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} />
          Include pending and rejected rows too
        </label>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={exportCsv}>Export CSV</Button>
          <Button onClick={() => navigate({ name: 'wizard', docId, page: 1 })}>Review from page 1</Button>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'green' ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-stone-600">{label}</div>
    </div>
  )
}
