import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { Decision, DocReview, Document, EditableFields, Flag, LabelSet, RejectReason, Row } from '../types'
import type { Batch } from '../data/load'
import { clearDocReview, loadDocReview, saveDocReview } from '../lib/storage'
import { computeFlags, tierOf, verdictOf, type PageState, type Verdict } from '../lib/triage'
import { findQuote } from '../lib/quoteCheck'

/** A row as the reviewer currently sees it: the model's row with the reviewer's decision applied. */
export interface RowView {
  row: Row
  original: Row
  decision?: Decision
  flags: Flag[]
  /** card order on the page, from the ORIGINAL row so cards do not jump while being edited */
  tier: 0 | 1 | 2
  verdict: Verdict
  isAdded: boolean
}

export interface DocSummary {
  nRows: number
  nNeedsHuman: number
  nReviewed: number
  pendingFlagged: number
  accepted: number
  edited: number
  rejected: number
  added: number
  noFit: RowView[]
  firstPageToReview: number
}

interface State { hydrated: boolean; byDoc: Record<string, DocReview>; restored: Record<string, boolean> }

type Action =
  | { type: 'hydrateAll'; byDoc: Record<string, DocReview>; restored: Record<string, boolean> }
  | { type: 'startFresh'; docId: string; runId: string }
  | { type: 'dismissRestored'; docId: string }
  | { type: 'accept'; docId: string; rowId: string }
  | { type: 'reject'; docId: string; rowId: string; reason: RejectReason }
  | { type: 'edit'; docId: string; rowId: string; patch: Partial<EditableFields> }
  | { type: 'note'; docId: string; rowId: string; note: string }
  | { type: 'undo'; docId: string; rowId: string }
  | { type: 'acceptMany'; docId: string; rowIds: string[] }
  | { type: 'addRow'; docId: string; row: Row }
  | { type: 'removeAdded'; docId: string; rowId: string }
  | { type: 'routerMiss'; docId: string; page: number }

const emptyReview = (runId: string): DocReview => ({ runId, decisions: {}, added: [], routerMisses: [] })
const blank = (): Decision => ({ status: 'pending', fields: {}, updatedAt: 0 })

function withDecision(r: DocReview, rowId: string, fn: (d: Decision) => Decision | null): DocReview {
  const next = fn(r.decisions[rowId] ?? blank())
  const decisions = { ...r.decisions }
  if (next) decisions[rowId] = { ...next, updatedAt: Date.now() }
  else delete decisions[rowId]
  return { ...r, decisions }
}

function reduceDoc(r: DocReview, a: Action): DocReview {
  switch (a.type) {
    case 'accept':
      return withDecision(r, a.rowId, d => ({ ...d, status: Object.keys(d.fields).length ? 'edited' : 'accepted', rejectReason: undefined }))
    case 'reject':
      return withDecision(r, a.rowId, d => ({ ...d, status: 'rejected', rejectReason: a.reason }))
    case 'edit':
      return withDecision(r, a.rowId, d => ({ ...d, fields: { ...d.fields, ...a.patch }, status: 'edited', rejectReason: undefined }))
    case 'note':
      return withDecision(r, a.rowId, d => ({ ...d, reviewerNote: a.note }))
    case 'undo':
      return withDecision(r, a.rowId, () => null)
    case 'acceptMany':
      return a.rowIds.reduce((acc, id) => withDecision(acc, id, d => (d.status === 'pending' ? { ...d, status: 'accepted' } : d)), r)
    case 'addRow':
      return { ...r, added: [...r.added, a.row] }
    case 'removeAdded': {
      const decisions = { ...r.decisions }
      delete decisions[a.rowId]
      return { ...r, decisions, added: r.added.filter(x => x.id !== a.rowId) }
    }
    case 'routerMiss':
      return r.routerMisses.includes(a.page) ? r : { ...r, routerMisses: [...r.routerMisses, a.page].sort((x, y) => x - y) }
    default:
      return r
  }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'hydrateAll':
      return { hydrated: true, byDoc: a.byDoc, restored: a.restored }
    case 'startFresh':
      return { ...s, byDoc: { ...s.byDoc, [a.docId]: emptyReview(a.runId) }, restored: { ...s.restored, [a.docId]: false } }
    case 'dismissRestored':
      return { ...s, restored: { ...s.restored, [a.docId]: false } }
    default: {
      const cur = s.byDoc[a.docId]
      if (!cur) return s
      return { ...s, byDoc: { ...s.byDoc, [a.docId]: reduceDoc(cur, a) } }
    }
  }
}

export interface ReviewApi {
  accept(docId: string, rowId: string): void
  reject(docId: string, rowId: string, reason: RejectReason): void
  edit(docId: string, rowId: string, patch: Partial<EditableFields>): void
  note(docId: string, rowId: string, note: string): void
  undo(docId: string, rowId: string): void
  /** Accepts only pending rows with no flags on that page. Flagged and inferred rows are never touched. */
  acceptAllClean(docId: string, page: number): number
  addRow(docId: string, row: Row): void
  removeAdded(docId: string, rowId: string): void
  routerMiss(docId: string, page: number): void
  startFresh(docId: string): void
  dismissRestored(docId: string): void
}

export interface ReviewContextValue {
  batch: Batch
  labels: LabelSet
  runId: string
  docs: Document[]
  hydrated: boolean
  api: ReviewApi
  viewsFor(docId: string, page: number): RowView[]
  allViews(docId: string): RowView[]
  pageStates(docId: string): PageState[]
  summary(docId: string): DocSummary
  review(docId: string): DocReview
  restored(docId: string): boolean
}

const Ctx = createContext<ReviewContextValue | null>(null)

export function ReviewProvider({ batch, labels, children }: { batch: Batch; labels: LabelSet; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { hydrated: false, byDoc: {}, restored: {} })
  const runId = batch.runId

  // Restore saved progress for every document in the batch.
  useEffect(() => {
    const byDoc: Record<string, DocReview> = {}
    const restored: Record<string, boolean> = {}
    for (const d of batch.documents) {
      const saved = loadDocReview(d.id, runId)
      byDoc[d.id] = saved ?? emptyReview(runId)
      restored[d.id] = !!saved && (Object.keys(saved.decisions).length > 0 || saved.added.length > 0 || saved.routerMisses.length > 0)
    }
    dispatch({ type: 'hydrateAll', byDoc, restored })
  }, [batch, runId])

  // Autosave: every change, keyed by (docId, runId).
  const lastSaved = useRef<Record<string, DocReview>>({})
  useEffect(() => {
    if (!state.hydrated) return
    for (const [docId, r] of Object.entries(state.byDoc)) {
      if (lastSaved.current[docId] === r) continue
      saveDocReview(docId, runId, r)
      lastSaved.current[docId] = r
    }
  }, [state, runId])

  const docById = useMemo(() => new Map(batch.documents.map(d => [d.id, d] as const)), [batch])

  const rowIndex = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of batch.rows) {
      const k = `${r.docId}:${r.pdfPage}`
      const list = m.get(k)
      if (list) list.push(r)
      else m.set(k, [r])
    }
    return m
  }, [batch])

  const review = useCallback((docId: string): DocReview => state.byDoc[docId] ?? emptyReview(runId), [state.byDoc, runId])

  const viewsFor = useCallback((docId: string, page: number): RowView[] => {
    const doc = docById.get(docId)
    if (!doc) return []
    const r = review(docId)
    const text = doc.pageText(page)
    const originals = [...(rowIndex.get(`${docId}:${page}`) ?? []), ...r.added.filter(x => x.pdfPage === page)]
    const views = originals.map(original => {
      const decision = r.decisions[original.id]
      const row: Row = {
        ...original,
        ...(decision?.fields ?? {}),
        status: decision?.status ?? original.status,
        reviewerNote: decision?.reviewerNote ?? original.reviewerNote,
      }
      const flags = computeFlags(row, text, labels)
      const tier = tierOf(computeFlags(original, text, labels))
      const pos = findQuote(text, original.quote)?.start ?? Number.MAX_SAFE_INTEGER
      return { view: { row, original, decision, flags, tier, verdict: verdictOf(flags), isAdded: !!original.addedByReviewer }, pos }
    })
    return views
      .sort((a, b) => a.view.tier - b.view.tier || a.pos - b.pos || a.view.original.id.localeCompare(b.view.original.id))
      .map(v => v.view)
  }, [docById, review, rowIndex, labels])

  const allViews = useCallback((docId: string): RowView[] => {
    const doc = docById.get(docId)
    if (!doc) return []
    const out: RowView[] = []
    for (let p = 1; p <= doc.pageCount; p++) out.push(...viewsFor(docId, p))
    return out
  }, [docById, viewsFor])

  const pageStates = useCallback((docId: string): PageState[] => {
    const doc = docById.get(docId)
    if (!doc) return []
    const out: PageState[] = []
    for (let p = 1; p <= doc.pageCount; p++) {
      const views = viewsFor(docId, p)
      if (!views.length) { out.push(doc.skippedPages.includes(p) ? 'skipped' : 'empty'); continue }
      const decided = views.filter(v => v.row.status !== 'pending').length
      const flaggedPending = views.some(v => v.flags.length > 0 && v.row.status === 'pending')
      const cleanPending = views.some(v => v.flags.length === 0 && v.row.status === 'pending')
      out.push(decided === 0 ? 'untouched' : flaggedPending ? 'in_progress' : cleanPending ? 'clean_pending' : 'done')
    }
    return out
  }, [docById, viewsFor])

  const summary = useCallback((docId: string): DocSummary => {
    const s: DocSummary = { nRows: 0, nNeedsHuman: 0, nReviewed: 0, pendingFlagged: 0, accepted: 0, edited: 0, rejected: 0, added: 0, noFit: [], firstPageToReview: 0 }
    let firstPending = 0
    for (const v of allViews(docId)) {
      const st = v.row.status
      s.nRows++
      if (v.flags.length) s.nNeedsHuman++
      if (st !== 'pending') s.nReviewed++
      if (st === 'rejected') s.rejected++
      else if (v.isAdded) s.added++
      else if (st === 'accepted') s.accepted++
      else if (st === 'edited') s.edited++
      if (v.flags.includes('no_fit') && st !== 'rejected') s.noFit.push(v)
      if (st === 'pending') {
        if (!firstPending) firstPending = v.row.pdfPage
        if (v.flags.length) { s.pendingFlagged++; if (!s.firstPageToReview) s.firstPageToReview = v.row.pdfPage }
      }
    }
    s.firstPageToReview = s.firstPageToReview || firstPending || 1
    return s
  }, [allViews])

  const api = useMemo<ReviewApi>(() => ({
    accept: (docId, rowId) => dispatch({ type: 'accept', docId, rowId }),
    reject: (docId, rowId, reason) => dispatch({ type: 'reject', docId, rowId, reason }),
    edit: (docId, rowId, patch) => dispatch({ type: 'edit', docId, rowId, patch }),
    note: (docId, rowId, note) => dispatch({ type: 'note', docId, rowId, note }),
    undo: (docId, rowId) => dispatch({ type: 'undo', docId, rowId }),
    acceptAllClean: (docId, page) => {
      const ids = viewsFor(docId, page).filter(v => v.flags.length === 0 && v.row.status === 'pending').map(v => v.row.id)
      if (ids.length) dispatch({ type: 'acceptMany', docId, rowIds: ids })
      return ids.length
    },
    addRow: (docId, row) => dispatch({ type: 'addRow', docId, row }),
    removeAdded: (docId, rowId) => dispatch({ type: 'removeAdded', docId, rowId }),
    routerMiss: (docId, page) => dispatch({ type: 'routerMiss', docId, page }),
    startFresh: docId => { clearDocReview(docId, runId); dispatch({ type: 'startFresh', docId, runId }) },
    dismissRestored: docId => dispatch({ type: 'dismissRestored', docId }),
  }), [viewsFor, runId])

  const value = useMemo<ReviewContextValue>(() => ({
    batch, labels, runId, docs: batch.documents, hydrated: state.hydrated, api,
    viewsFor, allViews, pageStates, summary, review,
    restored: docId => !!state.restored[docId],
  }), [batch, labels, runId, state.hydrated, state.restored, api, viewsFor, allViews, pageStates, summary, review])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useReview(): ReviewContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useReview must be used inside ReviewProvider')
  return v
}
