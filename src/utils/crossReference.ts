import type { AuditIssue, CaptureMeta, ComparisonLayout, DOMElementNode, Rect } from '../types/audit'
import { domNodeForComparisonRect } from './domMatch'
import { rectCenter } from './geometry'
import type { PixelSampler } from './pixelSampler'

export interface CrossReferenceContext {
  designSampler: PixelSampler | null
  implSampler: PixelSampler | null
  layout: ComparisonLayout
  meta: CaptureMeta | null
}

export interface CrossReference {
  designHex: string | null
  implHex: string | null
  dom: DOMElementNode | null
}

/**
 * Smart cross-referencing: takes a bounding box and
 *  - samples the exact HEX from the raw Design / Implementation pixels,
 *  - resolves the live DOM element (tag, classes, computed styles) matching the area.
 */
export function crossReferenceRect(rect: Rect, ctx: CrossReferenceContext): CrossReference {
  const center = rectCenter(rect)
  const cx = Math.floor(center.x)
  const cy = Math.floor(center.y)
  const { offsetX, offsetY } = ctx.layout
  return {
    designHex: ctx.designSampler?.hexAt(cx, cy) ?? null,
    implHex: ctx.implSampler?.hexAt(cx - offsetX, cy - offsetY) ?? null,
    dom: domNodeForComparisonRect(ctx.meta, rect, offsetX, offsetY),
  }
}

/** Re-runs cross-referencing for every issue (e.g. after a re-capture or offset nudge). */
export function refreshIssueReferences(issues: AuditIssue[], ctx: CrossReferenceContext): AuditIssue[] {
  return issues.map((issue) => ({ ...issue, ...crossReferenceRect(issue.rect, ctx) }))
}
