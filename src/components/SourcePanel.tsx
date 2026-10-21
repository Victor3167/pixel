import { Crosshair, Globe, Monitor, Palette, PanelLeftClose, Sparkles } from 'lucide-react'
import type { CaptureMeta, CaptureSettings, DesignScale, LoadedImage, PasteTarget, Point } from '../types/audit'
import type { ResolvedViewport } from '../utils/captureParams'
import { CalibrationPanel } from './CalibrationPanel'
import { CapturePanel } from './CapturePanel'
import { ImageDropSlot } from './ImageDropSlot'
import { Button, Section } from './ui'

interface SourcePanelProps {
  design: LoadedImage | null
  impl: LoadedImage | null
  pasteTarget: PasteTarget
  onPasteTarget: (target: PasteTarget) => void
  onDesignFile: (file: File) => void
  onImplFile: (file: File) => void
  onClearDesign: () => void
  onClearImpl: () => void
  designScale: DesignScale
  onDesignScale: (scale: DesignScale) => void
  offset: Point
  onOffset: (offset: Point) => void

  /* Design Capture */
  designCaptureSettings: CaptureSettings
  onDesignCaptureSettings: (patch: Partial<CaptureSettings>) => void
  capturingDesign: boolean
  onCaptureDesign: () => void
  designMeta: CaptureMeta | null
  designCaptureError: string | null
  designCaptureWarnings: string[]

  /* Impl Capture */
  implCaptureSettings: CaptureSettings
  onImplCaptureSettings: (patch: Partial<CaptureSettings>) => void
  resolvedViewport: ResolvedViewport
  capturingImpl: boolean
  onCaptureImpl: () => void
  implMeta: CaptureMeta | null
  implCaptureError: string | null
  implCaptureWarnings: string[]

  /* Dual / Batch Capture */
  onCaptureBoth?: () => void
  capturingBoth?: boolean

  /* Live Browser Navigation */
  onOpenLiveMode?: () => void
  isLiveMode?: boolean

  /* Panel Collapse */
  onClose?: () => void
}

export function SourcePanel(props: SourcePanelProps) {
  const canCaptureBoth =
    Boolean(props.designCaptureSettings.url.trim()) && Boolean(props.implCaptureSettings.url.trim())

  return (
    <aside
      id="source-panel"
      className="scroll-thin flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.08] bg-ink-950 transition-all duration-200 z-10"
    >
      {/* Header with Title & Collapse Button */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] px-3 bg-ink-900/50">
        <span className="text-[12px] font-semibold tracking-wide text-white flex items-center gap-2">
          <Monitor size={13} className="text-iris-400" />
          <span>Fontes &amp; Captura</span>
        </span>
        {props.onClose && (
          <button
            type="button"
            onClick={props.onClose}
            title="Recolher painel (Ctrl+B)"
            className="flex size-6 items-center justify-center rounded text-ink-400 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <PanelLeftClose size={13} />
          </button>
        )}
      </div>

      {/* Live Navigation & Quick Both-Capture Actions */}
      <div className="border-b border-white/[0.06] p-3 space-y-2">
        <Button
          id="open-live-mode-button"
          variant={props.isLiveMode ? 'neon' : 'subtle'}
          size="md"
          className="w-full justify-center shadow-sm"
          icon={<Globe size={14} className={props.isLiveMode ? 'text-black' : 'text-neon-300'} />}
          onClick={props.onOpenLiveMode}
        >
          {props.isLiveMode ? '● Modo Ao Vivo Ativo' : '🌐 Navegar nas Páginas ao Vivo'}
        </Button>

        {canCaptureBoth && (
          <Button
            id="capture-both-button"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-ink-300 hover:text-white"
            icon={<Sparkles size={13} />}
            loading={props.capturingBoth}
            disabled={props.capturingDesign || props.capturingImpl}
            onClick={props.onCaptureBoth}
          >
            {props.capturingBoth ? 'Capturing Both…' : '⚡ One-Click Capture Both'}
          </Button>
        )}
      </div>

      {/* Slot A: Design Reference */}
      <Section title="Design Reference (Figma or URL)" icon={<Palette size={12} />}>
        <ImageDropSlot
          id="design-slot"
          title="Reference"
          badge="A"
          badgeClass="bg-iris-500/20 text-iris-300"
          image={props.design}
          isPasteTarget={props.pasteTarget === 'design'}
          onSelectAsPasteTarget={() => props.onPasteTarget('design')}
          onFile={props.onDesignFile}
          onClear={props.onClearDesign}
          emptyHint="Figma export (or URL below)"
          footer={
            <CapturePanel
              type="design"
              settings={props.designCaptureSettings}
              onChange={props.onDesignCaptureSettings}
              capturing={props.capturingDesign}
              onCapture={props.onCaptureDesign}
              meta={props.designMeta}
              error={props.designCaptureError}
              warnings={props.designCaptureWarnings}
            />
          }
        />
      </Section>

      {/* Slot B: Implementation / Localhost */}
      <Section title="Live Implementation" icon={<Monitor size={12} />}>
        <ImageDropSlot
          id="impl-slot"
          title="Implementation"
          badge="B"
          badgeClass="bg-neon-500/20 text-neon-300"
          image={props.impl}
          isPasteTarget={props.pasteTarget === 'impl'}
          onSelectAsPasteTarget={() => props.onPasteTarget('impl')}
          onFile={props.onImplFile}
          onClear={props.onClearImpl}
          emptyHint="Screenshot (or Localhost below)"
          footer={
            <CapturePanel
              type="impl"
              settings={props.implCaptureSettings}
              onChange={props.onImplCaptureSettings}
              resolved={props.resolvedViewport}
              hasDesign={props.design !== null}
              companionUrl={props.designCaptureSettings.url}
              capturing={props.capturingImpl}
              onCapture={props.onCaptureImpl}
              meta={props.implMeta}
              error={props.implCaptureError}
              warnings={props.implCaptureWarnings}
            />
          }
        />
      </Section>

      {/* Sub-Pixel Calibration */}
      <Section title="Calibration" icon={<Crosshair size={12} />} className="border-b-0">
        <CalibrationPanel
          designScale={props.designScale}
          onDesignScale={props.onDesignScale}
          offset={props.offset}
          onOffset={props.onOffset}
          design={props.design}
          impl={props.impl}
        />
      </Section>
    </aside>
  )
}
