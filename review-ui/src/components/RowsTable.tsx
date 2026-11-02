import { useMemo, useState } from 'react'
import { useReview, type RowView } from '../state/reviewStore'
import { navigate } from '../router'
import { viewsToRecords } from '../lib/export'
import { download, toCsv } from '../lib/csv'
import { flagLabel } from '../lib/triage'
import { Button, Chip } from './ui'

export function RowsTable() {
  const { docs, allViews, labels, runId } = useReview()
  const [docFilter, setDocFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [q, setQ] = useState('')

  const rows = useMemo(() => docs.flatMap(d => allViews(d.id).map(v => ({ doc: d, v }))), [docs, allViews])
  const shown = rows.filter(({ doc, v }) =>
    (docFilter === 'all' || doc.id === docFilter) &&
    (statusFilter === 'all' || v.row.status === statusFilter) &&
    (!flaggedOnly || v.flags.length > 0) &&
    (!q || `${v.row.label} ${v.row.role} ${v.row.quote} ${v.row.entityNamed ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  const exportCsv = (all: boolean) =>
    download(`rows-${runId}${all ? '-all' : ''}.csv`, toCsv(docs.flatMap(d => viewsToRecords(d, allViews(d.id), all))))

  return (
    <div className="mx-auto max-w-6xl p-6">
      <a href="#/" className="text-sm text-stone-600 hover:underline">Overview</a>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">All rows</h1>
          <p className="text-sm text-stone-600">{shown.length} of {rows.length} rows. Click a row to open its page.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportCsv(false)}>Export accepted and edited</Button>
          <Button onClick={() => exportCsv(true)}>Export everything</Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <select value={docFilter} onChange={e => setDocFilter(e.target.value)} className="rounded border border-stone-300 bg-white px-2 py-1">
          <option value="all">All documents</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.sourceName}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded border border-stone-300 bg-white px-2 py-1">
          <option value="all">Any status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="edited">Edited</option>
          <option value="rejected">Rejected</option>
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} /> Flagged only</label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search label, role, quote" className="min-w-60 flex-1 rounded border border-stone-300 px-2 py-1" />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Doc</th>
              <th className="px-3 py-2 font-medium">Page</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Quote</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ doc, v }) => <TableRow key={v.row.id} doc={doc.docType} v={v} labels={labels} onOpen={() => navigate({ name: 'wizard', docId: doc.id, page: v.row.pdfPage, rowId: v.row.id })} />)}
            {shown.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-500">No rows match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TableRow({ doc, v, labels, onOpen }: { doc: string; v: RowView; labels: ReturnType<typeof useReview>['labels']; onOpen: () => void }) {
  const r = v.row
  return (
    <tr onClick={onOpen} className={`cursor-pointer border-t border-stone-100 align-top hover:bg-stone-50 ${r.status === 'rejected' ? 'text-stone-400' : ''}`}>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-500">{doc}</td>
      <td className="px-3 py-2 tabular-nums">{r.pdfPage}</td>
      <td className="px-3 py-2">{r.label}</td>
      <td className="px-3 py-2 whitespace-nowrap text-stone-600">{r.role}</td>
      <td className="px-3 py-2 font-serif">
        <span className={r.status === 'rejected' ? 'line-through' : ''}>{r.quote}</span>
        {v.flags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{v.flags.map(f => <Chip key={f} tone="amber">{flagLabel(f, r, labels)}</Chip>)}</div>}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {r.status === 'accepted' ? <Chip tone="green">{v.isAdded ? 'Added' : 'Accepted'}</Chip> : r.status === 'edited' ? <Chip tone="blue">Edited</Chip> : r.status === 'rejected' ? <Chip>Rejected</Chip> : <Chip>Pending</Chip>}
      </td>
    </tr>
  )
}
