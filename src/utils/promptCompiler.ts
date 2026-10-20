import type { AuditIssue, DesignScale, Rect } from '../types/audit'
import { formatNumber } from './geometry'
import { describeDomNode, selectorHint } from './domMatch'

export interface PromptContext {
  projectName: string
  extraContext: string
  designName: string | null
  designSize: { width: number; height: number } | null
  implName: string | null
  implSize: { width: number; height: number } | null
  designScale: DesignScale
  offset: { x: number; y: number }
  captureUrl: string | null
  captureSelector: string | null
  captureViewport: { width: number; height: number; deviceScaleFactor: number } | null
  matchScore: string | null
  mismatchedPixels: number | null
  totalPixels: number | null
  threshold: number
}

function px(value: number): string {
  return `${formatNumber(Math.round(value * 100) / 100)}px`
}

function rectLine(rect: Rect, scale: number): string {
  const css = (n: number) => px(n / scale)
  const base = `x=${px(rect.x)}, y=${px(rect.y)}, ${px(rect.width)} × ${px(rect.height)}`
  return scale === 1
    ? base
    : `${base} (CSS: x=${css(rect.x)}, y=${css(rect.y)}, ${css(rect.width)} × ${css(rect.height)})`
}

function categoryLabel(issue: AuditIssue): string {
  return `${issue.category} · ${issue.severity} · ${issue.source === 'ai' ? 'AI detected' : 'manual'}`
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Compiles the structured Markdown prompt that is pasted into Cursor /
 * Antigravity IDE to fix the implementation automatically.
 */
export function compilePrompt(context: PromptContext, issues: AuditIssue[]): string {
  const lines: string[] = []
  const title = context.projectName.trim() || 'Front-End'

  lines.push(`# Visual Regression Fix Request — ${title}`)
  lines.push('')
  lines.push(
    'You are a senior front-end engineer. A pixel-accurate audit compared the Designer\'s reference (Figma export) ' +
      'against the live implementation. Fix every issue below directly in the codebase so the UI matches the design exactly.',
  )
  lines.push('')

  lines.push('## Context')
  if (context.extraContext.trim()) {
    lines.push(`- **Project notes:** ${oneLine(context.extraContext)}`)
  }
  if (context.designSize) {
    lines.push(
      `- **Design reference:** ${context.designName ?? 'design'} — ${context.designSize.width}×${context.designSize.height}px ` +
        `export at ${context.designScale}x`,
    )
  }
  if (context.implSize) {
    lines.push(`- **Implementation screenshot:** ${context.implName ?? 'implementation'} — ${context.implSize.width}×${context.implSize.height}px`)
  }
  if (context.captureUrl) {
    const target = context.captureSelector ? ` — element \`${context.captureSelector}\`` : ' — full viewport'
    lines.push(`- **Live page:** ${context.captureUrl}${target}`)
  }
  if (context.captureViewport) {
    const v = context.captureViewport
    lines.push(`- **Capture viewport:** ${v.width}×${v.height} CSS px @ ${v.deviceScaleFactor}x`)
  }
  if (context.matchScore !== null) {
    const detail =
      context.mismatchedPixels !== null && context.totalPixels !== null
        ? ` (${context.mismatchedPixels.toLocaleString('en-US')} of ${context.totalPixels.toLocaleString('en-US')} px differ, threshold ${context.threshold.toFixed(2)})`
        : ''
    lines.push(`- **Pixel Match Score:** ${context.matchScore}%${detail}`)
  }
  lines.push(
    `- **Coordinate system:** origin = top-left of the Design image; values are image pixels` +
      (context.designScale === 1 ? '.' : `, CSS px = image px ÷ ${context.designScale}.`),
  )
  if (context.offset.x !== 0 || context.offset.y !== 0) {
    lines.push(`- **Alignment calibration:** implementation shifted by (${context.offset.x}px, ${context.offset.y}px) before comparing.`)
  }
  lines.push('')

  if (issues.length === 0) {
    lines.push('## Issues')
    lines.push('')
    lines.push('_No issues have been recorded yet._')
    lines.push('')
  } else {
    lines.push(`## Issues (${issues.length})`)
    lines.push('')
    issues.forEach((issue, index) => {
      lines.push(`### #${index + 1} — ${categoryLabel(issue)}`)
      lines.push(`- **Location:** ${rectLine(issue.rect, context.designScale)}`)
      if (issue.dom) {
        lines.push(`- **DOM element:** \`${describeDomNode(issue.dom)}\` → selector hint \`${selectorHint(issue.dom)}\``)
        if (issue.dom.textSnippet) lines.push(`- **Element text:** "${issue.dom.textSnippet}"`)
      } else {
        lines.push('- **DOM element:** _not resolved (no Playwright capture covers this point)_')
      }
      if (issue.designHex || issue.implHex) {
        lines.push(`- **Sampled colour at box centre:** design \`${issue.designHex ?? 'n/a'}\` → implementation \`${issue.implHex ?? 'n/a'}\``)
      }
      if (issue.description.trim()) lines.push(`- **Problem:** ${oneLine(issue.description)}`)
      if (issue.expectedFix.trim()) lines.push(`- **Expected fix:** ${oneLine(issue.expectedFix)}`)
      if (issue.notes.trim()) lines.push(`- **Developer notes:** ${oneLine(issue.notes)}`)
      if (issue.dom) {
        lines.push('- **Current computed CSS (implementation):**')
        lines.push('  ```css')
        for (const [property, value] of Object.entries(issue.dom.computedStyles)) {
          if (!value) continue
          const kebab = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
          lines.push(`  ${kebab}: ${value};`)
        }
        lines.push('  ```')
      }
      lines.push('')
    })
  }

  lines.push('## Instructions')
  lines.push('1. Locate each element in the source code using the tag, classes and selector hints above (search the repo for the class names).')
  lines.push('2. Apply the expected fix for every numbered issue, preferring the project\'s existing design tokens / utility classes over hard-coded values.')
  lines.push('3. Keep changes minimal and scoped: do not refactor unrelated code or alter behaviour.')
  lines.push('4. Match the design to the pixel — exact spacing, font size / weight / line-height, colours (HEX above) and border radius.')
  lines.push('5. When finished, list what you changed per issue number (#1, #2, …) so the result can be re-audited.')

  return lines.join('\n')
}
