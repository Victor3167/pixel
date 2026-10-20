import { Blend, Columns2, Globe, Hand, Layers, Ruler, ScanSearch, SquareDashed, SquareSplitHorizontal, Zap } from 'lucide-react'
import type { DiffBase, DiffResult, InspectionMode, ToolMode } from '../types/audit'
import { cn } from '../utils/cn'
import { formatMatchScore } from '../utils/pixelDiff'
import { Button, Kbd, Segmented, Slider, Toggle } from './ui'

const MODES: { value: InspectionMode; label: string; key: string; icon: typeof Layers; hint: string }[] = [
  { value: 'live', label: 'Navegação ao Vivo', key: '0', icon: Globe, hint: 'Navegue nas páginas ao vivo, faça login e sincronize localizações' },
  { value: 'diff', label: 'Pixel Diff', key: '1', icon: ScanSearch, hint: 'Auto pixelmatch diff with neon-magenta overlay' },
  { value: 'onion', label: 'Onion Skin', key: '2', icon: Layers, hint: 'Opacity overlay + mix-blend-mode: difference' },
  { value: 'blink', label: 'Blink', key: '3', icon: Zap, hint: 'Hold Space to flip Design ↔ Implementation' },
  { value: 'split', label: 'Curtain', key: '4', icon: SquareSplitHorizontal, hint: 'Draggable split reveal' },
  { value: 'side', label: 'Side by Side', key: '5', icon: Columns2, hint: 'Synced pan / zoom with mirrored crosshair' },
]

const TOOLS: { value: ToolMode; label: string; key: string; icon: typeof Hand }[] = [
  { value: 'inspect', label: 'Inspect / Pan', key: 'V', icon: Hand },
  { value: 'measure', label: 'Ruler', key: 'M', icon: Ruler },
  { value: 'annotate', label: 'Annotate', key: 'A', icon: SquareDashed },
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
  const { mode, tool, hasBoth, diff, diffBusy } = props
  const score = diff?.matchScore ?? null

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1" role="toolbar" aria-label="Inspection modes">
        {MODES.map(({ value, label, key, icon: Icon, hint }) => (
          <button
            key={value}
            id={`mode-${value}`}
            type="button"
            title={`${hint} (${key})`}
            onClick={() => props.onModeChange(value)}
            className={cn(
              'group flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium transition-all duration-150',
              mode === value
                ? 'bg-iris-500 text-white shadow-[0_4px_16px_-4px_rgb(99_84_240/0.9)]'
                : 'text-ink-200 hover:bg-white/[0.07] hover:text-white',
            )}
          >
            <Icon size={14} />
            <span className="hidden xl:inline">{label}</span>
            <Kbd className={cn(mode === value && 'border-white/25 bg-black/25 text-white/90')}>{key}</Kbd>
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-white/10" />

        {TOOLS.map(({ value, label, key, icon: Icon }) => (
          <button
            key={value}
            id={`tool-${value}`}
            type="button"
            title={`${label} (${key})`}
            onClick={() => props.onToolChange(value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-xl px-2 text-[12px] transition-all duration-150',
              tool === value
                ? 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-500/40'
                : 'text-ink-300 hover:bg-white/[0.07] hover:text-white',
            )}
          >
            <Icon size={14} />
            <Kbd>{key}</Kbd>
          </button>
        ))}
      </div>

      <div className="glass pointer-events-auto flex min-h-10 items-center gap-4 rounded-2xl px-4 py-1.5 animate-pop" key={mode}>
        {mode === 'live' && (
          <div className="flex items-center gap-2 text-[12px] text-ink-200">
            <span className="flex items-center gap-1.5 font-medium text-neon-300">
              <span className="size-2 rounded-full bg-neon-400 animate-pulse" /> Navegação ao Vivo
            </span>
            <span className="text-white/20">·</span>
            <span>Escolha a página para mexer e use o botão <strong>Sincronizar Localização</strong> para alinhar as rotas</span>
          </div>
        )}

        {!hasBoth && mode !== 'live' && <span className="text-[11.5px] text-ink-300">Load a Design and an Implementation to compare.</span>}

        {hasBoth && mode === 'diff' && (
          <>
            <div
              id="match-score"
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold ring-1',
                score === null
                  ? 'bg-white/5 text-ink-300 ring-white/10'
                  : score >= 99
                    ? 'bg-mint-400/10 text-mint-400 ring-mint-400/30'
                    : score >= 95
                      ? 'bg-amber-400/10 text-amber-400 ring-amber-400/30'
                      : 'bg-neon-500/10 text-neon-300 ring-neon-500/30',
              )}
            >
              <span className={cn('size-1.5 rounded-full bg-current', diffBusy && 'animate-pulse')} />
              Match Score: {diffBusy && !diff ? '…' : `${formatMatchScore(diff)}%`}
            </div>
            <Slider
              id="threshold-slider"
              label="Threshold"
              value={props.threshold}
              min={0}
              max={1}
              step={0.01}
              onChange={props.onThreshold}
              format={(v) => v.toFixed(2)}
            />
            <Toggle id="aa-toggle" checked={props.includeAA} onChange={props.onIncludeAA} label="Count anti-aliasing" />
            <Segmented
              value={props.diffBase}
              onChange={props.onDiffBase}
              options={[
                { value: 'design', label: 'Design' },
                { value: 'impl', label: 'Impl' },
                { value: 'none', label: 'None' },
              ]}
            />
          </>
        )}

        {hasBoth && mode === 'onion' && (
          <>
            <Slider
              id="onion-opacity"
              label="Design opacity"
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
                  <Blend size={12} /> mix-blend-mode: difference
                </span>
              }
            />
          </>
        )}

        {hasBoth && mode === 'blink' && (
          <>
            <span className="text-[11.5px] text-ink-300">
              Hold <Kbd>Space</Kbd> to flip instantly
            </span>
            <Button
              id="blink-hold"
              size="sm"
              variant={props.blinkShowsDesign ? 'neon' : 'subtle'}
              onPointerDown={() => props.onBlinkHold(true)}
              onPointerUp={() => props.onBlinkHold(false)}
              onPointerLeave={() => props.onBlinkHold(false)}
              className="w-40 touch-none"
            >
              {props.blinkShowsDesign ? 'SHOWING DESIGN' : 'SHOWING IMPLEMENTATION'}
            </Button>
          </>
        )}

        {hasBoth && mode === 'split' && (
          <>
            <span className="text-[11.5px] text-ink-300">Drag the divider · left = Design, right = Implementation</span>
            <Button size="sm" onClick={props.onSplitReset}>
              Center
            </Button>
          </>
        )}

        {hasBoth && mode === 'side' && (
          <span className="text-[11.5px] text-ink-300">Synced pan / zoom with a mirrored laser crosshair</span>
        )}
      </div>
    </div>
  )
}
