import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  AuditIssue,
  ComparisonLayout,
  DesignScale,
  DiffBase,
  DiffResult,
  InspectionMode,
  LoadedImage,
  Point,
  Rect,
  RulerMeasurement,
  ToolMode,
  ViewState,
} from '../../types/audit'
import { cn } from '../../utils/cn'
import { PIXELATED_ZOOM, clamp, rectFromPoints, screenToStage, zoomAround } from '../../utils/geometry'
import { OverlayLayer } from './OverlayLayer'
import { StageLayers, type PaneKind } from './StageLayers'

interface ViewPaneProps {
  kind: PaneKind
  label?: string
  mode: InspectionMode
  tool: ToolMode
  design: LoadedImage | null
  impl: LoadedImage | null
  layout: ComparisonLayout
  diff: DiffResult | null
  diffBase: DiffBase
  onionOpacity: number
  blendDifference: boolean
  blinkShowsDesign: boolean
  splitPos: number
  onSplitChange: (fraction: number) => void
  view: ViewState
  onViewChange: (view: ViewState) => void
  onPaneSize: (size: { width: number; height: number }) => void
  hover: Point | null
  onHover: (point: Point) => void
  onLeave: () => void
  laser: boolean
  issues: AuditIssue[]
  selectedId: string | null
  onSelectIssue: (id: string) => void
  onCreateBox: (rect: Rect) => void
  ruler: RulerMeasurement | null
  onRulerChange: (ruler: RulerMeasurement | null) => void
  designScale: DesignScale
}

type DragState =
  | { type: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { type: 'ruler'; origin: Point }
  | { type: 'box'; origin: Point }

/**
 * One interactive pane: owns the stage transform, pointer maths (pan, zoom,
 * ruler, box drawing) and the screen-space overlay. All coordinate conversions
 * go through `screenToStage` so they are exact at every zoom level.
 */
export function ViewPane(props: ViewPaneProps) {
  const {
    kind, label, mode, tool, design, impl, layout, diff, diffBase, onionOpacity, blendDifference,
    blinkShowsDesign, splitPos, onSplitChange, view, onViewChange, onPaneSize, hover, onHover, onLeave,
    laser, issues, selectedId, onSelectIssue, onCreateBox, ruler, onRulerChange, designScale,
  } = props

  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [draft, setDraft] = useState<Rect | null>(null)
  const [panning, setPanning] = useState(false)

  /* ---- size tracking ---------------------------------------------------- */
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      setSize(next)
      onPaneSize(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onPaneSize])

  /* ---- coordinate helpers ------------------------------------------------ */
  const paneToStage = useCallback((clientX: number, clientY: number): Point => {
    const rect = rootRef.current!.getBoundingClientRect()
    return screenToStage({ x: clientX - rect.left, y: clientY - rect.top }, viewRef.current)
  }, [])

  const snap = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) })

  /* ---- wheel zoom (needs a non-passive listener) -------------------------- */
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      const factor = Math.exp(-event.deltaY * unit * 0.0016)
      const current = viewRef.current
      onViewChange(zoomAround(current, current.zoom * factor, anchor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onViewChange])

  /* ---- pointer interaction ----------------------------------------------- */
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wantsPan = event.button === 1 || (event.button === 0 && (event.altKey || tool === 'inspect'))
    if (wantsPan) {
      event.preventDefault()
      dragRef.current = { type: 'pan', startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY }
      setPanning(true)
    } else if (event.button === 0 && tool === 'measure') {
      const origin = snap(paneToStage(event.clientX, event.clientY))
      dragRef.current = { type: 'ruler', origin }
      onRulerChange({ a: origin, b: origin })
    } else if (event.button === 0 && tool === 'annotate') {
      const origin = snap(paneToStage(event.clientX, event.clientY))
      dragRef.current = { type: 'box', origin }
      setDraft({ ...origin, width: 0, height: 0 })
    } else {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = paneToStage(event.clientX, event.clientY)
    onHover({ x: Math.floor(stage.x), y: Math.floor(stage.y) })

    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'pan') {
      onViewChange({
        zoom: view.zoom,
        panX: drag.panX + (event.clientX - drag.startX),
        panY: drag.panY + (event.clientY - drag.startY),
      })
    } else if (drag.type === 'ruler') {
      onRulerChange({ a: drag.origin, b: snap(stage) })
    } else {
      setDraft(rectFromPoints(drag.origin, snap(stage)))
    }
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag?.type === 'box') {
      const rect = rectFromPoints(drag.origin, snap(paneToStage(event.clientX, event.clientY)))
      setDraft(null)
      if (rect.width >= 2 && rect.height >= 2) onCreateBox(rect)
    } else if (drag?.type === 'ruler') {
      const end = snap(paneToStage(event.clientX, event.clientY))
      if (end.x === drag.origin.x && end.y === drag.origin.y) onRulerChange(null)
    }
  }

  /* ---- split curtain ------------------------------------------------------ */
  const handleSplitDown = (event: ReactPointerEvent) => {
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent) => {
      const stage = paneToStage(e.clientX, e.clientY)
      onSplitChange(clamp(stage.x / layout.width, 0, 1))
    }
    const up = (e: PointerEvent) => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const splitPx = Math.round(splitPos * layout.width)
  const pixelated = view.zoom >= PIXELATED_ZOOM

  return (
    <div
      ref={rootRef}
      className={cn(
        'workspace-bg relative h-full min-w-0 flex-1 touch-none overflow-hidden',
        panning ? 'cursor-grabbing' : tool === 'inspect' ? 'cursor-grab' : 'cursor-crosshair',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onLeave}
      onAuxClick={(e) => e.preventDefault()}
    >
      {/* Stage: exact pixel geometry, transformed from the (0,0) origin only. */}
      <div
        className="absolute top-0 left-0 will-change-transform"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          transformOrigin: '0 0',
          imageRendering: pixelated ? 'pixelated' : 'auto',
          background: '#0b0c12',
          boxShadow: `0 0 0 ${1 / view.zoom}px rgb(255 255 255 / 0.18), 0 24px 80px rgb(0 0 0 / 0.5)`,
        }}
      >
        <StageLayers
          kind={kind}
          mode={mode}
          design={design}
          impl={impl}
          layout={layout}
          diff={diff}
          diffBase={diffBase}
          onionOpacity={onionOpacity}
          blendDifference={blendDifference}
          blinkShowsDesign={blinkShowsDesign}
          splitPx={splitPx}
        />
      </div>

      <OverlayLayer
        view={view}
        paneWidth={size.width}
        paneHeight={size.height}
        issues={issues}
        selectedId={selectedId}
        onSelectIssue={onSelectIssue}
        draft={draft}
        ruler={ruler}
        designScale={designScale}
        hover={hover}
        laser={laser}
        split={mode === 'split' && kind === 'composite' ? { px: splitPx, onPointerDown: handleSplitDown } : null}
        label={label}
      />
    </div>
  )
}
