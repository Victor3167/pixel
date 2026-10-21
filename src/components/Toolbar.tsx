import { Blend, Columns2, Hand, Layers, Ruler, ScanSearch, SquareDashed, SquareSplitHorizontal, Zap } from 'lucide-react'
import type { DiffBase, DiffResult, InspectionMode, ToolMode } from '../types/audit'
import { cn } from '../utils/cn'
import { Button, Kbd, Segmented, Slider, Toggle } from './ui'

const CANVAS_MODES: { value: InspectionMode; label: string; key: string; icon: typeof Layers; hint: string }[] = [
  { value: 'diff', label: 'Pixel Diff', key: '1', icon: ScanSearch, hint: 'Diferença pixel-a-pixel com realce magenta' },
  { value: 'split', label: 'Cortina', key: '2', icon: SquareSplitHorizontal, hint: 'Divisor deslizante interativo' },
  { value: 'side', label: 'Lado a Lado', key: '3', icon: Columns2, hint: 'Visualização paralela sincronizada' },
  { value: 'onion', label: 'Onion Skin', key: '4', icon: Layers, hint: 'Sobreposição com opacidade e mesclagem' },
  { value: 'blink', label: 'Blink', key: '5', icon: Zap, hint: 'Alterne instantaneamente segurando Espaço' },
]

const TOOLS: { value: ToolMode; label: string; key: string; icon: typeof Hand }[] = [
  { value: 'inspect', label: 'Inspecionar / Pan', key: 'V', icon: Hand },
  { value: 'measure', label: 'Régua', key: 'M', icon: Ruler },
  { value: 'annotate', label: 'Anotar', key: 'A', icon: SquareDashed },
]

interface ToolbarProps {
  mode: InspectionMode
  onModeChange: (mode: InspectionMode) => void
  tool: ToolMode
  onToolChange: (tool: ToolMode) => void
  hasBoth: boolean
  diff: DiffResult | null
  diffBusy: boolean
  threshold: number
  onThreshold: (value: number) => void
  includeAA: boolean
  onIncludeAA: (value: boolean) => void
  diffBase: DiffBase
  onDiffBase: (value: DiffBase) => void
  onionOpacity: number
  onOnionOpacity: (value: number) => void
  blendDifference: boolean
  onBlendDifference: (value: boolean) => void
  blinkShowsDesign: boolean
  onBlinkHold: (down: boolean) => void
  onSplitReset: () => void
}

export function Toolbar(props: ToolbarProps) {
  const { mode, tool, hasBoth } = props

  // When in Live Browser mode, Toolbar is replaced by LiveBrowserView's consolidated toolbar
  if (mode === 'live') return null

  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] bg-ink-950/90 px-3 backdrop-blur-md z-20 select-none overflow-x-auto no-scrollbar gap-3"
      role="toolbar"
      aria-label="Controles de inspeção e diff"
    >
      {/* Left: Inspection Mode Segmented + Tools */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center rounded-lg bg-black/50 p-0.5 ring-1 ring-white/10 shrink-0">
          {CANVAS_MODES.map(({ value, label, key, icon: Icon, hint }) => (
            <button
              key={value}
              id={`mode-${value}`}
              type="button"
              title={`${hint} (${key})`}
              onClick={() => props.onModeChange(value)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
                mode === value
                  ? 'bg-iris-500 text-white shadow-sm font-semibold'
                  : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <Icon size={12.5} className="shrink-0" />
              <span>{label}</span>
              <Kbd className={cn(mode === value && 'border-white/25 bg-black/25 text-white/90')}>{key}</Kbd>
            </button>
          ))}
        </div>

        <span className="h-4 w-px bg-white/10 shrink-0" />

        <div className="flex items-center rounded-lg bg-black/50 p-0.5 ring-1 ring-white/10 shrink-0">
          {TOOLS.map(({ value, label, key, icon: Icon }) => (
            <button
              key={value}
              id={`tool-${value}`}
              type="button"
              title={`${label} (${key})`}
              onClick={() => props.onToolChange(value)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] whitespace-nowrap shrink-0 transition-all duration-150',
                tool === value
                  ? 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-500/40 font-semibold'
                  : 'text-ink-400 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <Icon size={13} className="shrink-0" />
              <Kbd>{key}</Kbd>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Contextual Controls for active inspection mode */}
      <div className="flex items-center gap-3 shrink-0">
        {!hasBoth && (
          <span className="text-[11px] text-ink-400">Carregue um Design e uma Implementação para comparar</span>
        )}

        {hasBoth && mode === 'diff' && (
          <div className="flex items-center gap-3 text-[11px]">
            <Slider
              id="threshold-slider"
              label="Tolerância"
              value={props.threshold}
              min={0}
              max={1}
              step={0.01}
              onChange={props.onThreshold}
              format={(v) => v.toFixed(2)}
            />
            <Toggle id="aa-toggle" checked={props.includeAA} onChange={props.onIncludeAA} label="Anti-aliasing" />
            <Segmented
              value={props.diffBase}
              onChange={props.onDiffBase}
              options={[
                { value: 'design', label: 'Design' },
                { value: 'impl', label: 'Impl' },
                { value: 'none', label: 'Diff Puro' },
              ]}
            />
          </div>
        )}

        {hasBoth && mode === 'onion' && (
          <div className="flex items-center gap-3 text-[11px]">
            <Slider
              id="onion-opacity"
              label="Opacidade"
              value={props.onionOpacity}
              min={0}
              max={1}
              step={0.01}
              onChange={props.onOnionOpacity}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Toggle
              id="blend-toggle"
              checked={props.blendDifference}
              onChange={props.onBlendDifference}
              label={
                <span className="inline-flex items-center gap-1">
                  <Blend size={12} /> Diferença
                </span>
              }
            />
          </div>
        )}

        {hasBoth && mode === 'blink' && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-ink-400">
              Segure <Kbd>Espaço</Kbd>
            </span>
            <Button
              id="blink-hold"
              size="sm"
              variant={props.blinkShowsDesign ? 'neon' : 'subtle'}
              onPointerDown={() => props.onBlinkHold(true)}
              onPointerUp={() => props.onBlinkHold(false)}
              onPointerLeave={() => props.onBlinkHold(false)}
              className="h-6.5 text-[11px] touch-none"
            >
              {props.blinkShowsDesign ? 'EXIBINDO DESIGN' : 'EXIBINDO IMPLEMENTAÇÃO'}
            </Button>
          </div>
        )}

        {hasBoth && mode === 'split' && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-ink-400">Arraste o divisor</span>
            <button
              type="button"
              onClick={props.onSplitReset}
              className="rounded bg-white/10 px-2 py-0.5 text-[10.5px] text-ink-200 hover:bg-white/20 hover:text-white transition-colors"
            >
              Centralizar (50%)
            </button>
          </div>
        )}

        {hasBoth && mode === 'side' && (
          <span className="text-[11px] text-ink-400">Navegação e zoom sincronizados lado a lado</span>
        )}
      </div>
    </div>
  )
}
