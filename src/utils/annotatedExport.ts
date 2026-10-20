import type { AuditIssue, ComparisonLayout, LoadedImage } from '../types/audit'

const MAX_SIDE = 16000
const MAX_AREA = 120_000_000

interface ExportOptions {
  design: LoadedImage | null
  impl: LoadedImage | null
  layout: ComparisonLayout
  issues: AuditIssue[]
}

/**
 * Renders "DESIGN | IMPLEMENTATION" side by side at 1:1 pixels (scaled down only
 * when the browser canvas limits would be exceeded) with red numbered boxes
 * drawn on both panels, and returns it as a PNG blob.
 */
export async function renderAnnotatedComparison({ design, impl, layout, issues }: ExportOptions): Promise<Blob> {
  const W = layout.width
  const H = layout.height
  const pad = 24
  const gap = 24
  const header = 44

  const rawWidth = pad * 2 + W * 2 + gap
  const rawHeight = pad * 2 + header + H
  const scale = Math.min(1, MAX_SIDE / rawWidth, MAX_SIDE / rawHeight, Math.sqrt(MAX_AREA / (rawWidth * rawHeight)))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rawWidth * scale))
  canvas.height = Math.max(1, Math.round(rawHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not available')

  // Annotation unit grows with image size so boxes stay legible after downscaling.
  const unit = Math.min(4, Math.max(1, Math.round(Math.sqrt(W * H) * scale / 700)))

  ctx.scale(scale, scale)
  ctx.fillStyle = '#0b0c12'
  ctx.fillRect(0, 0, rawWidth, rawHeight)

  const panels = [
    { label: 'DESIGN', image: design, x: pad, offsetX: 0, offsetY: 0 },
    { label: 'IMPLEMENTATION', image: impl, x: pad + W + gap, offsetX: layout.offsetX, offsetY: layout.offsetY },
  ]
  const top = pad + header

  for (const panel of panels) {
    ctx.fillStyle = '#e8eaf6'
    ctx.font = `600 ${Math.min(26, Math.round(14 / scale))}px Inter, system-ui, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(panel.label, panel.x, pad + header / 2)

    ctx.fillStyle = '#14151f'
    ctx.fillRect(panel.x, top, W, H)

    ctx.save()
    ctx.beginPath()
    ctx.rect(panel.x, top, W, H)
    ctx.clip()
    ctx.imageSmoothingEnabled = scale < 1
    if (panel.image) ctx.drawImage(panel.image.element, panel.x + panel.offsetX, top + panel.offsetY)
    ctx.restore()

    drawIssueBoxes(ctx, issues, panel.x, top, unit / scale)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png')
  })
}

function drawIssueBoxes(
  ctx: CanvasRenderingContext2D,
  issues: AuditIssue[],
  originX: number,
  originY: number,
  unit: number,
): void {
  const stroke = Math.max(2, 2 * unit)
  const fontSize = Math.max(12, 11 * unit)
  ctx.lineJoin = 'miter'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  issues.forEach((issue, index) => {
    const { x, y, width, height } = issue.rect
    const bx = originX + x
    const by = originY + y

    ctx.strokeStyle = '#ff2d2d'
    ctx.lineWidth = stroke
    ctx.strokeRect(bx - stroke / 2, by - stroke / 2, width + stroke, height + stroke)

    const label = String(index + 1)
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`
    const badgeW = Math.max(fontSize * 1.5, ctx.measureText(label).width + fontSize * 0.8)
    const badgeH = fontSize * 1.5
    const badgeY = by - stroke - badgeH >= originY - 4 * unit ? by - stroke - badgeH : by + stroke
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(bx - stroke, badgeY, badgeW, badgeH)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, bx - stroke + badgeW / 2, badgeY + badgeH / 2 + unit * 0.3)
  })
  ctx.textAlign = 'start'
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(text: string, filename: string, mime = 'text/markdown'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}
