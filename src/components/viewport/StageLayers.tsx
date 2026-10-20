import type { CSSProperties } from 'react'
import type { ComparisonLayout, DiffBase, DiffResult, InspectionMode, LoadedImage } from '../../types/audit'
import { CanvasMirror } from './CanvasMirror'

export type PaneKind = 'composite' | 'design' | 'impl'

interface StageLayersProps {
  kind: PaneKind
  mode: InspectionMode
  design: LoadedImage | null
  impl: LoadedImage | null
  layout: ComparisonLayout
  diff: DiffResult | null
  diffBase: DiffBase
  onionOpacity: number
  blendDifference: boolean
  /** Blink mode: true while Space is held (shows the Design). */
  blinkShowsDesign: boolean
  /** Split mode: divider position in stage pixels. */
  splitPx: number
}

function imageStyle(image: LoadedImage, left: number, top: number, extra?: CSSProperties): CSSProperties {
  return {
    position: 'absolute',
    left,
    top,
    width: image.width,
    height: image.height,
    maxWidth: 'none',
    maxHeight: 'none',
    userSelect: 'none',
    pointerEvents: 'none',
    ...extra,
  }
}

function Img({ image, left, top, style }: { image: LoadedImage; left: number; top: number; style?: CSSProperties }) {
  return <img src={image.url} alt="" draggable={false} style={imageStyle(image, left, top, style)} />
}

/**
 * Pixel layers inside the scaled stage. Every layer is rendered at its exact
 * natural size (design at 0,0 - implementation at the calibration offset).
 */
export function StageLayers({
  kind,
  mode,
  design,
  impl,
  layout,
  diff,
  diffBase,
  onionOpacity,
  blendDifference,
  blinkShowsDesign,
  splitPx,
}: StageLayersProps) {
  const { offsetX, offsetY } = layout

  if (kind === 'design') return design ? <Img image={design} left={0} top={0} /> : null
  if (kind === 'impl') return impl ? <Img image={impl} left={offsetX} top={offsetY} /> : null

  // Composite panes need both layers for the comparison modes.
  if (!design || !impl) {
    return (
      <>
        {design && <Img image={design} left={0} top={0} />}
        {impl && <Img image={impl} left={offsetX} top={offsetY} />}
      </>
    )
  }

  switch (mode) {
    case 'diff': {
      const base = diffBase === 'impl' ? impl : diffBase === 'design' ? design : null
      return (
        <>
          {base && (
            <Img
              image={base}
              left={base === impl ? offsetX : 0}
              top={base === impl ? offsetY : 0}
              style={{ opacity: 0.3, filter: 'grayscale(1)' }}
            />
          )}
          {diff && <CanvasMirror source={diff.maskCanvas} />}
        </>
      )
    }

    case 'onion':
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            isolation: 'isolate',
            background: blendDifference ? '#000' : undefined,
          }}
        >
          <Img image={impl} left={offsetX} top={offsetY} />
          <Img
            image={design}
            left={0}
            top={0}
            style={{ opacity: onionOpacity, mixBlendMode: blendDifference ? 'difference' : 'normal' }}
          />
        </div>
      )

    case 'blink':
      // `visibility` flips with zero transition: both bitmaps stay decoded.
      return (
        <>
          <Img image={impl} left={offsetX} top={offsetY} style={{ visibility: blinkShowsDesign ? 'hidden' : 'visible' }} />
          <Img image={design} left={0} top={0} style={{ visibility: blinkShowsDesign ? 'visible' : 'hidden' }} />
        </>
      )

    case 'split':
      return (
        <>
          <Img image={design} left={0} top={0} />
          <Img
            image={impl}
            left={offsetX}
            top={offsetY}
            style={{ clipPath: `inset(0 0 0 ${splitPx - offsetX}px)` }}
          />
        </>
      )

    case 'side':
      return (
        <>
          <Img image={design} left={0} top={0} />
        </>
      )
  }
}
