/** Shapes follow the review-UI spec exactly; fields past the spec are marked. */

export interface Document {
  id: string
  sourceName: string
  docType: string
  year: number
  pageCount: number
  pageImageUrl(page: number): string
  pageText(page: number): string
  /** pages the upstream router never sent to the model */
  skippedPages: number[]
  /** extra: 'placeholder' pages are drawn in-app; 'rendered' pages are real PDF images */
  imageKind: 'placeholder' | 'rendered'
  /** extra: per-page word boxes, enables drag-to-select on a rendered page image */
  pageWordsUrl?(page: number): string
  /** extra: pipeline notes to show the reviewer, e.g. "no rows were extracted" */
  notes?: string[]
}

export type EvidenceType = 'stated' | 'inferred'

/** 'needs_look' is an addition: the pipeline marks rows it was only somewhat sure about. */
export type Flag =
  | 'quote_not_on_page'
  | 'inferred'
  | 'no_fit'
  | 'runs_disagree'
  | 'over_limit'
  | 'dup'
  | 'needs_look'

export type Status = 'pending' | 'accepted' | 'edited' | 'rejected'

/** fractions of page width / height, origin top-left */
export interface Box { x: number; y: number; w: number; h: number }
export interface Word extends Box { text: string }

export interface Row {
  id: string
  docId: string
  pdfPage: number
  label: string
  role: string
  quote: string
  evidenceType: EvidenceType
  inferredNote?: string
  entityNamed?: string
  population?: string
  section?: string
  flags: Flag[]
  status: Status
  reviewerNote?: string
  labelSetVersion: string
  runId: string
  /** extra: plain-language detail per flag, e.g. runs_disagree: "Two runs disagreed: partners vs funds it" */
  flagNotes?: Partial<Record<Flag, string>>
  /** extra: where the quote sits on the page image, when the pipeline knows */
  quoteBoxes?: Box[]
  /** extra: true for rows the reviewer created in the UI */
  addedByReviewer?: boolean
}

export interface LabelSet {
  version: string
  labels: string[]
  noFit: string
  roles: string[]
  quoteWordLimit: number
}

export const REJECT_REASONS = ['wrong page', 'not supported', 'duplicate', 'label misfit'] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export type EditableFields = Pick<
  Row,
  'label' | 'role' | 'quote' | 'evidenceType' | 'inferredNote' | 'entityNamed' | 'population' | 'section'
>

/** What the reviewer did to one row. Stored separately from the model's row so "Undo" is lossless. */
export interface Decision {
  status: Status
  fields: Partial<EditableFields>
  rejectReason?: RejectReason
  reviewerNote?: string
  updatedAt: number
}

/** Everything saved for one (document, run) pair. */
export interface DocReview {
  runId: string
  decisions: Record<string, Decision>
  added: Row[]
  routerMisses: number[]
}
