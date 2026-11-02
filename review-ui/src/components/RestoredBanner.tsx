import { useReview } from '../state/reviewStore'
import { Button } from './ui'

export function RestoredBanner({ docId }: { docId: string }) {
  const { restored, api } = useReview()
  if (!restored(docId)) return null
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-100 px-4 py-1.5 text-xs text-stone-700">
      <span>Restored your progress for this document.</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => api.dismissRestored(docId)}>OK</Button>
        <Button size="sm" variant="ghost" onClick={() => { if (confirm('Discard all saved decisions for this document?')) api.startFresh(docId) }}>Start fresh</Button>
      </div>
    </div>
  )
}
