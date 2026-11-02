import { useEffect, useState } from 'react'
import { loadBatch, loadLabels, type Batch } from './data/load'
import type { LabelSet } from './types'
import { ReviewProvider } from './state/reviewStore'
import { navigate, useHashRoute, type Route } from './router'
import { BatchOverview } from './components/BatchOverview'
import { Wizard } from './components/Wizard'
import { Completion } from './components/Completion'
import { RowsTable } from './components/RowsTable'
import { Upload } from './components/Upload'
import { Button, Screen } from './components/ui'
import { SOURCES, readSource, withBase, type SourceId } from './sources'

export default function App() {
  const route = useHashRoute()
  const [source, setSource] = useState<SourceId>(readSource)
  const [data, setData] = useState<{ labels: LabelSet; batch: Batch } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    Promise.all([loadLabels(withBase('data/labels.json')), loadBatch(SOURCES[source].url)])
      .then(([labels, batch]) => { if (alive) setData({ labels, batch }) })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [source, reloadKey])

  const changeSource = (s: SourceId, to: Route = { name: 'overview' }) => {
    localStorage.setItem('review:source', s)
    if (s === source) setReloadKey(k => k + 1)
    setSource(s)
    navigate(to)
  }

  if (route.name === 'upload') return <Upload onDone={docId => changeSource('uploads', { name: 'wizard', docId, page: 1 })} />

  if (error) {
    return (
      <Screen>
        <p className="font-medium">Could not load {SOURCES[source].label}.</p>
        <p className="mt-1 text-stone-500">{error}</p>
        {source === 'real' && <p className="mt-3">Build it from the exercise folder: <code className="rounded bg-stone-100 px-1">python3 -I scripts/build_review_batch.py</code></p>}
        {source === 'uploads' && <p className="mt-3">Start the extraction server from the exercise folder: <code className="rounded bg-stone-100 px-1">python3 review-ui/server/extract_server.py</code></p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => setReloadKey(k => k + 1)}>Try again</Button>
          <Button onClick={() => changeSource('mock')}>Use the mock batch</Button>
        </div>
      </Screen>
    )
  }
  if (!data) return <Screen>Loading {SOURCES[source].label}&hellip;</Screen>

  return (
    <ReviewProvider key={`${source}:${reloadKey}`} batch={data.batch} labels={data.labels}>
      {route.name === 'overview' && <BatchOverview source={source} onSourceChange={changeSource} />}
      {route.name === 'wizard' && <Wizard docId={route.docId} page={route.page} rowId={route.rowId} />}
      {route.name === 'done' && <Completion docId={route.docId} />}
      {route.name === 'rows' && <RowsTable />}
    </ReviewProvider>
  )
}
