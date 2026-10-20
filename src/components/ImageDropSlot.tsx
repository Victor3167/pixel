import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ClipboardPaste, ImagePlus, RefreshCw, X } from 'lucide-react'
import type { LoadedImage } from '../types/audit'
import { cn } from '../utils/cn'
import { firstImageFile } from '../utils/imageLoader'
import { IconButton, Kbd } from './ui'

interface ImageDropSlotProps {
  id: string
  title: string
  badge: string
  badgeClass: string
  image: LoadedImage | null
  isPasteTarget: boolean
  onSelectAsPasteTarget: () => void
  onFile: (file: File) => void
  onClear: () => void
  emptyHint: string
  footer?: ReactNode
}

/** Drag-and-drop / click-to-upload slot with a paste-target indicator. */
export function ImageDropSlot({
  id,
  title,
  badge,
  badgeClass,
  image,
  isPasteTarget,
  onSelectAsPasteTarget,
  onFile,
  onClear,
  emptyHint,
  footer,
}: ImageDropSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
    const file = firstImageFile(event.dataTransfer.files)
    if (file) onFile(file)
  }

  return (
    <div
      id={id}
      onClick={onSelectAsPasteTarget}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group relative rounded-xl border bg-ink-850/80 p-3 transition-all duration-200',
        dragging
          ? 'border-iris-400 bg-iris-500/10 shadow-glow-iris'
          : isPasteTarget
            ? 'border-iris-500/50 shadow-[0_0_0_3px_rgb(122_107_255/0.12)]'
            : 'border-white/[0.07] hover:border-white/15',
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.14em]', badgeClass)}>{badge}</span>
          <h3 className="text-[12.5px] font-semibold text-white">{title}</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-medium transition-opacity',
            isPasteTarget ? 'bg-iris-500/15 text-iris-300 opacity-100' : 'opacity-0 group-hover:opacity-60 text-ink-300',
          )}
        >
          <ClipboardPaste size={10} /> <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>
        </span>
      </div>

      {image ? (
        <div className="flex gap-3">
          <div className="checker h-[58px] w-[74px] shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
            <img src={image.url} alt={`${title} thumbnail`} className="size-full object-contain" draggable={false} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink-50" title={image.name}>
              {image.name}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-300">
              {image.width} × {image.height}px
            </p>
            <div className="mt-1.5 flex gap-1">
              <IconButton
                label="Replace image"
                className="size-6 bg-white/[0.05]"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
              >
                <RefreshCw size={12} />
              </IconButton>
              <IconButton
                label="Remove image"
                className="size-6 bg-white/[0.05] hover:text-rose-400"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
              >
                <X size={12} />
              </IconButton>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelectAsPasteTarget()
            inputRef.current?.click()
          }}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-black/20 py-5 text-ink-300 transition-colors hover:border-iris-400/60 hover:text-iris-300"
        >
          <ImagePlus size={20} />
          <span className="text-[11.5px] font-medium">{emptyHint}</span>
          <span className="text-[10.5px] text-ink-400">Drop, click to upload or paste</span>
        </button>
      )}

      {footer}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = firstImageFile(e.target.files)
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
