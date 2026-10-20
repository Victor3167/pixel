import type { CaptureSettings, DesignScale, LoadedImage } from '../types/audit'

export interface ResolvedViewport {
  width: number
  height: number
  deviceScaleFactor: number
}

/**
 * Playwright viewport that reproduces the Design's pixel grid:
 *   1x   -> naturalWidth  x naturalHeight  @1x
 *   2x   -> naturalWidth/2 x naturalHeight/2 @2x  (Figma Retina export)
 *   0.5x -> naturalWidth*2 x naturalHeight*2 @0.5x
 * Falls back to 1280x800 @1x when manual fields are missing or invalid.
 */
export function resolveCaptureViewport(
  settings: Partial<CaptureSettings> | null | undefined,
  design: LoadedImage | null,
  designScale: DesignScale = 1,
): ResolvedViewport {
  const manualW = Number(settings?.manualWidth)
  const manualH = Number(settings?.manualHeight)
  const manualDsf = Number(settings?.manualDeviceScaleFactor)

  const fallbackWidth = Number.isInteger(manualW) && manualW >= 1 && manualW <= 8192 ? manualW : 1280
  const fallbackHeight = Number.isInteger(manualH) && manualH >= 1 && manualH <= 8192 ? manualH : 800
  const fallbackDsf = Number.isFinite(manualDsf) && manualDsf >= 0.25 && manualDsf <= 4 ? manualDsf : 1

  if (settings?.autoSync && design && Number.isFinite(design.width) && design.width > 0) {
    const scale = Number.isFinite(designScale) && designScale > 0 ? designScale : 1
    const computedW = Math.round(design.width / scale)
    const computedH = Math.round(design.height / scale)
    return {
      width: Math.max(1, Math.min(8192, Number.isInteger(computedW) && computedW >= 1 ? computedW : fallbackWidth)),
      height: Math.max(1, Math.min(8192, Number.isInteger(computedH) && computedH >= 1 ? computedH : fallbackHeight)),
      deviceScaleFactor: scale,
    }
  }

  return {
    width: fallbackWidth,
    height: fallbackHeight,
    deviceScaleFactor: fallbackDsf,
  }
}
