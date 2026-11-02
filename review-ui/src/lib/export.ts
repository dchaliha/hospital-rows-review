import type { Document } from '../types'
import type { RowView } from '../state/reviewStore'
import type { CsvRecord } from './csv'

/** One CSV record per row. `includeAll` also emits pending and rejected rows. */
export function viewsToRecords(doc: Document, views: RowView[], includeAll: boolean): CsvRecord[] {
  return views
    .filter(v => includeAll || v.row.status === 'accepted' || v.row.status === 'edited')
    .map(v => {
      const r = v.row
      const decision = v.isAdded && r.status !== 'rejected' ? 'added' : r.status
      const note = [r.reviewerNote?.trim(), v.decision?.rejectReason ? `reject reason: ${v.decision.rejectReason}` : '']
        .filter(Boolean)
        .join(' | ')
      return {
        doc: doc.docType,
        pdf_page: String(r.pdfPage),
        label: r.label,
        role: r.role,
        quote: r.quote,
        evidence_type: r.evidenceType,
        inferred_note: r.inferredNote ?? '',
        entity_named: r.entityNamed ?? '',
        population: r.population ?? '',
        section: r.section ?? '',
        reviewer_decision: decision,
        reviewer_note: note,
        label_set_version: r.labelSetVersion,
        run_id: r.runId,
      }
    })
}
