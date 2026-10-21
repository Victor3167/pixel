import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

/* -------------------------------------------------------------------------- */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-white/10',
        'bg-white/[0.06] px-1 font-mono text-[10px] font-medium leading-none text-ink-200',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'neon' | 'ghost' | 'subtle' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  shortcut?: string
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-military-500 to-military-600 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_6px_20px_-4px_rgba(74,91,49,0.7)] hover:from-military-400 hover:to-military-500',
  neon: 'bg-gradient-to-r from-military-600 via-emerald-600 to-emerald-500 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_6px_20px_-4px_rgba(34,197,94,0.5)] hover:brightness-110',
  ghost: 'bg-transparent text-ink-200 hover:bg-white/[0.06] hover:text-white',
  subtle: 'border border-white/10 bg-white/[0.04] text-ink-100 hover:bg-white/[0.09] hover:border-white/20',
  danger: 'border border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20',
}

const SIZES = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-[11.5px]',
  md: 'h-8 gap-2 rounded-lg px-3 text-[12px]',
  lg: 'h-10 gap-2 rounded-xl px-4 text-[13px]',
}

export function Button({
  variant = 'subtle',
  size = 'md',
  loading,
  icon,
  shortcut,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : icon}
      {children}
      {shortcut && !loading && <Kbd className="ml-0.5 border-white/20 bg-black/25 text-white/80">{shortcut}</Kbd>}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  label: string
}

export function IconButton({ active, label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-300 transition-all duration-150',
        'hover:bg-white/[0.08] hover:text-white active:scale-90 disabled:opacity-40',
        active && 'bg-iris-500/20 text-iris-300',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

interface SegmentedProps<T extends string | number> {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
  className?: string
  id?: string
}

export function Segmented<T extends string | number>({ value, options, onChange, className, id }: SegmentedProps<T>) {
  return (
    <div id={id} role="radiogroup" className={cn('inline-flex rounded-lg border border-white/[0.07] bg-black/30 p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-all duration-150',
              active ? 'bg-iris-500 text-white shadow-[0_2px_10px_-2px_rgba(74,91,49,0.7)] font-medium' : 'text-ink-300 hover:text-white',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  id?: string
  className?: string
}

export function Slider({ label, value, min, max, step, onChange, format, id, className }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <label className={cn('flex items-center gap-2.5 text-[11.5px] text-ink-300', className)}>
      <span className="shrink-0">{label}</span>
      <input
        id={id}
        type="range"
        className="range w-28"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-100">
        {format ? format(value) : value}
      </span>
    </label>
  )
}

/* -------------------------------------------------------------------------- */

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  id?: string
  className?: string
}

export function Toggle({ checked, onChange, label, id, className }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('group inline-flex items-center gap-2 text-[11.5px] text-ink-300 hover:text-white', className)}
    >
      <span
        className={cn(
          'relative h-4 w-7 rounded-full transition-colors duration-200',
          checked ? 'bg-iris-500' : 'bg-ink-500',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-white shadow transition-all duration-200',
            checked ? 'left-[14px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

export function Section({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-b border-white/[0.06] px-4 py-3.5', className)}>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-300">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/* -------------------------------------------------------------------------- */

export function TextInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-8 w-full rounded-lg border border-white/[0.08] bg-black/35 px-2.5 text-[12px] text-ink-50 placeholder:text-ink-400',
        'transition-colors hover:border-white/15 focus:border-iris-500/70 focus:outline-none',
        className,
      )}
    />
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[10.5px] font-medium text-ink-300">{children}</span>
}

/* -------------------------------------------------------------------------- */

export function ColorSwatch({ hex, label }: { hex: string | null; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="checker size-3.5 shrink-0 overflow-hidden rounded-[4px] ring-1 ring-white/20"
        style={hex ? { background: hex } : undefined}
      />
      <span className="font-mono text-[11px] text-ink-100">{hex ?? '—'}</span>
      {label && <span className="text-[10px] text-ink-400">{label}</span>}
    </span>
  )
}
