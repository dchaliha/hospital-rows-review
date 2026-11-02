import { useEffect, useState } from 'react'

/** Site base path ('/' in dev, '/<repo>/' on GitHub Pages). Always ends with a slash. */
export const BASE = import.meta.env.BASE_URL
export const withBase = (path: string) => BASE + path.replace(/^\//, '')

export const SOURCES = {
  mock: { label: 'Mock batch', url: withBase('data/batch.json') },
  real: { label: 'Providence Valdez pages', url: withBase('data/batch.real.json') },
  uploads: { label: 'Uploaded pages', url: withBase('api/uploads') },
} as const

export type SourceId = keyof typeof SOURCES

/** Batch to show: ?source=mock|real|uploads in the URL wins and is remembered; otherwise the last choice. */
export function readSource(): SourceId {
  const fromUrl = new URLSearchParams(location.search).get('source')
  const s = fromUrl ?? localStorage.getItem('review:source')
  const id: SourceId = s === 'real' || s === 'uploads' ? s : 'mock'
  if (fromUrl) localStorage.setItem('review:source', id)
  return id
}

export interface Health { ok: boolean; model: string; hasApiKey: boolean; maxPages: number }
let healthPromise: Promise<Health | null> | null = null
/** The local extraction server, or null when it is not reachable (for example on the static public site). */
export function fetchHealth(): Promise<Health | null> {
  healthPromise ??= fetch(withBase('api/health')).then(r => (r.ok ? (r.json() as Promise<Health>) : null)).catch(() => null)
  return healthPromise
}
export function useHealth(): Health | null | undefined {
  const [h, setH] = useState<Health | null | undefined>(undefined)
  useEffect(() => { fetchHealth().then(setH) }, [])
  return h
}
