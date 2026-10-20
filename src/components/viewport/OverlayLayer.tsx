import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AuditIssue, DesignScale, Point, Rect, RulerMeasurement, ViewState } from '../../types/audit'
import { formatNumber, stageToScreen } from '../../utils/geometry'

interface OverlayLayerProps {
  view: ViewState
  paneWidth: number
  paneHeight: number
  issues: AuditIssue[]
  selectedId: string | null
  onSelectIssue: (id: string) => void
  /** Rectangle currently being drawn (stage px). */
  draft: Rect | null
  ruler: RulerMeasurement | null
  designScale: DesignScale
  /** Hovered pixel (stage px). */
  hover: Point | null
  /** Draws the full-pane laser crosshair. */
  laser: boolean
  /** Split mode: divider geometry. */
  split: { px: number; onPointerDown: (e: ReactPointerEvent) => void } | null
  /** Small caption in the pane's top-left corner. */
  label?: string
}

const RED = '#ff4d5e'
const NEON = '#ff4fe0'

export function OverlayLayer({
  view,
  paneWidth,
  paneHeight,
  issues,
  selectedId,
  onSelectIssue,
  draft,
  ruler,
  designScale,
  hover,
  laser,
  split,
  label,
}: OverlayLayerProps) {
  const screenRect = (rect: Rect) => {
    const p = stageToScreen(rect, view)
    return { x: p.x, y: p.y, w: rect.width * view.zoom, h: rect.height * view.zoom }
  }

  const cell = hover ? { ...stageToScreen(hover, view), size: view.zoom } : null
  const showCell = cell !== null && view.zoom >= 4

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg width={paneWidth} height={paneHeight} className="absolute inset-0 overflow-visible">
        {/* Mirrored laser crosshair */}
        {laser && cell && (
          <g shapeRendering="crispEdges">
            <line x1={0} x2={paneWidth} y1={cell.y + cell.size / 2} y2={cell.y + cell.size / 2} stroke={NEON} strokeOpacity={0.55} strokeWidth={1} />
            <line y1={0} y2={paneHeight} x1={cell.x + cell.size / 2} x2={cell.x + cell.size / 2} stroke={NEON} strokeOpacity={0.55} strokeWidth={1} />
          </g>
        )}

        {/* Hovered pixel cell (visible once individual pixels are large) */}
        {showCell && cell && (
          <rect x={cell.x} y={cell.y} width={cell.size} height={cell.size} fill="none" stroke="#ffffff" strokeWidth={1} shapeRendering="crispEdges" />
        )}

        {/* Annotation boxes */}
        {issues.map((issue) => {
          const r = screenRect(issue.rect)
          const selected = issue.id === selectedId
          return (
            <g key={issue.id}>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={selected ? 'rgba(255,79,224,0.16)' : 'rgba(255,77,94,0.08)'}
                stroke={selected ? NEON : RED}
                strokeWidth={selected ? 2.5 : 2}
              />
              {selected && (
                <rect x={r.x - 3} y={r.y - 3} width={r.w + 6} height={r.h + 6} fill="none" stroke={NEON} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 3" />
              )}
            </g>
          )
        })}

        {/* Draft box while drawing */}
        {draft && (() => {
          const r = screenRect(draft)
          return (
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(255,77,94,0.12)" stroke={RED} strokeWidth={2} strokeDasharray="6 4" />
          )
        })()}

        {/* Ruler */}
        {ruler && (() => {
          const a = stageToScreen(ruler.a, view)
          const b = stageToScreen(ruler.b, view)
          return (
            <g>
              <path d={`M ${a.x} ${a.y} L ${b.x} ${a.y} L ${b.x} ${b.y}`} fill="none" stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fbbf24" strokeWidth={1.75} />
              <circle cx={a.x} cy={a.y} r={4} fill="#fbbf24" stroke="#0a0b11" strokeWidth={1.5} />
              <circle cx={b.x} cy={b.y} r={4} fill="#fbbf24" stroke="#0a0b11" strokeWidth={1.5} />
            </g>
          )
        })()}
      </svg>

      {/* Issue number badges (clickable) */}
      {issues.map((issue, index) => {
        const r = screenRect(issue.rect)
        const selected = issue.id === selectedId
        return (
          <button
            key={issue.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelectIssue(issue.id)}
            className="pointer-events-auto absolute flex h-[18px] min-w-[18px] -translate-y-full items-center justify-center rounded-t-[4px] px-1 font-mono text-[10.5px] font-bold text-white shadow-lg transition-transform hover:scale-110"
            style={{ left: r.x - 1, top: r.y - 1, background: selected ? NEON : RED }}
          >
            {index + 1}
          </button>
        )
      })}

      {/* Ruler read-out */}
      {ruler && <RulerLabel ruler={ruler} view={view} designScale={designScale} />}

      {/* Split curtain handle */}
      {split && (
        <div
          className="pointer-events-auto absolute top-0 bottom-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize"
          style={{ left: view.panX + split.px * view.zoom }}
          onPointerDown={split.onPointerDown}
        >
          <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5),0_0_16px_rgb(255_43_214/0.8)]" />
          <div className="absolute top-1/2 left-1/2 flex h-9 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-ink-900/90 shadow-lg backdrop-blur">
            <div className="flex gap-[3px]">
              <span className="h-3 w-px bg-white/70" />
              <span className="h-3 w-px bg-white/70" />
            </div>
          </div>
          <span className="absolute top-3 right-full mr-2 rounded bg-black/70 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-ink-100">
            DESIGN
          </span>
          <span className="absolute top-3 left-full ml-2 rounded bg-black/70 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-neon-300">
            IMPL
          </span>
        </div>
      )}

      {label && (
        <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-ink-100 backdrop-blur">
          {label}
        </span>
      )}
    </div>
  )
}

function RulerLabel({
  ruler,
  view,
  designScale,
}: {
  ruler: RulerMeasurement
  view: ViewState
  designScale: DesignScale
}) {
  const dx = ruler.b.x - ruler.a.x
  const dy = ruler.b.y - ruler.a.y
  const dist = Math.hypot(dx, dy)
  const mid = stageToScreen({ x: (ruler.a.x + ruler.b.x) / 2, y: (ruler.a.y + ruler.b.y) / 2 }, view)
  const css = (n: number) => formatNumber(n / designScale)
  return (
    <div
      className="absolute z-10 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-ink-950/90 px-2.5 py-1.5 font-mono text-[10.5px] leading-tight text-amber-300 shadow-xl backdrop-blur"
      style={{ left: mid.x, top: mid.y + 12 }}
    >
      <div className="flex gap-3 whitespace-nowrap">
        <span>ΔX {formatNumber(Math.abs(dx))}px</span>
        <span>ΔY {formatNumber(Math.abs(dy))}px</span>
        <span className="font-semibold text-white">{formatNumber(dist, 2)}px</span>
      </div>
      {designScale !== 1 && (
        <div className="mt-0.5 whitespace-nowrap text-[9.5px] text-ink-300">
          CSS: {css(Math.abs(dx))} × {css(Math.abs(dy))} · {css(dist)}px
        </div>
      )}
    </div>
  )
}
