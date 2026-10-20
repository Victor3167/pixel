import { FlaskConical, Keyboard } from 'lucide-react'
import { Button, Kbd } from './ui'

interface HeaderProps {
  onLoadDemo: () => void
}

export function Header({ onLoadDemo }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-900 px-4">
      <div className="flex items-center gap-3">
        <div className="grid size-7 grid-cols-2 gap-[3px] rounded-lg bg-ink-800 p-1.5 ring-1 ring-white/10">
          <span className="rounded-[2px] bg-gradient-to-br from-iris-500 to-neon-500" />
          <span className="rounded-[2px] bg-ink-500" />
          <span className="rounded-[2px] bg-ink-500" />
          <span className="rounded-[2px] bg-gradient-to-br from-iris-500 to-neon-500" />
        </div>
        <h1 className="text-[14px] font-bold tracking-tight text-white">
          PixelAudit<span className="bg-gradient-to-r from-iris-400 to-neon-400 bg-clip-text text-transparent">2Prompt</span>
        </h1>
        <span className="hidden rounded-md bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-ink-300 md:inline">
          Visual regression · Layout QA · Prompt generator
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-[10.5px] text-ink-400 lg:flex">
          <Keyboard size={13} />
          <span>
            <Kbd>1</Kbd>–<Kbd>5</Kbd> modes
          </span>
          <span>
            <Kbd>R</Kbd> capture
          </span>
          <span>
            <Kbd>G</Kbd> AI
          </span>
          <span>
            <Kbd>M</Kbd> ruler
          </span>
          <span>
            <Kbd>A</Kbd> annotate
          </span>
          <span>
            <Kbd>F</Kbd> fit
          </span>
        </div>
        <Button size="sm" icon={<FlaskConical size={12} />} onClick={onLoadDemo} id="header-demo">
          Demo
        </Button>
      </div>
    </header>
  )
}
