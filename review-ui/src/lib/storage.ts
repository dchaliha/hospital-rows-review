import type { DocReview } from '../types'

const key = (docId: string, runId: string) => `review:${docId}:${runId}`

export function loadDocReview(docId: string, runId: string): DocReview | null {
  try {
    const raw = localStorage.getItem(key(docId, runId))
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<DocReview>
    return { runId, decisions: r.decisions ?? {}, added: r.added ?? [], routerMisses: r.routerMisses ?? [] }
  } catch {
    return null
  }
}

export function saveDocReview(docId: string, runId: string, r: DocReview): void {
  try { localStorage.setItem(key(docId, runId), JSON.stringify(r)) } catch { /* storage unavailable: keep in memory */ }
}

export function clearDocReview(docId: string, runId: string): void {
  try { localStorage.removeItem(key(docId, runId)) } catch { /* ignore */ }
}
