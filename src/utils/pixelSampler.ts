/**
 * Exact per-pixel reads from the raw image data (never from the scaled DOM).
 * Coordinates are LOCAL to the image, i.e. already offset-corrected.
 */
export class PixelSampler {
  readonly width: number
  readonly height: number
  private readonly ctx: CanvasRenderingContext2D

  constructor(image: HTMLImageElement) {
    this.width = image.naturalWidth
    this.height = image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas is not available')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
    this.ctx = ctx
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  rgbaAt(x: number, y: number): [number, number, number, number] | null {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (!this.contains(px, py)) return null
    const d = this.ctx.getImageData(px, py, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  }

  /** "#RRGGBB" (or "#RRGGBBAA" when translucent); null when outside / fully transparent. */
  hexAt(x: number, y: number): string | null {
    const rgba = this.rgbaAt(x, y)
    if (!rgba || rgba[3] === 0) return null
    return rgbaToHex(rgba)
  }

  /** (2r+1) x (2r+1) block centred on (cx, cy); outside pixels are transparent. */
  region(cx: number, cy: number, radius: number): ImageData {
    const size = radius * 2 + 1
    return this.ctx.getImageData(Math.floor(cx) - radius, Math.floor(cy) - radius, size, size)
  }
}

export function rgbaToHex([r, g, b, a]: [number, number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  const base = `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
  return a === 255 ? base : `${base}${h(a)}`.toUpperCase()
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/** Euclidean RGB distance between two HEX colours (0 - 441.67). */
export function colorDistance(hexA: string | null, hexB: string | null): number | null {
  if (!hexA || !hexB) return null
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return null
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}
