import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { Box, Document, Word } from '../types'
import type { RowView } from '../state/reviewStore'
import { cleanQuote, findQuote, normalize, wordCount } from '../lib/quoteCheck'
import { boxesForRange, layoutPage } from '../lib/layout'
import { loadWords } from '../data/load'
import { Button } from './ui'

interface Props {
  doc: Document
  page: number
  views: RowView[]
  selectedId: string | null
  hoveredId: string | null
  /** 0 = fit the whole page in the pane; otherwise percent of the fitted size */
  zoom: number
  showText: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onAddRow: (quote: string, boxes?: Box[]) => void
}

interface Drag { x0: number; y0: number; x1: number; y1: number }

export function PagePane({ doc, page, views, selectedId, hoveredId, zoom, showText, onHover, onSelect, onAddRow }: Props) {
  const text = doc.pageText(page)
  const [words, setWords] = useState<Word[] | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null) // source of truth during a drag; state only drives the overlay
  const [hint, setHint] = useState<string | null>(null)
  const [selText, setSelText] = useState<string>('')
  const wrap = useRef<HTMLDivElement>(null)
  const textPane = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [paneSize, setPaneSize] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 850, h: 1100 })

  // Fit: size the page so the whole sheet is visible in the pane; zoom scales from there.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPaneSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const PAD = 16
  const fitW = Math.max(120, Math.min(paneSize.w - PAD * 2, (paneSize.h - PAD * 2) * (natural.w / natural.h)))
  const widthPx = Math.round(fitW * (zoom > 0 ? zoom / 100 : 1))

  useEffect(() => {
    let alive = true
    setWords(null)
    const url = doc.pageWordsUrl?.(page)
    if (url) loadWords(url).then(w => { if (alive) setWords(w) }).catch(() => { if (alive) setWords(null) })
    return () => { alive = false }
  }, [doc, page])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 3500)
    return () => clearTimeout(t)
  }, [hint])

  const layout = useMemo(() => (doc.imageKind === 'placeholder' ? layoutPage(text) : null), [doc, text])

  const boxesFor = (v: RowView): Box[] => {
    if (v.row.quote === v.original.quote && v.original.quoteBoxes?.length) return v.original.quoteBoxes
    if (words) { const b = boxesFromWords(words, v.row.quote); if (b.length) return b }
    if (layout) { const m = findQuote(text, v.row.quote); if (m) return boxesForRange(layout, m.start, m.end) }
    return []
  }

  // Drag on the page image to build a quote from word boxes.
  const frac = (e: ReactMouseEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const setDragBoth = (d: Drag | null) => { dragRef.current = d; setDrag(d) }
  const onDown = (e: ReactMouseEvent) => { if (e.button !== 0) return; const p = frac(e); setDragBoth({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }) }
  const onMove = (e: ReactMouseEvent) => { const d = dragRef.current; if (d) { const p = frac(e); setDragBoth({ ...d, x1: p.x, y1: p.y }) } }
  const onUp = () => {
    const d = dragRef.current
    if (!d) return
    setDragBoth(null)
    if (Math.abs(d.x1 - d.x0) < 0.01 || Math.abs(d.y1 - d.y0) < 0.005) return
    if (!words) { setHint('This page has no word positions. Select text in the text pane instead.'); return }
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1)
    const hit = words.filter(w => { const cx = w.x + w.w / 2, cy = w.y + w.h / 2; return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 })
    if (!hit.length) { setHint('No words inside that box.'); return }
    onAddRow(orderWords(hit).map(w => w.text).join(' ').replace(/\s+/g, ' ').trim(), mergeByLine(hit))
  }

  // Selecting text in the text pane offers "Add row from selection".
  const onTextMouseUp = () => {
    const sel = window.getSelection()
    const pane = textPane.current
    if (!sel || sel.isCollapsed || !pane || !sel.anchorNode || !sel.focusNode || !pane.contains(sel.anchorNode) || !pane.contains(sel.focusNode)) { setSelText(''); return }
    setSelText(sel.toString().replace(/\s+/g, ' ').trim())
  }

  const segments = useMemo(() => buildSegments(text, views), [text, views])
  const rect = drag ? { left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) } : null

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-stone-200 p-4">
        <div ref={wrap} style={{ width: widthPx }} className="relative mx-auto select-none shadow-md"
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => setDragBoth(null)}>
          <img src={doc.pageImageUrl(page)} alt={`Page ${page} of ${doc.pageCount}`} draggable={false} className="block w-full bg-white"
            onLoad={e => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setNatural({ w: im.naturalWidth, h: im.naturalHeight }) }} />
          {views.map(v => boxesFor(v).map((b, i) => {
            const sel = v.row.id === selectedId, hov = v.row.id === hoveredId
            return (
              <div key={`${v.row.id}-${i}`} title={`${v.row.label} (${v.row.role})`}
                onMouseDown={e => e.stopPropagation()} onClick={() => onSelect(v.row.id)}
                onMouseEnter={() => onHover(v.row.id)} onMouseLeave={() => onHover(null)}
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                className={`absolute cursor-pointer rounded-sm border ${sel ? 'z-10 border-blue-600 bg-blue-400/30' : hov ? 'border-amber-500 bg-amber-300/50' : 'border-amber-400/70 bg-amber-300/30'}`} />
            )
          }))}
          {rect && <div className="pointer-events-none absolute border border-blue-500 bg-blue-300/20" style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }} />}
        </div>
        {hint && <div className="mx-auto mt-2 w-fit rounded bg-stone-800 px-3 py-1 text-xs text-white">{hint}</div>}
        <p className="mt-2 text-center text-[11px] text-stone-400">
          {words ? 'Drag on the page to add a row from the words inside the box.' : 'Show the text and select a passage to add a row.'}
        </p>
      </div>

      {showText && (
        <div className="relative max-h-[45%] min-h-0 shrink-0 overflow-auto border-t border-stone-300 bg-white">
          {selText && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-xs">
              <span className="truncate text-stone-600">Selected {wordCount(selText)} words</span>
              <Button size="sm" variant="primary" onClick={() => { onAddRow(selText); setSelText('') }}>Add row from selection</Button>
            </div>
          )}
          <div ref={textPane} onMouseUp={onTextMouseUp} className="whitespace-pre-wrap p-3 font-serif text-[13px] leading-6 text-stone-800">
            {text ? segments.map((s, i) => s.ids.length ? (
              <mark key={i} onClick={() => onSelect(s.ids[0])} onMouseEnter={() => onHover(s.ids[0])} onMouseLeave={() => onHover(null)}
                className={`cursor-pointer rounded-sm ${s.ids.includes(selectedId ?? '') ? 'bg-blue-200' : s.ids.includes(hoveredId ?? '') ? 'bg-amber-200' : 'bg-amber-100'}`}>
                {text.slice(s.s, s.e)}
              </mark>
            ) : <span key={i}>{text.slice(s.s, s.e)}</span>) : <span className="text-stone-400">No text was extracted for this page.</span>}
          </div>
        </div>
      )}
    </div>
  )
}

interface Segment { s: number; e: number; ids: string[] }

function buildSegments(text: string, views: RowView[]): Segment[] {
  const marks = views.flatMap(v => { const m = findQuote(text, v.row.quote); return m ? [{ id: v.row.id, ...m }] : [] })
  const pts = [...new Set([0, text.length, ...marks.flatMap(m => [m.start, m.end])])].sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = pts[i + 1]
    if (e <= s) continue
    out.push({ s, e, ids: marks.filter(m => m.start <= s && m.end >= e).map(m => m.id) })
  }
  return out
}

/** Boxes for a quote by matching its normalized text against the page's word stream. */
function boxesFromWords(words: Word[], quote: string): Box[] {
  const q = normalize(cleanQuote(quote)).norm
  if (!q) return []
  const chars: string[] = []
  const owner: number[] = []
  words.forEach((w, i) => {
    const t = normalize(w.text).norm
    if (!t) return
    if (chars.length) { chars.push(' '); owner.push(-1) }
    for (const ch of t) { chars.push(ch); owner.push(i) }
  })
  const idx = chars.join('').indexOf(q)
  if (idx < 0) return []
  const ids = new Set<number>()
  for (let k = idx; k < idx + q.length; k++) if (owner[k] >= 0) ids.add(owner[k])
  return mergeByLine([...ids].map(i => words[i]))
}

/** Reading order: group words into lines by vertical overlap, then left to right. */
function orderWords(ws: Word[]): Word[] {
  const byY = [...ws].sort((a, b) => a.y - b.y)
  const lines: Word[][] = []
  for (const w of byY) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(w.y - line[0].y) < Math.min(w.h, line[0].h) * 0.6) line.push(w)
    else lines.push([w])
  }
  return lines.flatMap(l => l.sort((a, b) => a.x - b.x))
}

function mergeByLine(ws: Word[]): Box[] {
  const out: Box[] = []
  for (const line of groupLines(ws)) {
    const x0 = Math.min(...line.map(w => w.x)), y0 = Math.min(...line.map(w => w.y))
    const x1 = Math.max(...line.map(w => w.x + w.w)), y1 = Math.max(...line.map(w => w.y + w.h))
    out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
  }
  return out
}

function groupLines(ws: Word[]): Word[][] {
  const ordered = orderWords(ws)
  const lines: Word[][] = []
  for (const w of ordered) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(w.y - line[0].y) < Math.min(w.h, line[0].h) * 0.6) line.push(w)
    else lines.push([w])
  }
  return lines
}
