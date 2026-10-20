import { useEffect, useRef } from 'react'
import { imageFileFromClipboard } from '../utils/imageLoader'
import { isTypingTarget } from '../utils/dom'
import type { InspectionMode, ToolMode } from '../types/audit'

export interface ShortcutHandlers {
  mode: InspectionMode
  onMode: (mode: InspectionMode) => void
  tool?: ToolMode
  onTool: (tool: ToolMode) => void
  onCapture: () => void
  onAudit: () => void
  onFit: () => void
  onNudge: (dx: number, dy: number) => void
  onBlink: (showDesign: boolean) => void
  onDeleteSelected: () => void
  onEscape: () => void
}

const MODE_KEYS: Record<string, InspectionMode> = {
  '0': 'live',
  '1': 'diff',
  '2': 'onion',
  '3': 'blink',
  '4': 'split',
  '5': 'side',
}

/**
 * Global keyboard shortcuts. The latest handlers are kept in a ref, so the
 * listeners are attached exactly once and never see stale state.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const h = ref.current
      if (isTypingTarget(event.target)) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      if (event.code === 'Space') {
        if (h.mode === 'blink') {
          event.preventDefault()
          if (!event.repeat) h.onBlink(true)
        }
        return
      }

      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const arrow = arrows[event.key]
      if (arrow) {
        if (event.target instanceof HTMLInputElement && event.target.type === 'range') return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        h.onNudge(arrow[0] * step, arrow[1] * step)
        return
      }

      const modeKey = MODE_KEYS[event.key]
      if (modeKey) {
        h.onMode(modeKey)
        return
      }

      switch (event.key.toLowerCase()) {
        case 'r':
          event.preventDefault()
          h.onCapture()
          break
        case 'g':
          event.preventDefault()
          h.onAudit()
          break
        case 'm':
          h.onTool('measure')
          break
        case 'a':
          h.onTool('annotate')
          break
        case 'v':
          h.onTool('inspect')
          break
        case 'f':
          h.onFit()
          break
        case 'delete':
        case 'backspace':
          h.onDeleteSelected()
          break
        case 'escape':
          h.onEscape()
          break
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && ref.current.mode === 'blink') {
        event.preventDefault()
        ref.current.onBlink(false)
      }
    }
    const onBlur = () => ref.current.onBlink(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}

/** Global Ctrl+V (clipboard image) and window-level drag & drop. */
export function useImageIntake(onImage: (file: File) => void): void {
  const ref = useRef(onImage)
  useEffect(() => {
    ref.current = onImage
  })

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = imageFileFromClipboard(event.clipboardData)
      if (!file) return
      event.preventDefault()
      ref.current(file)
    }
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'))
      event.preventDefault()
      if (file) ref.current(file)
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])
}
