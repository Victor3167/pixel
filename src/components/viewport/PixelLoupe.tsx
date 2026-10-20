import { useEffect, useRef } from 'react'
import type { ComparisonLayout, Point } from '../../types/audit'
import type { PixelSampler } from '../../utils/pixelSampler'

const RADIUS = 4
const CELLS = RADIUS * 2 + 1
const CELL_PX = 12

interface PixelLoupeProps {
  hover: Point | null
  designSampler: PixelSampler | null
  implSampler: PixelSampler | null
  layout: ComparisonLayout
}

/** Two 9x9 magnifiers (Design / Implementation) centred on the hovered pixel. */
export function PixelLoupe({ hover, designSampler, implSampler, layout }: PixelLoupeProps) {
  if (!hover) return null
  return (
    <div className="glass pointer-events-none absolute bottom-3 left-3 z-20 flex gap-2 rounded-xl p-2 animate-pop">
      <LoupeCanvas title="Design" sampler={designSampler} x={hover.x} y={hover.y} />
      <LoupeCanvas title="Impl" sampler={implSampler} x={hover.x - layout.offsetX} y={hover.y - layout.offsetY} />
    </div>
  )
}

function LoupeCanvas({ title, sampler, x, y }: { title: string; sampler: PixelSampler | null; x: number; y: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CELLS, CELLS)
    if (sampler) ctx.putImageData(sampler.region(x, y, RADIUS), 0, 0)
  }, [sampler, x, y])

  return (
    <div>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</div>
      <div className="checker relative overflow-hidden rounded-md ring-1 ring-white/15" style={{ width: CELLS * CELL_PX, height: CELLS * CELL_PX }}>
        <canvas
          ref={ref}
          width={CELLS}
          height={CELLS}
          style={{ width: CELLS * CELL_PX, height: CELLS * CELL_PX, imageRendering: 'pixelated' }}
        />
        <span
          className="absolute border border-white shadow-[0_0_0_1px_rgb(0_0_0/0.85)]"
          style={{ left: RADIUS * CELL_PX, top: RADIUS * CELL_PX, width: CELL_PX, height: CELL_PX }}
        />
      </div>
    </div>
  )
}
