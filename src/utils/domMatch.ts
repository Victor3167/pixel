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
 * Finds the most relevant and specific DOM element intersecting an issue's bounding box.
 * Prioritises interactive/semantic leaf elements (a, button, heading, text snippets, svg)
 * over generic full-width wrappers.
 */
export function findBestMatchingDomNode(
  domMap: DOMElementNode[],
  issueRect: { x: number; y: number; width: number; height: number },
): DOMElementNode | null {
  if (!domMap || domMap.length === 0) return null

  const { x: ix, y: iy, width: iw, height: ih } = issueRect
  const issueArea = Math.max(1, iw * ih)

  let bestNode: DOMElementNode | null = null
  let highestScore = -Infinity

  const INTERACTIVE_TAGS = new Set([
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'svg',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'span',
    'img',
    'label',
  ])

  for (const node of domMap) {
    const { x: nx, y: ny, width: nw, height: nh } = node.rect
    const xOverlap = Math.max(0, Math.min(ix + iw, nx + nw) - Math.max(ix, nx))
    const yOverlap = Math.max(0, Math.min(iy + ih, ny + nh) - Math.max(iy, ny))
    const overlapArea = xOverlap * yOverlap
    if (overlapArea <= 0) continue

    const nodeArea = Math.max(1, nw * nh)
    const nodeCoverage = overlapArea / nodeArea // How much of the node is inside the issue box
    const issueCoverage = overlapArea / issueArea // How much of the issue box is covered

    let score = nodeCoverage * 40 + issueCoverage * 20 + node.depth * 5

    // Strongly prioritize semantic/leaf/interactive tags
    if (INTERACTIVE_TAGS.has(node.tagName.toLowerCase())) {
      score += 50
    }
    // Strongly prioritize nodes with actual text content
    if (node.textSnippet && node.textSnippet.trim().length > 0) {
      score += 45
    }
    // Penalize huge full-width containers (e.g. body, main, full-bleed backgrounds)
    if (nw >= 1200 && nh >= 400) {
      score -= 70
    }

    if (score > highestScore) {
      highestScore = score
      bestNode = node
    }
  }

  // Fallback to center-point match if no intersection was scored
  if (!bestNode) {
    const cx = ix + iw / 2
    const cy = iy + ih / 2
    bestNode = findDomNodeAt(domMap, cx, cy)
  }

  return bestNode
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

/**
 * Comparison-space Rect -> best matching DOM node in the live implementation.
 */
export function domNodeForComparisonRect(
  meta: CaptureMeta | null,
  rect: { x: number; y: number; width: number; height: number },
  offsetX: number,
  offsetY: number,
): DOMElementNode | null {
  if (!meta) return null
  const dsf = meta.deviceScaleFactor
  const cssRect = {
    x: (rect.x - offsetX) / dsf,
    y: (rect.y - offsetY) / dsf,
    width: rect.width / dsf,
    height: rect.height / dsf,
  }
  return findBestMatchingDomNode(meta.domMap, cssRect)
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
