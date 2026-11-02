import type { Document, LabelSet, Row, Word } from '../types'
import { layoutPage, placeholderSvg } from '../lib/layout'
import { withBase } from '../sources'

/** Serializable form of Document (JSON cannot hold the two page accessors). */
export interface DocumentJson {
  id: string
  sourceName: string
  docType: string
  year: number
  pageCount: number
  pageImage: { kind: 'placeholder' } | { kind: 'template'; template: string; pad?: number }
  /** page number (as string) -> extracted text */
  pageTexts: Record<string, string>
  skippedPages?: number[]
  /** optional template for per-page word boxes, e.g. "/pages/CHNA/p{page}.words.json" */
  wordsTemplate?: string
  notes?: string[]
}

export interface BatchJson { runId: string; documents: DocumentJson[]; rows: Row[] }
export interface Batch { runId: string; documents: Document[]; rows: Row[] }

const fill = (template: string, page: number, pad?: number) =>
  withBase(template.replace('{page}', pad ? String(page).padStart(pad, '0') : String(page)))

export function toDocument(d: DocumentJson): Document {
  const pageText = (p: number) => d.pageTexts[String(p)] ?? ''
  const svgCache = new Map<number, string>()
  const pad = d.pageImage.kind === 'template' ? d.pageImage.pad : undefined
  return {
    id: d.id,
    sourceName: d.sourceName,
    docType: d.docType,
    year: d.year,
    pageCount: d.pageCount,
    skippedPages: d.skippedPages ?? [],
    imageKind: d.pageImage.kind === 'template' ? 'rendered' : 'placeholder',
    pageText,
    pageImageUrl(p) {
      if (d.pageImage.kind === 'template') return fill(d.pageImage.template, p, d.pageImage.pad)
      let url = svgCache.get(p)
      if (!url) { url = placeholderSvg(p, d.pageCount, layoutPage(pageText(p))); svgCache.set(p, url) }
      return url
    },
    pageWordsUrl: d.wordsTemplate ? p => fill(d.wordsTemplate!, p, pad) : undefined,
    notes: d.notes,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`${url} returned ${r.status}`)
  return r.json() as Promise<T>
}

export async function loadLabels(url: string): Promise<LabelSet> {
  const l = await fetchJson<Partial<LabelSet>>(url)
  if (!l.labels?.length || !l.roles?.length) throw new Error(`${url}: labels and roles are required`)
  return { version: l.version ?? 'unversioned', labels: l.labels, noFit: l.noFit ?? 'no fit', roles: l.roles, quoteWordLimit: l.quoteWordLimit ?? 40 }
}

export async function loadBatch(url: string): Promise<Batch> {
  const b = await fetchJson<BatchJson>(url)
  return {
    runId: b.runId,
    documents: b.documents.map(toDocument),
    rows: b.rows.map(r => ({ ...r, status: r.status ?? 'pending', flags: r.flags ?? [] })),
  }
}

export function loadWords(url: string): Promise<Word[]> {
  return fetchJson<Word[]>(url)
}
