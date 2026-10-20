import { Minus, Plus, RotateCcw, TriangleAlert } from 'lucide-react'
import type { DesignScale, LoadedImage, Point } from '../types/audit'
import { Button, IconButton, Kbd, Segmented } from './ui'

interface CalibrationPanelProps {
  designScale: DesignScale
  onDesignScale: (scale: DesignScale) => void
  offset: Point
  onOffset: (offset: Point) => void
  design: LoadedImage | null
  impl: LoadedImage | null
}

function Stepper({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex-1">
      <span className="mb-1 block text-[10.5px] font-medium text-ink-300">{label}</span>
      <div className="flex h-8 items-center rounded-lg border border-white/[0.08] bg-black/35">
        <IconButton label={`${label} −1px`} className="size-8 rounded-l-lg rounded-r-none" onClick={() => onChange(value - 1)}>
          <Minus size={12} />
        </IconButton>
        <input
          id={id}
          type="number"
          value={value}
          step={1}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value))
            if (Number.isFinite(n)) onChange(n)
          }}
          className="h-full w-full min-w-0 bg-transparent text-center font-mono text-[12px] text-ink-50 outline-none"
        />
        <IconButton label={`${label} +1px`} className="size-8 rounded-l-none rounded-r-lg" onClick={() => onChange(value + 1)}>
          <Plus size={12} />
        </IconButton>
      </div>
    </div>
  )
}

export function CalibrationPanel({ designScale, onDesignScale, offset, onOffset, design, impl }: CalibrationPanelProps) {
  const mismatch = design && impl && (design.width !== impl.width || design.height !== impl.height)

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-[10.5px] font-medium text-ink-300">Design scale factor</span>
        <Segmented
          id="design-scale"
          value={designScale}
          onChange={onDesignScale}
          className="w-full"
          options={[
            { value: 0.5, label: '0.5x', title: 'Design exported at half density' },
            { value: 1, label: '1x', title: 'Standard export' },
            { value: 2, label: '2x', title: 'Figma Retina export' },
          ]}
        />
      </div>

      <div>
        <div className="flex gap-2">
          <Stepper id="offset-x" label="Offset X (px)" value={offset.x} onChange={(x) => onOffset({ ...offset, x })} />
          <Stepper id="offset-y" label="Offset Y (px)" value={offset.y} onChange={(y) => onOffset({ ...offset, y })} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10.5px] text-ink-400">
            <Kbd>←</Kbd>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Kbd>→</Kbd> nudge · <Kbd>Shift</Kbd> ×10
          </span>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={11} />} disabled={offset.x === 0 && offset.y === 0} onClick={() => onOffset({ x: 0, y: 0 })}>
            Reset
          </Button>
        </div>
      </div>

      {mismatch && design && impl && (
        <div className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] leading-snug text-amber-300">
          <TriangleAlert size={13} className="mt-px shrink-0" />
          <span>
            Size mismatch: design {design.width}×{design.height} vs implementation {impl.width}×{impl.height}. Images are
            never rescaled; the extra area counts as a difference.
          </span>
        </div>
      )}
    </div>
  )
}
