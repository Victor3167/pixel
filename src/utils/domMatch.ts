import type { CaptureMeta, DOMElementNode, Point } from '../types/audit'

/** Smallest (deepest) visible element whose CSS-px rect contains the point. */
export function findDomNodeAt(domMap: DOMElementNode[], cssX: number, cssY: number): DOMElementNode | null {
  let best: DOMElementNode | null = null
  let bestArea = Infinity
  for (const node of domMap) {
    const { x, y, width, height } = node.rect
    if (cssX < x || cssY < y || cssX >= x + width || cssY >= y + height) continue
    const area = width * height
    if (area < bestArea || (area === bestArea && best !== null && node.depth >= best.depth)) {
      best = node
      bestArea = area
    }
  }
  return best
}

/**
 * Comparison-space pixel -> DOM node, honouring the Implementation offset and
 * the Playwright device scale factor.
 */
export function domNodeAtComparisonPoint(
  meta: CaptureMeta | null,
  point: Point,
  offsetX: number,
  offsetY: number,
): DOMElementNode | null {
  if (!meta) return null
  const dsf = meta.deviceScaleFactor
  return findDomNodeAt(meta.domMap, (point.x - offsetX) / dsf, (point.y - offsetY) / dsf)
}

/** `<div id="hero" class="card p-4">` style opening tag. */
export function describeDomNode(node: DOMElementNode): string {
  const id = node.id ? ` id="${node.id}"` : ''
  const cls = node.className ? ` class="${node.className}"` : ''
  return `<${node.tagName}${id}${cls}>`
}

/** Compact CSS selector hint: `div#hero.card.p-4`. */
export function selectorHint(node: DOMElementNode): string {
  const id = node.id ? `#${node.id}` : ''
  const classes = node.className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((c) => `.${c}`)
    .join('')
  return `${node.tagName}${id}${classes}`
}
