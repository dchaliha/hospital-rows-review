/**
 * Quote-on-page check. Mirrors scripts/verify_quotes.py in the pipeline: lowercase, straighten
 * curly quotes and dashes, expand ligatures, collapse whitespace, optionally join hyphenated
 * line breaks. Keeps a map back to original offsets so matches can be highlighted in the text.
 */
export interface Normalized {
  norm: string
  /** map[i] = index in the original string of norm[i] */
  map: number[]
}

const WS = /\s/

function substitute(ch: string): string {
  switch (ch) {
    case '‘': case '’': case 'ʼ': return "'"
    case '“': case '”': return '"'
    case '–': case '—': case '−': return '-'
    case ' ': return ' '
    case 'ﬁ': return 'fi'
    case 'ﬂ': return 'fl'
    case '­': return ''
    case '•': return ' '
    default: return ch
  }
}

export function normalize(text: string, joinHyphenBreaks = false): Normalized {
  const out: string[] = []
  const map: number[] = []
  let prevSpace = true
  const n = text.length
  for (let i = 0; i < n; i++) {
    const ch = text[i]
    if (joinHyphenBreaks && ch === '-') {
      // "commu-\nnity" -> "community"
      let j = i + 1
      while (j < n && (text[j] === ' ' || text[j] === '\t')) j++
      if (j < n && (text[j] === '\n' || text[j] === '\r')) {
        while (j < n && WS.test(text[j])) j++
        if (j < n && /[a-z]/i.test(text[j])) { i = j - 1; continue }
      }
    }
    for (const c of substitute(ch)) {
      if (WS.test(c)) {
        if (prevSpace) continue
        out.push(' '); map.push(i); prevSpace = true
      } else {
        for (const lc of c.toLowerCase()) { out.push(lc); map.push(i) }
        prevSpace = false
      }
    }
  }
  while (out.length && out[out.length - 1] === ' ') { out.pop(); map.pop() }
  return { norm: out.join(''), map }
}

const pageCache = new Map<string, [Normalized, Normalized]>()
function normalizedPage(text: string): [Normalized, Normalized] {
  let v = pageCache.get(text)
  if (!v) {
    if (pageCache.size > 300) pageCache.clear()
    v = [normalize(text, false), normalize(text, true)]
    pageCache.set(text, v)
  }
  return v
}

const EDGE_QUOTES = /^["'“”‘’]+|["'“”‘’]+$/g

export function cleanQuote(q: string): string {
  return q.trim().replace(EDGE_QUOTES, '').trim()
}

export function wordCount(q: string): number {
  const t = cleanQuote(q)
  return t ? t.split(/\s+/).length : 0
}

export interface Match { start: number; end: number }

/** Offsets in the ORIGINAL page text of the first verbatim (normalized) occurrence, or null. */
export function findQuote(pageText: string, quote: string): Match | null {
  const q = normalize(cleanQuote(quote)).norm
  if (!q) return null
  for (const { norm, map } of normalizedPage(pageText)) {
    const idx = norm.indexOf(q)
    if (idx >= 0) return { start: map[idx], end: map[idx + q.length - 1] + 1 }
  }
  return null
}

export function quoteOnPage(pageText: string, quote: string): boolean {
  return findQuote(pageText, quote) !== null
}
