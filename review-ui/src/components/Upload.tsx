import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Screen } from './ui'
import { withBase } from '../sources'

interface Health { ok: boolean; model: string; hasApiKey: boolean; maxPages: number }
interface ExtractResult { document: { id: string; pageCount: number }; rows: unknown[]; warnings: string[]; extraction: { durationSeconds: number; perPage: { page: number; rows: number; seconds: number; error?: string }[] } }

export function Upload({ onDone }: { onDone: (docId: string) => void }) {
  const [health, setHealth] = useState<Health | null | 'down'>(null)
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<'CHNA' | 'implementation strategy'>('CHNA')
  const [name, setName] = useState('')
  const [pages, setPages] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(withBase('api/health')).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setHealth).catch(() => setHealth('down'))
  }, [])

  useEffect(() => {
    if (!busy) return
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [busy])

  const pick = (f: File | null) => {
    setFile(f)
    setResult(null)
    setError(null)
    if (f && !name) setName(f.name.replace(/\.pdf$/i, ''))
    if (f && /\bIS\b|implementation|CHIP/i.test(f.name)) setDocType('implementation strategy')
  }

  const run = async () => {
    if (!file) return
    setBusy(true); setError(null); setResult(null)
    const body = new FormData()
    body.append('file', file)
    body.append('docType', docType)
    body.append('sourceName', name)
    body.append('pages', pages)
    try {
      const r = await fetch(withBase('api/extract'), { method: 'POST', body })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? `server returned ${r.status}`)
      setResult(data as ExtractResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const serverDown = health === 'down'
  return (
    <Screen>
      <a href="#/" className="text-sm text-stone-600 hover:underline">Overview</a>
      <h1 className="mt-2 text-xl font-semibold">Upload a page</h1>
      <p className="mt-1 text-sm text-stone-600">A single-page PDF works best. The server extracts the text, runs the page prompt once, checks every quote against the page, and opens the result for review.</p>

      <div className="mt-4 text-xs">
        {health === null && <span className="text-stone-500">Checking the extraction server…</span>}
        {serverDown && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            The extraction server is not running. Start it from the exercise folder, then reload this page:
            <pre className="mt-2 rounded bg-white p-2 text-[11px] text-stone-800">python3 review-ui/server/extract_server.py</pre>
          </div>
        )}
        {health && health !== 'down' && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="green">Server ready</Chip>
            <Chip>Model: {health.model}</Chip>
            {health.hasApiKey ? <Chip tone="green">API key found</Chip> : <Chip tone="amber">No API key: pages will load with no rows</Chip>}
            <Chip>Up to {health.maxPages} pages per upload</Chip>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 rounded-lg border border-stone-200 bg-white p-4">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0] ?? null) }}
          onClick={() => fileInput.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm ${file ? 'border-stone-400 bg-stone-50' : 'border-stone-300 hover:bg-stone-50'}`}>
          {file ? <span className="font-medium">{file.name}</span> : <span className="text-stone-600">Drop a PDF here, or click to choose one</span>}
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-stone-500">Document type
            <select value={docType} onChange={e => setDocType(e.target.value as typeof docType)} className="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900">
              <option value="CHNA">CHNA</option>
              <option value="implementation strategy">implementation strategy</option>
            </select>
          </label>
          <label className="block text-xs text-stone-500">Name shown in the review
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CHNA p23" className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm text-stone-900" />
          </label>
          <label className="block text-xs text-stone-500">Pages to extract (optional)
            <input value={pages} onChange={e => setPages(e.target.value)} placeholder="all, or e.g. 1,3" className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm text-stone-900" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={!file || busy || serverDown} onClick={run}>{busy ? `Extracting… ${elapsed}s` : 'Extract rows'}</Button>
          {busy && <span className="text-xs text-stone-500">One model call per page, usually 15 to 40 seconds each.</span>}
        </div>
        {error && <p className="text-sm text-amber-900">Could not extract: {error}</p>}
        {result && (
          <div className="rounded border border-stone-200 bg-stone-50 p-3 text-sm">
            <p><span className="font-medium">{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span> from {result.extraction.perPage.length} page{result.extraction.perPage.length === 1 ? '' : 's'} in {result.extraction.durationSeconds}s.</p>
            {result.extraction.perPage.map(p => (
              <p key={p.page} className="text-xs text-stone-600">Page {p.page}: {p.error ? `failed (${p.error})` : `${p.rows} row${p.rows === 1 ? '' : 's'}, ${p.seconds}s`}</p>
            ))}
            {result.warnings.map((w, i) => <p key={i} className="mt-1 text-xs text-amber-900">{w}</p>)}
            <div className="mt-3"><Button variant="primary" onClick={() => onDone(result.document.id)}>Open for review</Button></div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-stone-500">Prompt and schema used: prompts/system_prompt.md, prompts/user_prompt_template.md, prompts/output_schema.json. Raw model output is saved next to the page images under review-ui/public/uploads/.</p>
    </Screen>
  )
}
