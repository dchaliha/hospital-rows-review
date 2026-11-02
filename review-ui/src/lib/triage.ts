import type { Flag, LabelSet, Row } from '../types'
import { quoteOnPage, wordCount } from './quoteCheck'

/** Display order: hardest problems first. */
export const FLAG_ORDER: Flag[] = ['quote_not_on_page', 'over_limit', 'runs_disagree', 'no_fit', 'needs_look', 'dup', 'inferred']

/** Flags the UI recomputes live from the row's current fields; the rest come from the pipeline. */
const DERIVED: ReadonlySet<Flag> = new Set<Flag>(['quote_not_on_page', 'over_limit', 'inferred', 'no_fit'])

export function computeFlags(row: Row, pageText: string, labels: LabelSet): Flag[] {
  const out = new Set<Flag>(row.flags.filter(f => !DERIVED.has(f)))
  if (row.evidenceType === 'inferred') out.add('inferred')
  if (row.label === labels.noFit) out.add('no_fit')
  if (wordCount(row.quote) > labels.quoteWordLimit) out.add('over_limit')
  if (!quoteOnPage(pageText, row.quote)) out.add('quote_not_on_page')
  return FLAG_ORDER.filter(f => out.has(f))
}

export function flagLabel(f: Flag, row: Row, labels: LabelSet): string {
  const note = row.flagNotes?.[f]
  switch (f) {
    case 'quote_not_on_page': return note ?? 'Quote not found on this page'
    case 'over_limit': return `Quote is over the ${labels.quoteWordLimit}-word limit`
    case 'runs_disagree': return note ?? 'Two runs disagreed'
    case 'no_fit': return 'No label fits'
    case 'needs_look': return note ?? 'Only loosely matches the label'
    case 'dup': return note ?? 'Looks like a duplicate of another row on this page'
    case 'inferred': return row.inferredNote ? `Inferred: ${row.inferredNote}` : 'Inferred, not stated on the page'
  }
}

export type Verdict = 'Likely' | 'Needs a look' | 'Unsupported'

export function verdictOf(flags: Flag[]): Verdict {
  if (flags.includes('quote_not_on_page')) return 'Unsupported'
  return flags.length ? 'Needs a look' : 'Likely'
}

/** Card order on a page: 0 = flagged, 1 = inferred only, 2 = clean. */
export function tierOf(flags: Flag[]): 0 | 1 | 2 {
  if (!flags.length) return 2
  return flags.every(f => f === 'inferred') ? 1 : 0
}

export type PageState = 'skipped' | 'empty' | 'untouched' | 'in_progress' | 'clean_pending' | 'done'

export const PAGE_STATE_LABEL: Record<PageState, string> = {
  skipped: 'Skipped by router',
  empty: 'No rows',
  untouched: 'Not started',
  in_progress: 'Flagged rows still pending',
  clean_pending: 'Clean rows still pending',
  done: 'Done',
}
