import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '../utils/cn'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CircleCheck : toast.kind === 'error' ? CircleAlert : Info
        return (
          <div
            key={toast.id}
            className={cn(
              'glass flex max-w-md items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] animate-slide-up',
              toast.kind === 'success' && 'text-mint-400',
              toast.kind === 'error' && 'text-rose-300',
              toast.kind === 'info' && 'text-ink-100',
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
