import type { CaptureMeta, ComparisonLayout, DesignScale, Point } from '../../types/audit'
import { describeDomNode, domNodeAtComparisonPoint } from '../../utils/domMatch'
import { formatNumber } from '../../utils/geometry'
import { colorDistance, type PixelSampler } from '../../utils/pixelSampler'
import { ColorSwatch } from '../ui'

interface HudBarProps {
  hover: Point | null
  designSampler: PixelSampler | null
  implSampler: PixelSampler | null
  layout: ComparisonLayout
  meta: CaptureMeta | null
  designScale: DesignScale
  zoom: number
}

/** Bottom HUD: exact coordinate, Design vs Implementation HEX, hovered DOM element. */
export function HudBar({ hover, designSampler, implSampler, layout, meta, designScale, zoom }: HudBarProps) {
  const designHex = hover ? (designSampler?.hexAt(hover.x, hover.y) ?? null) : null
  const implHex = hover ? (implSampler?.hexAt(hover.x - layout.offsetX, hover.y - layout.offsetY) ?? null) : null
  const dom = hover ? domNodeAtComparisonPoint(meta, hover, layout.offsetX, layout.offsetY) : null
  const delta = colorDistance(designHex, implHex)

  return (
    <footer
      id="hud-bar"
      className="flex h-10 shrink-0 items-center gap-4 overflow-hidden border-t border-white/[0.06] bg-ink-900/95 px-4 font-mono text-[11px]"
    >
      <div className="flex w-[150px] shrink-0 items-center gap-2 text-ink-100">
        <span className="text-ink-400">XY</span>
        {hover ? (
          <span className="tabular-nums">
            {hover.x}, {hover.y}
            {designScale !== 1 && (
              <span className="ml-1.5 text-[10px] text-ink-400">
                ({formatNumber(hover.x / designScale, 1)}, {formatNumber(hover.y / designScale, 1)})
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ColorSwatch hex={designHex} label="design" />
        <ColorSwatch hex={implHex} label="impl" />
        {delta !== null && (
          <span
            className={
              delta === 0
                ? 'rounded bg-mint-400/15 px-1.5 py-0.5 text-[10px] text-mint-400'
                : 'rounded bg-neon-500/15 px-1.5 py-0.5 text-[10px] text-neon-300'
            }
          >
            {delta === 0 ? 'identical' : `ΔRGB ${delta.toFixed(1)}`}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {dom ? (
          <>
            <span className="truncate rounded-md border border-iris-500/30 bg-iris-500/10 px-2 py-0.5 text-iris-300" title={describeDomNode(dom)}>
              {describeDomNode(dom)}
            </span>
            <span className="shrink-0 text-ink-400">
              {formatNumber(dom.rect.width, 1)}×{formatNumber(dom.rect.height, 1)} css
            </span>
          </>
        ) : (
          <span className="text-ink-400">{meta ? 'no DOM element here' : 'DOM mapping needs a Playwright capture'}</span>
        )}
      </div>

      <div className="shrink-0 text-ink-400">
        {layout.width}×{layout.height}px · {Math.round(zoom * 100)}%
      </div>
    </footer>
  )
}
