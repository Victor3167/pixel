import type { Point, Rect, ViewState } from '../types/audit'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8
/** At or above this zoom, images are rendered with `image-rendering: pixelated`. */
export const PIXELATED_ZOOM = 2

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM)
}

/** Builds an axis-aligned rect from two arbitrary corner points. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  )
}

/** Clips a rect to [0,width]x[0,height]; returns null when nothing remains. */
export function clipRect(rect: Rect, width: number, height: number): Rect | null {
  const x1 = clamp(rect.x, 0, width)
  const y1 = clamp(rect.y, 0, height)
  const x2 = clamp(rect.x + rect.width, 0, width)
  const y2 = clamp(rect.y + rect.height, 0, height)
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return null
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

/** Stage (image pixel) coordinate -> screen coordinate inside a pane. */
export function stageToScreen(point: Point, view: ViewState): Point {
  return { x: view.panX + point.x * view.zoom, y: view.panY + point.y * view.zoom }
}

/** Screen coordinate inside a pane -> stage (image pixel) coordinate. */
export function screenToStage(point: Point, view: ViewState): Point {
  return { x: (point.x - view.panX) / view.zoom, y: (point.y - view.panY) / view.zoom }
}

/** Zoom while keeping the stage point under `anchor` (pane coords) fixed. */
export function zoomAround(view: ViewState, nextZoom: number, anchor: Point): ViewState {
  const zoom = clampZoom(nextZoom)
  const ratio = zoom / view.zoom
  return {
    zoom,
    panX: anchor.x - (anchor.x - view.panX) * ratio,
    panY: anchor.y - (anchor.y - view.panY) * ratio,
  }
}

/** View that centres a `contentW x contentH` stage inside a pane. */
export function fitView(
  contentW: number,
  contentH: number,
  paneW: number,
  paneH: number,
  padding = 32,
): ViewState {
  const availW = Math.max(1, paneW - padding * 2)
  const availH = Math.max(1, paneH - padding * 2)
  const zoom = clampZoom(Math.min(availW / contentW, availH / contentH, 1))
  return {
    zoom,
    panX: (paneW - contentW * zoom) / 2,
    panY: (paneH - contentH * zoom) / 2,
  }
}

/** View that centres a rect inside a pane, keeping the current zoom. */
export function centerOnRect(view: ViewState, rect: Rect, paneW: number, paneH: number): ViewState {
  const c = rectCenter(rect)
  return {
    zoom: view.zoom,
    panX: paneW / 2 - c.x * view.zoom,
    panY: paneH / 2 - c.y * view.zoom,
  }
}

export function formatNumber(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.?0+$/, '')
}
