/**
 * Deterministic text layout for placeholder pages. The same layout draws the placeholder SVG and
 * positions quote highlights on it, so the two always agree. Rendered PDF pages do not use this.
 */
import type { Box } from '../types'

export const PAGE = { w: 850, h: 1100 }
const CFG = { charsPerLine: 88, left: 0.08, width: 0.84, top: 0.075, lineH: 0.0175, paraGap: 0.012 }

export interface Line { text: string; start: number; end: number; y: number }
export interface Layout { lines: Line[] }

export function layoutPage(text: string): Layout {
  const lines: Line[] = []
  let y = CFG.top
  const push = (s: number, e: number) => { lines.push({ text: text.slice(s, e), start: s, end: e, y }); y += CFG.lineH }
  for (const para of text.matchAll(/[^\n]+/g)) {
    const base = para.index ?? 0
    const tokens = [...para[0].matchAll(/\S+/g)].map(m => ({ s: base + (m.index ?? 0), e: base + (m.index ?? 0) + m[0].length }))
    if (!tokens.length) continue
    let ls = tokens[0].s, le = tokens[0].e
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.e - ls > CFG.charsPerLine) { push(ls, le); ls = t.s }
      le = t.e
    }
    push(ls, le)
    y += CFG.paraGap
  }
  return { lines }
}

function lineWidth(l: Line): number {
  return CFG.width * Math.min(1, (l.end - l.start) / CFG.charsPerLine)
}

/** Highlight boxes for original-text offsets [start, end). */
export function boxesForRange(layout: Layout, start: number, end: number): Box[] {
  const boxes: Box[] = []
  for (const l of layout.lines) {
    if (l.end <= start || l.start >= end) continue
    const len = Math.max(1, l.end - l.start)
    const a = Math.max(start, l.start) - l.start
    const b = Math.min(end, l.end) - l.start
    const w = lineWidth(l)
    boxes.push({ x: CFG.left + w * (a / len), y: l.y - CFG.lineH * 0.78, w: w * ((b - a) / len), h: CFG.lineH })
  }
  return boxes
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Placeholder page: page number rendered large, with the page text laid out in monospace. */
export function placeholderSvg(page: number, total: number, layout: Layout): string {
  // monospace so a character fraction of the line maps to a width fraction of the line
  const fontPx = (CFG.width * PAGE.w) / (CFG.charsPerLine * 0.6)
  const textEls = layout.lines
    .map(l => `<text x="${(CFG.left * PAGE.w).toFixed(1)}" y="${(l.y * PAGE.h).toFixed(1)}" font-size="${fontPx.toFixed(2)}" xml:space="preserve">${esc(l.text)}</text>`)
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.w}" height="${PAGE.h}" viewBox="0 0 ${PAGE.w} ${PAGE.h}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<text x="${PAGE.w / 2}" y="${PAGE.h * 0.58}" font-family="Helvetica, Arial, sans-serif" font-size="320" font-weight="700" fill="#f3f1ef" text-anchor="middle">${page}</text>` +
    `<g font-family="ui-monospace, Menlo, Consolas, monospace" fill="#44403c">${textEls}</g>` +
    `<text x="${PAGE.w / 2}" y="${PAGE.h - 26}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#a8a29e" text-anchor="middle">Placeholder page image, ${page} of ${total}</text>` +
    `</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
