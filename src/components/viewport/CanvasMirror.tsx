import { useLayoutEffect, useRef, type CSSProperties } from 'react'

interface CanvasMirrorProps {
  source: HTMLCanvasElement
  style?: CSSProperties
}

/**
 * Renders an offscreen canvas 1:1 at stage (0,0). The canvas bitmap keeps the
 * exact pixel size; zoom is applied by the parent stage transform.
 */
export function CanvasMirror({ source, style }: CanvasMirrorProps) {
  const ref = useLayoutEffectCanvas(source)
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: source.width,
        height: source.height,
        maxWidth: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}

function useLayoutEffectCanvas(source: HTMLCanvasElement) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = source.width
    canvas.height = source.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0)
  }, [source])
  return ref
}
