import pixelmatch from 'pixelmatch'
import type { ComparisonLayout, DiffResult, LoadedImage, Point } from '../types/audit'

export interface Size {
  width: number
  height: number
}

export const DIFF_COLOR: [number, number, number] = [255, 0, 255]

/**
 * Computes the shared comparison space. The Design is anchored at (0,0); the
 * Implementation sits at (offsetX, offsetY). Nothing is ever scaled.
 */
export function computeLayout(
  design: Size | null,
  impl: Size | null,
  offset: Point,
): ComparisonLayout {
  const dw = design?.width ?? 0
  const dh = design?.height ?? 0
  const iw = impl ? offset.x + impl.width : 0
  const ih = impl ? offset.y + impl.height : 0
  return {
    width: Math.max(1, dw, iw),
    height: Math.max(1, dh, ih),
    offsetX: offset.x,
    offsetY: offset.y,
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * Draws `img` 1:1 (no scaling, no smoothing) at integer (dx, dy) inside a
 * fresh canvas of the comparison size. Pixels outside the image stay transparent.
 */
export function rasterizeLayer(
  img: HTMLImageElement,
  width: number,
  height: number,
  dx: number,
  dy: number,
): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas is not available')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, dx, dy)
  return canvas
}

export interface DiffOptions {
  design: LoadedImage
  impl: LoadedImage
  layout: ComparisonLayout
  /** pixelmatch matching threshold, 0 - 1 (smaller = stricter). */
  threshold: number
  includeAA: boolean
}

/**
 * Runs pixelmatch on the two rasterised layers and returns a transparent
 * neon-magenta mask plus statistics.
 */
export function computeDiff(options: DiffOptions): DiffResult {
  const { design, impl, layout, threshold, includeAA } = options
  const { width, height } = layout

  const designCanvas = rasterizeLayer(design.element, width, height, 0, 0)
  const implCanvas = rasterizeLayer(impl.element, width, height, layout.offsetX, layout.offsetY)
  const designData = designCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height)
  const implData = implCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height)

  const output = new ImageData(width, height)
  const mismatched = pixelmatch(designData.data, implData.data, output.data, width, height, {
    threshold,
    includeAA,
    diffColor: DIFF_COLOR,
    diffColorAlt: DIFF_COLOR,
    diffMask: true,
  })

  const maskCanvas = createCanvas(width, height)
  maskCanvas.getContext('2d')!.putImageData(output, 0, 0)

  const total = width * height
  return {
    width,
    height,
    mismatched,
    total,
    matchScore: ((total - mismatched) / total) * 100,
    maskCanvas,
  }
}

/** "99.87" - never rounds up to "100.00" while at least one pixel differs. */
export function formatMatchScore(diff: DiffResult | null): string {
  if (!diff) return '--'
  if (diff.mismatched === 0) return '100.00'
  const floored = Math.floor(diff.matchScore * 100) / 100
  return Math.min(99.99, floored).toFixed(2)
}

/** Dimmed Design + magenta diff mask: the third image sent to Gemini. */
export function buildDiffComposite(
  design: LoadedImage,
  diff: DiffResult,
  layout: ComparisonLayout,
): HTMLCanvasElement {
  const canvas = createCanvas(layout.width, layout.height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.globalAlpha = 0.35
  ctx.drawImage(design.element, 0, 0)
  ctx.globalAlpha = 1
  ctx.drawImage(diff.maskCanvas, 0, 0)
  return canvas
}

/** Scales a canvas down (never up) so its longest side is <= maxSide. */
export function downscaleCanvas(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const longest = Math.max(source.width, source.height)
  if (longest <= maxSide) return source
  const ratio = maxSide / longest
  const target = createCanvas(Math.max(1, Math.round(source.width * ratio)), Math.max(1, Math.round(source.height * ratio)))
  const ctx = target.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, target.width, target.height)
  return target
}

/** Raw base64 (no data: prefix) of a canvas encoded as PNG. */
export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1] ?? ''
}
