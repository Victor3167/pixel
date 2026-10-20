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
 * Falls back to the manual fields when auto-sync is off or no design is loaded.
 */
export function resolveCaptureViewport(
  settings: CaptureSettings,
  design: LoadedImage | null,
  designScale: DesignScale,
): ResolvedViewport {
  if (settings.autoSync && design) {
    return {
      width: Math.max(1, Math.round(design.width / designScale)),
      height: Math.max(1, Math.round(design.height / designScale)),
      deviceScaleFactor: designScale,
    }
  }
  return {
    width: Math.max(1, Math.round(settings.manualWidth)),
    height: Math.max(1, Math.round(settings.manualHeight)),
    deviceScaleFactor: settings.manualDeviceScaleFactor,
  }
}
