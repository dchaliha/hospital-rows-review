import { useEffect, useState } from 'react'

export type Route =
  | { name: 'overview' }
  | { name: 'wizard'; docId: string; page: number; rowId?: string }
  | { name: 'done'; docId: string }
  | { name: 'rows' }
  | { name: 'upload' }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const params = new URLSearchParams(query)
  if (parts[0] === 'rows') return { name: 'rows' }
  if (parts[0] === 'upload') return { name: 'upload' }
  if (parts[0] === 'doc' && parts[1]) {
    if (parts[2] === 'page' && parts[3]) {
      const p = Number(parts[3])
      if (Number.isInteger(p) && p > 0) return { name: 'wizard', docId: parts[1], page: p, rowId: params.get('row') ?? undefined }
    }
    if (parts[2] === 'done') return { name: 'done', docId: parts[1] }
  }
  return { name: 'overview' }
}

export function toHash(r: Route): string {
  switch (r.name) {
    case 'overview': return '#/'
    case 'rows': return '#/rows'
    case 'upload': return '#/upload'
    case 'wizard': return `#/doc/${encodeURIComponent(r.docId)}/page/${r.page}${r.rowId ? `?row=${encodeURIComponent(r.rowId)}` : ''}`
    case 'done': return `#/doc/${encodeURIComponent(r.docId)}/done`
  }
}

export function navigate(r: Route): void {
  location.hash = toHash(r)
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const h = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return route
}
