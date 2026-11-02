import { useReview, type RowView } from '../state/reviewStore'
import type { EditableFields, LabelSet, RejectReason } from '../types'
import { REJECT_REASONS } from '../types'
import { flagLabel } from '../lib/triage'
import { wordCount } from '../lib/quoteCheck'
import { Button, Chip, Field, Segmented } from './ui'

interface Props {
  docId: string
  view: RowView
  labels: LabelSet
  selected: boolean
  rejecting: boolean
  editing: boolean
  onSelect: () => void
  onHover: (hover: boolean) => void
  onRejectOpen: () => void
  onRejectClose: () => void
  onEdit: () => void
  onDoneEditing: () => void
}

/** Compact by default: label, role, quote, and the decision buttons. Expands into the full form on Edit. */
export function RowCard({ docId, view, labels, selected, rejecting, editing, onSelect, onHover, onRejectOpen, onRejectClose, onEdit, onDoneEditing }: Props) {
  const { api } = useReview()
  const { row, flags, verdict, decision, isAdded } = view
  const status = row.status
  const rejected = status === 'rejected'

  const chips = [
    ...(status !== 'pending' || isAdded ? [<StatusChip key="status" view={view} />] : []),
    ...(flags.length ? [<Chip key="verdict" tone={verdict === 'Unsupported' ? 'strong' : 'amber'}>{verdict}</Chip>] : []),
    ...flags.map(f => <Chip key={f} tone="amber" title={f}>{flagLabel(f, row, labels)}</Chip>),
  ]

  return (
    <div data-rowid={row.id} onClick={onSelect} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-stone-200'} ${rejected ? 'opacity-70' : ''}`}>
      {chips.length > 0 && <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{chips}</div>}

      {editing ? (
        <EditForm docId={docId} view={view} labels={labels} />
      ) : (
        <>
          <div className="text-sm">
            <span className="font-medium">{row.label}</span>
            <span className="text-stone-400"> &middot; </span>
            <span className="text-stone-600">{row.role}</span>
            {row.entityNamed && <span className="text-stone-400"> &middot; {row.entityNamed}</span>}
          </div>
          <blockquote className={`mt-1 font-serif text-[15px] leading-6 ${rejected ? 'text-stone-400 line-through' : 'text-stone-800'}`}>&ldquo;{row.quote}&rdquo;</blockquote>
          {row.reviewerNote && <p className="mt-1 text-xs text-stone-500">Note: {row.reviewerNote}</p>}
        </>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {status === 'pending' && <Button variant="primary" size="sm" onClick={() => api.accept(docId, row.id)}>Accept</Button>}
        {rejected && <Button size="sm" onClick={() => api.accept(docId, row.id)}>Accept instead</Button>}
        {!rejected && (rejecting
          ? <RejectChooser onPick={r => { api.reject(docId, row.id, r); onRejectClose() }} onCancel={onRejectClose} />
          : <Button size="sm" onClick={onRejectOpen}>Reject</Button>)}
        {editing
          ? <Button size="sm" onClick={onDoneEditing}>Done</Button>
          : <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>}
        {decision && <Button variant="ghost" size="sm" onClick={() => api.undo(docId, row.id)} title="Back to the row as the pipeline produced it">Undo</Button>}
        {isAdded && <Button variant="ghost" size="sm" onClick={() => api.removeAdded(docId, row.id)}>Remove</Button>}
      </div>
    </div>
  )
}

function EditForm({ docId, view, labels }: { docId: string; view: RowView; labels: LabelSet }) {
  const { api } = useReview()
  const { row } = view
  const wc = wordCount(row.quote)
  const over = wc > labels.quoteWordLimit
  const edit = (patch: Partial<EditableFields>) => api.edit(docId, row.id, patch)
  const known = labels.labels.includes(row.label) || row.label === labels.noFit
  const labelOptions = known ? [...labels.labels, labels.noFit] : [row.label, ...labels.labels, labels.noFit]
  return (
    <div className="grid gap-2">
      <label className="block text-xs text-stone-500">
        Label
        <select value={row.label} onChange={e => edit({ label: e.target.value })} className="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900">
          {labelOptions.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <div>
        <div className="text-xs text-stone-500">Role</div>
        <div className="mt-0.5"><Segmented ariaLabel="Role" options={labels.roles} value={row.role} onChange={v => edit({ role: v })} /></div>
      </div>
      <label className="block text-xs text-stone-500">
        <span className="flex items-baseline justify-between">
          <span>Quote</span>
          <span className={over ? 'font-semibold text-red-600' : 'text-stone-400'}>{wc} / {labels.quoteWordLimit} words</span>
        </span>
        <textarea data-quote-for={row.id} value={row.quote} rows={3} onChange={e => edit({ quote: e.target.value })}
          className={`mt-0.5 w-full rounded border px-2 py-1 font-serif text-sm leading-5 text-stone-900 ${over ? 'border-red-400' : 'border-stone-300'}`} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Evidence" options={['stated', 'inferred'] as const} value={row.evidenceType} onChange={v => edit({ evidenceType: v })} />
        {row.evidenceType === 'inferred' && (
          <input value={row.inferredNote ?? ''} onChange={e => edit({ inferredNote: e.target.value })} placeholder="What was inferred?"
            className="min-w-48 flex-1 rounded border border-stone-300 px-2 py-1 text-xs text-stone-900" />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Named entity" value={row.entityNamed} onChange={v => edit({ entityNamed: v })} />
        <Field label="Population" value={row.population} onChange={v => edit({ population: v })} />
        <Field label="Section" value={row.section} onChange={v => edit({ section: v })} />
      </div>
      <Field label="Reviewer note" value={row.reviewerNote} onChange={v => api.note(docId, row.id, v)} placeholder="Optional" />
    </div>
  )
}

function StatusChip({ view }: { view: RowView }) {
  const { row, decision, isAdded } = view
  if (row.status === 'accepted') return <Chip tone="green">{isAdded ? 'Added by you' : 'Accepted'}</Chip>
  if (row.status === 'edited') return <Chip tone="blue">{isAdded ? 'Added by you, edited' : 'Kept with edits'}</Chip>
  if (row.status === 'rejected') return <Chip tone="neutral">Rejected{decision?.rejectReason ? `: ${decision.rejectReason}` : ''}</Chip>
  return <Chip tone="neutral">Added by you</Chip>
}

function RejectChooser({ onPick, onCancel }: { onPick: (r: RejectReason) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-stone-300 bg-stone-50 p-1" role="group" aria-label="Reason for rejecting">
      <span className="px-1 text-xs text-stone-500">Why?</span>
      {REJECT_REASONS.map((r, i) => <Button key={r} size="sm" autoFocus={i === 0} onClick={() => onPick(r)}>{i + 1}. {r}</Button>)}
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  )
}
