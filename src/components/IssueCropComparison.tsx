import { useEffect, useRef, useState } from 'react'
import { Columns2, Crosshair, Eye, Layers, SplitSquareVertical } from 'lucide-react'
import type { ComparisonLayout, DiffResult, LoadedImage, Rect } from '../types/audit'
import { cn } from '../utils/cn'

interface IssueCropComparisonProps {
  rect: Rect
  design: LoadedImage | null
  impl: LoadedImage | null
  diff: DiffResult | null
  layout: ComparisonLayout
  designHex?: string | null
  implHex?: string | null
  onFocusOnCanvas?: () => void
}

type CropViewMode = 'side' | 'split' | 'diff'

export function IssueCropComparison({
  rect,
  design,
  impl,
  diff,
  layout,
  designHex,
  implHex,
  onFocusOnCanvas,
}: IssueCropComparisonProps) {
  const [viewMode, setViewMode] = useState<CropViewMode>('side')
  const [splitPos, setSplitPos] = useState<number>(50)

  const sideDesignCanvasRef = useRef<HTMLCanvasElement>(null)
  const sideImplCanvasRef = useRef<HTMLCanvasElement>(null)
  const splitDesignCanvasRef = useRef<HTMLCanvasElement>(null)
  const splitImplCanvasRef = useRef<HTMLCanvasElement>(null)
  const diffCanvasRef = useRef<HTMLCanvasElement>(null)

  // Compute padded bounding box for better context
  const pad = Math.max(8, Math.min(24, Math.round(Math.max(rect.width, rect.height) * 0.08)))
  const cropX = Math.max(0, Math.round(rect.x - pad))
  const cropY = Math.max(0, Math.round(rect.y - pad))
  const cropW = Math.max(10, Math.min(layout.width - cropX, Math.round(rect.width + pad * 2)))
  const cropH = Math.max(10, Math.min(layout.height - cropY, Math.round(rect.height + pad * 2)))

  // Helper to draw crops onto canvas
  useEffect(() => {
    // 1. Draw Design Crop
    const drawDesign = (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !design?.element) return
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, cropW, cropH)
      ctx.drawImage(design.element, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      // Draw subtle boundary of actual issue rect inside padding
      if (pad > 0) {
        ctx.strokeStyle = 'rgba(99, 84, 240, 0.6)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.strokeRect(rect.x - cropX, rect.y - cropY, rect.width, rect.height)
      }
    }

    // 2. Draw Impl Crop
    const drawImpl = (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !impl?.element) return
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, cropW, cropH)

      // Implementation coordinates in comparison space
      const srcX = cropX - layout.offsetX
      const srcY = cropY - layout.offsetY
      ctx.drawImage(impl.element, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH)

      // Draw subtle boundary of actual issue rect inside padding
      if (pad > 0) {
        ctx.strokeStyle = 'rgba(20, 241, 149, 0.7)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.strokeRect(rect.x - cropX, rect.y - cropY, rect.width, rect.height)
      }
    }

    // 3. Draw Diff Crop
    const drawDiff = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, cropW, cropH)

      // Draw implementation base dimmed
      if (impl?.element) {
        const srcX = cropX - layout.offsetX
        const srcY = cropY - layout.offsetY
        ctx.globalAlpha = 0.4
        ctx.drawImage(impl.element, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH)
        ctx.globalAlpha = 1.0
      }

      // Draw magenta diff mask overlay
      if (diff?.maskCanvas) {
        ctx.drawImage(diff.maskCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      }

      // Draw box boundary
      if (pad > 0) {
        ctx.strokeStyle = '#ff4d5e'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.strokeRect(rect.x - cropX, rect.y - cropY, rect.width, rect.height)
      }
    }

    if (viewMode === 'side') {
      drawDesign(sideDesignCanvasRef.current)
      drawImpl(sideImplCanvasRef.current)
    } else if (viewMode === 'split') {
      drawDesign(splitDesignCanvasRef.current)
      drawImpl(splitImplCanvasRef.current)
    } else if (viewMode === 'diff') {
      drawDiff(diffCanvasRef.current)
    }
  }, [viewMode, cropX, cropY, cropW, cropH, pad, rect, design, impl, diff, layout])

  if (!design && !impl) return null

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 overflow-hidden rounded-xl border border-neon-500/30 bg-black/60 p-2.5 shadow-lg animate-fade-in"
    >
      {/* Header with Mode Tabs and Focus Button */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/[0.08] pb-2 text-[10.5px]">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('side')}
            title="Comparação Lado a Lado do Recorte"
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors',
              viewMode === 'side' ? 'bg-iris-500 text-white font-bold' : 'text-ink-300 hover:text-white',
            )}
          >
            <Columns2 size={11} />
            <span>Lado a Lado</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            title="Cortina Deslizante sobre o Recorte"
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors',
              viewMode === 'split' ? 'bg-iris-500 text-white font-bold' : 'text-ink-300 hover:text-white',
            )}
          >
            <SplitSquareVertical size={11} />
            <span>Cortina</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('diff')}
            title="Diferença Visual em Magenta"
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors',
              viewMode === 'diff' ? 'bg-iris-500 text-white font-bold' : 'text-ink-300 hover:text-white',
            )}
          >
            <Layers size={11} />
            <span>Diff Realce</span>
          </button>
        </div>

        {onFocusOnCanvas && (
          <button
            type="button"
            onClick={onFocusOnCanvas}
            title="Focar e ampliar esta região no canvas principal"
            className="flex items-center gap-1 rounded-md bg-neon-500/15 px-2 py-0.5 font-semibold text-neon-300 hover:bg-neon-500/25 transition-all"
          >
            <Crosshair size={11} />
            <span>Ampliar na Tela</span>
          </button>
        )}
      </div>

      {/* Comparison Viewports */}
      <div className="mt-2.5">
        {/* ================================================================== */}
        {/*  SIDE BY SIDE MODE                                                 */}
        {/* ================================================================== */}
        {viewMode === 'side' && (
          <div className="grid grid-cols-2 gap-2">
            {/* Design (Referência) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-iris-300">Design (Esperado)</span>
                {designHex && <span className="font-mono text-ink-400">{designHex}</span>}
              </div>
              <div className="flex min-h-[90px] max-h-44 items-center justify-center overflow-hidden rounded-lg border border-iris-500/30 bg-ink-950/70 p-1">
                <canvas
                  ref={sideDesignCanvasRef}
                  className="max-h-40 max-w-full rounded object-contain shadow-sm"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
            </div>

            {/* Implementation (Local) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-neon-300">Sua Implementação</span>
                {implHex && <span className="font-mono text-ink-400">{implHex}</span>}
              </div>
              <div className="flex min-h-[90px] max-h-44 items-center justify-center overflow-hidden rounded-lg border border-neon-500/30 bg-ink-950/70 p-1">
                <canvas
                  ref={sideImplCanvasRef}
                  className="max-h-40 max-w-full rounded object-contain shadow-sm"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/*  SPLIT CURTAIN SLIDER OVER CROP                                    */}
        {/* ================================================================== */}
        {viewMode === 'split' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] text-ink-300">
              <span>
                <strong className="text-iris-300">Esquerda:</strong> Design
              </span>
              <span>
                <strong className="text-neon-300">Direita:</strong> Implementação
              </span>
            </div>

            <div className="relative flex min-h-[110px] max-h-48 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-ink-950/70 p-1 select-none">
              {/* Implementation base */}
              <canvas
                ref={splitImplCanvasRef}
                className="max-h-44 max-w-full rounded object-contain"
                style={{ imageRendering: 'auto' }}
              />

              {/* Design overlay clipped */}
              <canvas
                ref={splitDesignCanvasRef}
                style={{
                  clipPath: `inset(0 ${100 - splitPos}% 0 0)`,
                  imageRendering: 'auto',
                }}
                className="absolute max-h-44 max-w-full rounded object-contain pointer-events-none"
              />

              {/* Curtain Line */}
              <div
                style={{ left: `${splitPos}%` }}
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-neon-400 shadow-[0_0_8px_rgba(20,241,149,0.9)]"
              />
            </div>

            {/* Slider control */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-iris-300 font-mono">Design</span>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPos}
                onChange={(e) => setSplitPos(Number(e.target.value))}
                className="h-1.5 flex-1 accent-neon-400 cursor-pointer"
              />
              <span className="text-[10px] text-neon-300 font-mono">Local</span>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/*  DIFF OVERLAY MODE                                                 */}
        {/* ================================================================== */}
        {viewMode === 'diff' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-rose-300">Pixels Divergentes (Magenta)</span>
              <span className="text-ink-400 font-mono">
                {rect.width}×{rect.height}px
              </span>
            </div>
            <div className="flex min-h-[110px] max-h-48 items-center justify-center overflow-hidden rounded-lg border border-rose-500/30 bg-ink-950/70 p-1">
              <canvas
                ref={diffCanvasRef}
                className="max-h-44 max-w-full rounded object-contain shadow-sm"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Badge */}
      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-[9.5px] text-ink-400">
        <span className="flex items-center gap-1">
          <Eye size={10} className="text-neon-400" />
          Recorte visual ampliado da divergência
        </span>
        <span className="font-mono text-ink-300">
          ΔX: {rect.x}px · ΔY: {rect.y}px
        </span>
      </div>
    </div>
  )
}
