import { useCallback, useEffect, useRef, useState } from 'react'
import { FlaskConical, ImagePlus, Maximize, Minus, Plus } from 'lucide-react'
import type {
  AuditIssue,
  CaptureMeta,
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
import { centerOnRect, fitView, zoomAround } from '../../utils/geometry'
import type { PixelSampler } from '../../utils/pixelSampler'
import { Button, IconButton, Kbd } from '../ui'
import { LiveBrowserView } from './LiveBrowserView'
import type { CaptureSettings } from '../../types/audit'
import { HudBar } from './HudBar'
import { PixelLoupe } from './PixelLoupe'
import { ViewPane } from './ViewPane'

export interface FocusRequest {
  rect: Rect
  nonce: number
}

interface ViewportProps {
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
  /** Increment to re-fit the content inside the viewport. */
  fitSignal: number
  focusRequest: FocusRequest | null
  designSampler: PixelSampler | null
  implSampler: PixelSampler | null
  meta: CaptureMeta | null
  designScale: DesignScale
  issues: AuditIssue[]
  selectedId: string | null
  onSelectIssue: (id: string) => void
  onCreateBox: (rect: Rect) => void
  ruler: RulerMeasurement | null
  onRulerChange: (ruler: RulerMeasurement | null) => void
  onLoadDemo: () => void
  designSettings?: CaptureSettings
  implSettings?: CaptureSettings
  onUpdateDesignSettings?: (patch: Partial<CaptureSettings>) => void
  onUpdateImplSettings?: (patch: Partial<CaptureSettings>) => void
  onCaptureBoth?: () => void
  capturingBoth?: boolean
  onAddToast?: (kind: 'info' | 'success' | 'error', message: string) => void
}

export function Viewport(props: ViewportProps) {
  const {
    mode, design, impl, layout, view, onViewChange, fitSignal, focusRequest, designSampler, implSampler,
    meta, designScale, onLoadDemo,
  } = props

  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<Point | null>(null)
  const [pointerInside, setPointerInside] = useState(false)

  const side = mode === 'side' && design !== null && impl !== null
  const hasContent = design !== null || impl !== null

  const handlePaneSize = useCallback((size: { width: number; height: number }) => {
    setPaneSize((prev) => (prev.width === size.width && prev.height === size.height ? prev : size))
  }, [])

  const handleHover = useCallback((point: Point) => {
    setHover((prev) => (prev && prev.x === point.x && prev.y === point.y ? prev : point))
    setPointerInside(true)
  }, [])

  const handleLeave = useCallback(() => setPointerInside(false), [])

  /* ---- fit-to-view ------------------------------------------------------- */
  const fit = useCallback(() => {
    if (paneSize.width === 0 || paneSize.height === 0) return
    onViewChange(fitView(layout.width, layout.height, paneSize.width, paneSize.height))
  }, [layout.width, layout.height, paneSize.width, paneSize.height, onViewChange])
  const fitRef = useRef(fit)
  useEffect(() => {
    fitRef.current = fit
  }, [fit])

  // Auto-fit when the reference changes, or when switching to/from side-by-side.
  const fitKey = `${design?.url ?? ''}|${design ? '' : (impl?.url ?? '')}|${side}`
  const pendingFit = useRef(false)
  useEffect(() => {
    if (!hasContent) return
    pendingFit.current = true
    fitRef.current()
    const timer = window.setTimeout(() => (pendingFit.current = false), 400)
    return () => window.clearTimeout(timer)
  }, [fitKey, hasContent])
  useEffect(() => {
    if (pendingFit.current && paneSize.width > 0) fitRef.current()
  }, [paneSize.width, paneSize.height])

  // Explicit "fit" requests (F key / button).
  const lastSignal = useRef(fitSignal)
  useEffect(() => {
    if (lastSignal.current === fitSignal) return
    lastSignal.current = fitSignal
    fitRef.current()
  }, [fitSignal])

  // Centre on an issue when it is selected from the list.
  const lastFocus = useRef<number | null>(null)
  useEffect(() => {
    if (!focusRequest || lastFocus.current === focusRequest.nonce) return
    lastFocus.current = focusRequest.nonce
    onViewChange(centerOnRect(view, focusRequest.rect, paneSize.width, paneSize.height))
  }, [focusRequest, view, paneSize.width, paneSize.height, onViewChange])

  const zoomBy = (factor: number) => {
    onViewChange(zoomAround(view, view.zoom * factor, { x: paneSize.width / 2, y: paneSize.height / 2 }))
  }
  const zoomTo = (zoom: number) => {
    onViewChange(zoomAround(view, zoom, { x: paneSize.width / 2, y: paneSize.height / 2 }))
  }

  const paneProps = {
    mode: props.mode,
    tool: props.tool,
    design,
    impl,
    layout,
    diff: props.diff,
    diffBase: props.diffBase,
    onionOpacity: props.onionOpacity,
    blendDifference: props.blendDifference,
    blinkShowsDesign: props.blinkShowsDesign,
    splitPos: props.splitPos,
    onSplitChange: props.onSplitChange,
    view,
    onViewChange,
    onPaneSize: handlePaneSize,
    hover,
    onHover: handleHover,
    onLeave: handleLeave,
    laser: side && pointerInside,
    issues: props.issues,
    selectedId: props.selectedId,
    onSelectIssue: props.onSelectIssue,
    onCreateBox: props.onCreateBox,
    ruler: props.ruler,
    onRulerChange: props.onRulerChange,
    designScale,
  }

  if (mode === 'live' && props.designSettings && props.implSettings) {
    return (
      <LiveBrowserView
        designSettings={props.designSettings}
        implSettings={props.implSettings}
        onUpdateDesignSettings={props.onUpdateDesignSettings ?? (() => {})}
        onUpdateImplSettings={props.onUpdateImplSettings ?? (() => {})}
        onCaptureBoth={props.onCaptureBoth ?? (() => {})}
        capturingBoth={props.capturingBoth ?? false}
        onAddToast={props.onAddToast ?? (() => {})}
      />
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div id="viewport" className="relative flex min-h-0 flex-1">
        {side ? (
          <>
            <ViewPane {...paneProps} kind="design" label="DESIGN" />
            <div className="w-px shrink-0 bg-white/10" />
            <ViewPane {...paneProps} kind="impl" label="IMPLEMENTATION" />
          </>
        ) : (
          <ViewPane {...paneProps} kind="composite" />
        )}

        {!hasContent && <EmptyState onLoadDemo={onLoadDemo} />}

        <PixelLoupe hover={hasContent ? hover : null} designSampler={designSampler} implSampler={implSampler} layout={layout} />

        {/* Zoom controls */}
        <div className="glass absolute right-3 bottom-3 z-20 flex items-center gap-0.5 rounded-xl p-1">
          <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
            <Minus size={14} />
          </IconButton>
          <button
            type="button"
            onClick={() => zoomTo(1)}
            title="Reset to 100%"
            className="w-12 rounded-md py-1 text-center font-mono text-[11px] text-ink-100 hover:bg-white/[0.08]"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <IconButton label="Zoom in" onClick={() => zoomBy(1.25)}>
            <Plus size={14} />
          </IconButton>
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <IconButton label="Fit to view (F)" onClick={fit}>
            <Maximize size={14} />
          </IconButton>
        </div>
      </div>

      <HudBar
        hover={hasContent ? hover : null}
        designSampler={designSampler}
        implSampler={implSampler}
        layout={layout}
        meta={meta}
        designScale={designScale}
        zoom={view.zoom}
      />
    </div>
  )
}

function EmptyState({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="glass pointer-events-auto flex max-w-md flex-col items-center gap-4 rounded-3xl px-10 py-9 text-center animate-slide-up">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-iris-500/30 to-neon-500/30 ring-1 ring-white/10">
          <ImagePlus size={26} className="text-iris-300" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-white">Drop in a design to start</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-300">
            Load the Figma export on the left (drag &amp; drop, upload, or <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>), then capture your
            localhost page with <Kbd>R</Kbd> or paste a screenshot.
          </p>
        </div>
        <Button variant="neon" size="lg" icon={<FlaskConical size={15} />} onClick={onLoadDemo} id="load-demo">
          Try the demo scenario
        </Button>
      </div>
    </div>
  )
}
