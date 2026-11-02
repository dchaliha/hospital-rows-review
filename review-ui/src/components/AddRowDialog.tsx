import { useState } from 'react'
import type { EvidenceType, LabelSet } from '../types'
import { quoteOnPage, wordCount } from '../lib/quoteCheck'
import { Button, Chip, Field, Segmented } from './ui'

export interface NewRowFields {
  label: string
  role: string
  quote: string
  evidenceType: EvidenceType
  inferredNote?: string
  entityNamed?: string
}

export function AddRowDialog({ initialQuote, labels, pageText, onSave, onCancel }: {
  initialQuote: string
  labels: LabelSet
  pageText: string
  onSave: (f: NewRowFields) => void
  onCancel: () => void
}) {
  const [quote, setQuote] = useState(initialQuote)
  const [label, setLabel] = useState(labels.labels[0])
  const [role, setRole] = useState(labels.roles[0])
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('stated')
  const [inferredNote, setInferredNote] = useState('')
  const [entityNamed, setEntityNamed] = useState('')
  const wc = wordCount(quote)
  const over = wc > labels.quoteWordLimit
  const onPage = quoteOnPage(pageText, quote)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Add a row" className="w-[560px] max-w-[95vw] rounded-lg bg-white p-4 shadow-xl" onMouseDown={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">Add a row on this page</h2>
        <div className="mt-3 grid gap-3">
          <label className="block text-xs text-stone-500">
            <span className="flex items-baseline justify-between">
              <span>Quote</span>
              <span className={over ? 'font-semibold text-red-600' : 'text-stone-400'}>{wc} / {labels.quoteWordLimit} words</span>
            </span>
            <textarea autoFocus value={quote} rows={4} onChange={e => setQuote(e.target.value)}
              className={`mt-0.5 w-full rounded border px-2 py-1 font-serif text-sm leading-5 text-stone-900 ${over ? 'border-red-400' : 'border-stone-300'}`} />
          </label>
          <div className="text-xs">
            {quote.trim() ? (onPage ? <Chip tone="green">Found on this page</Chip> : <Chip tone="amber">Not found on this page. The row will be flagged.</Chip>) : null}
          </div>
          <label className="block text-xs text-stone-500">
            Label
            <select value={label} onChange={e => setLabel(e.target.value)} className="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900">
              {[...labels.labels, labels.noFit].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <div>
            <div className="text-xs text-stone-500">Role</div>
            <div className="mt-0.5"><Segmented ariaLabel="Role" options={labels.roles} value={role} onChange={setRole} /></div>
          </div>
          <div>
            <div className="text-xs text-stone-500">Evidence</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Segmented ariaLabel="Evidence" options={['stated', 'inferred'] as const} value={evidenceType} onChange={setEvidenceType} />
              {evidenceType === 'inferred' && (
                <input value={inferredNote} onChange={e => setInferredNote(e.target.value)} placeholder="What was inferred?"
                  className="min-w-48 flex-1 rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-900" />
              )}
            </div>
          </div>
          <Field label="Named entity (optional)" value={entityNamed} onChange={setEntityNamed} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!quote.trim()} onClick={() => onSave({ label, role, quote: quote.trim(), evidenceType, inferredNote: inferredNote || undefined, entityNamed: entityNamed || undefined })}>Add row</Button>
        </div>
      </div>
    </div>
  )
}
