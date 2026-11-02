export const CSV_COLUMNS = [
  'doc', 'pdf_page', 'label', 'role', 'quote', 'evidence_type', 'inferred_note', 'entity_named',
  'population', 'section', 'reviewer_decision', 'reviewer_note', 'label_set_version', 'run_id',
] as const

export type CsvRecord = Record<(typeof CSV_COLUMNS)[number], string>

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(records: CsvRecord[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const r of records) lines.push(CSV_COLUMNS.map(c => cell(r[c] ?? '')).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function download(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
