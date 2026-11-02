import { useCallback, useEffect, useState } from 'react'
import { useReview } from '../state/reviewStore'
import { navigate } from '../router'
import { useKeyboard } from '../hooks/useKeyboard'
import { PagePane } from './PagePane'
import { RowCard } from './RowCard'
import { PageNav } from './PageNav'
import { AddRowDialog, type NewRowFields } from './AddRowDialog'
import { KeyboardHelp } from './KeyboardHelp'
import { RestoredBanner } from './RestoredBanner'
import { Button, Chip, Screen } from './ui'
import { REJECT_REASONS, type Box } from '../types'

/** 0 = fit the page in the pane; others are percent of the fitted size */
const ZOOMS = [0, 125, 150, 200]
const zoomLabel = (z: number) => (z === 0 ? 'Fit' : `${z}%`)

export function Wizard({ docId, page, rowId }: { docId: string; page: number; rowId?: string }) {
  const { docs } = useReview()
  const [showText, setShowText] = useState(() => localStorage.getItem('review:showText') === '1')
  const [zoom, setZoom] = useState(() => { const z = Number(localStorage.getItem('review:zoom')); return ZOOMS.includes(z) ? z : 0 })
  useEffect(() => { localStorage.setItem('review:showText', showText ? '1' : '0') }, [showText])
  useEffect(() => { localStorage.setItem('review:zoom', String(zoom)) }, [zoom])

  const doc = docs.find(d => d.id === docId)
  if (!doc) return <Screen>No document with id "{docId}". <a className="underline" href="#/">Back to overview</a></Screen>
  if (page < 1 || page > doc.pageCount) return <Screen>Page {page} is out of range (1 to {doc.pageCount}). <a className="underline" href={`#/doc/${docId}/page/1`}>Go to page 1</a></Screen>
  return (
    <PageScreen key={`${docId}:${page}`} docId={docId} page={page} initialRowId={rowId} showText={showText} zoom={zoom}
      onToggleText={() => setShowText(s => !s)} onCycleZoom={() => setZoom(z => ZOOMS[(ZOOMS.indexOf(z) + 1) % ZOOMS.length])} />
  )
}

interface PageProps { docId: string; page: number; initialRowId?: string; showText: boolean; zoom: number; onToggleText: () => void; onCycleZoom: () => void }

function PageScreen({ docId, page, initialRowId, showText, zoom, onToggleText, onCycleZoom }: PageProps) {
  const { docs, labels, runId, viewsFor, pageStates, review, api } = useReview()
  const doc = docs.find(d => d.id === docId)!
  const views = viewsFor(docId, page)
  const [selectedId, setSelectedId] = useState<string | null>(initialRowId ?? views[0]?.row.id ?? null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ quote: string; boxes?: Box[] } | null>(null)
  const [showKeys, setShowKeys] = useState(false)

  useEffect(() => {
    if (selectedId && !views.some(v => v.row.id === selectedId)) setSelectedId(views[0]?.row.id ?? null)
    if (!selectedId && views.length) setSelectedId(views[0].row.id)
  }, [views, selectedId])
  useEffect(() => {
    if (initialRowId) document.querySelector(`[data-rowid="${CSS.escape(initialRowId)}"]`)?.scrollIntoView({ block: 'center' })
  }, [initialRowId])

  const flaggedPending = views.filter(v => v.flags.length > 0 && v.row.status === 'pending').length
  const cleanPending = views.filter(v => v.flags.length === 0 && v.row.status === 'pending').length
  const needLook = views.filter(v => v.flags.length > 0).length
  const canNext = flaggedPending === 0
  const isLast = page >= doc.pageCount
  const skipped = doc.skippedPages.includes(page)
  const missLogged = review(docId).routerMisses.includes(page)

  const go = useCallback((p: number) => { if (p >= 1 && p <= doc.pageCount) navigate({ name: 'wizard', docId, page: p }) }, [docId, doc.pageCount])
  const goNext = useCallback(() => { if (canNext) navigate(isLast ? { name: 'done', docId } : { name: 'wizard', docId, page: page + 1 }) }, [canNext, isLast, docId, page])
  const goBack = useCallback(() => navigate(page > 1 ? { name: 'wizard', docId, page: page - 1 } : { name: 'overview' }), [docId, page])

  const select = (id: string) => {
    setSelectedId(id)
    document.querySelector(`[data-rowid="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }
  const move = (delta: number) => {
    if (!views.length) return
    const i = Math.max(0, views.findIndex(v => v.row.id === selectedId))
    select(views[Math.min(views.length - 1, Math.max(0, i + delta))].row.id)
  }
  const startEdit = (id: string) => {
    setSelectedId(id)
    setEditingId(id)
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`[data-quote-for="${CSS.escape(id)}"]`)?.focus())
  }

  useKeyboard((key, e) => {
    if (adding) { if (key === 'Escape') setAdding(null); return }
    if (showKeys) { if (key === 'Escape' || key === '?') setShowKeys(false); return }
    if (rejectingId) {
      if (key === 'Escape') setRejectingId(null)
      const n = Number(key)
      if (n >= 1 && n <= REJECT_REASONS.length) { api.reject(docId, rejectingId, REJECT_REASONS[n - 1]); setRejectingId(null) }
      return
    }
    switch (key) {
      case 'j': move(1); break
      case 'k': move(-1); break
      case 'a': if (selectedId) api.accept(docId, selectedId); break
      case 'r': if (selectedId && views.find(v => v.row.id === selectedId)?.row.status !== 'rejected') setRejectingId(selectedId); break
      case 'e': if (selectedId) { e.preventDefault(); startEdit(selectedId) } break
      case 'n': goNext(); break
      case 'b': goBack(); break
      case 'g': e.preventDefault(); document.getElementById('page-input')?.focus(); break
      case 'Escape': setEditingId(null); break
      case '?': setShowKeys(true); break
    }
  })

  const saveAdded = (f: NewRowFields) => {
    const id = `added-${docId}-p${page}-${Date.now().toString(36)}`
    api.addRow(docId, { id, docId, pdfPage: page, ...f, flags: [], status: 'accepted', labelSetVersion: labels.version, runId, addedByReviewer: true, quoteBoxes: adding?.boxes })
    setAdding(null)
    setSelectedId(id)
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-200 bg-white px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <a href="#/" className="shrink-0 text-stone-600 hover:underline">Overview</a>
          <span className="text-stone-300">/</span>
          <span className="truncate font-medium">{doc.sourceName}</span>
          <Chip className="shrink-0">{doc.docType}</Chip>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Button size="sm" variant="ghost" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">&larr;</Button>
          <span className="text-stone-500">Page</span>
          <PageInput page={page} max={doc.pageCount} onGo={go} />
          <span className="text-stone-500">of {doc.pageCount}</span>
          <Button size="sm" variant="ghost" onClick={() => go(page + 1)} disabled={page >= doc.pageCount} aria-label="Next page">&rarr;</Button>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onCycleZoom} title="Page size">{zoomLabel(zoom)}</Button>
          <Button size="sm" variant={showText ? 'primary' : 'ghost'} onClick={onToggleText}>Text</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowKeys(true)} title="Keyboard shortcuts">?</Button>
        </div>
      </header>
      <RestoredBanner docId={docId} />
      {skipped && (
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-100 px-4 py-1.5 text-xs text-stone-700">
          <span>This page was not sent to the model.</span>
          {missLogged ? <Chip>Logged as a router miss</Chip> : <Button size="sm" onClick={() => api.routerMiss(docId, page)}>This page has content</Button>}
        </div>
      )}
      {doc.notes?.length ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">{doc.notes.join(' ')}</div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="w-[58%] min-w-0 border-r border-stone-200">
          <PagePane doc={doc} page={page} views={views} selectedId={selectedId} hoveredId={hoveredId} zoom={zoom} showText={showText}
            onHover={setHoveredId} onSelect={select} onAddRow={(quote, boxes) => setAdding({ quote, boxes })} />
        </section>
        <aside className="flex w-[42%] min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600">
            <span>{views.length === 0 ? 'No rows on this page' : `${views.length} row${views.length === 1 ? '' : 's'}${needLook ? `, ${needLook} need a look` : ''}`}</span>
            <Button size="sm" onClick={() => setAdding({ quote: '' })}>Add a row</Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-auto bg-stone-50 p-3">
            {views.length === 0 && (
              <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                Nothing was extracted here. If the page has something that fits a label, add a row.
              </div>
            )}
            {views.map(v => (
              <RowCard key={v.row.id} docId={docId} view={v} labels={labels} selected={v.row.id === selectedId} rejecting={rejectingId === v.row.id} editing={editingId === v.row.id}
                onSelect={() => setSelectedId(v.row.id)} onHover={h => setHoveredId(h ? v.row.id : null)}
                onRejectOpen={() => { setSelectedId(v.row.id); setRejectingId(v.row.id) }} onRejectClose={() => setRejectingId(null)}
                onEdit={() => startEdit(v.row.id)} onDoneEditing={() => setEditingId(null)} />
            ))}
          </div>
        </aside>
      </div>

      <PageNav states={pageStates(docId)} current={page} onJump={go} />

      <footer className="flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-2">
        <Button onClick={goBack}>{page > 1 ? 'Back' : 'Overview'}</Button>
        <div className="flex items-center gap-3 text-xs">
          {cleanPending > 0 && <Button size="sm" onClick={() => api.acceptAllClean(docId, page)} title="Only rows with no flags. Flagged rows are decided one by one.">Accept the {cleanPending} clean row{cleanPending === 1 ? '' : 's'}</Button>}
          {!canNext && <span className="text-amber-800">Decide the {flaggedPending} flagged row{flaggedPending === 1 ? '' : 's'} to continue</span>}
        </div>
        <Button variant="primary" disabled={!canNext} onClick={goNext} title={canNext ? undefined : 'Flagged rows are still pending'}>{isLast ? 'Finish' : 'Next'}</Button>
      </footer>

      {adding && <AddRowDialog initialQuote={adding.quote} labels={labels} pageText={doc.pageText(page)} onSave={saveAdded} onCancel={() => setAdding(null)} />}
      {showKeys && <KeyboardHelp onClose={() => setShowKeys(false)} />}
    </div>
  )
}

function PageInput({ page, max, onGo }: { page: number; max: number; onGo: (p: number) => void }) {
  const [val, setVal] = useState(String(page))
  useEffect(() => setVal(String(page)), [page])
  const commit = () => { const n = Number(val); if (Number.isInteger(n) && n >= 1 && n <= max && n !== page) onGo(n); else setVal(String(page)) }
  return (
    <input id="page-input" value={val} onChange={e => setVal(e.target.value.replace(/\D/g, ''))} onBlur={commit} onFocus={e => e.target.select()}
      onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }}
      inputMode="numeric" aria-label="Page number" title="Type a page number and press Enter (G)"
      className="w-12 rounded border border-stone-300 px-1.5 py-0.5 text-center text-sm tabular-nums text-stone-900" />
  )
}
