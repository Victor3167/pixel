import { BookOpen, FlaskConical, Globe, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, ScanSearch, Sparkles } from 'lucide-react'
import type { InspectionMode } from '../types/audit'
import { cn } from '../utils/cn'
import { Button } from './ui'

interface HeaderProps {
  onLoadDemo: () => void
  mode: InspectionMode
  onModeChange: (mode: InspectionMode) => void
  showLeftPanel: boolean
  onToggleLeftPanel: () => void
  showRightPanel: boolean
  onToggleRightPanel: () => void
  issueCount: number
  onRunAi?: () => void
  aiRunning?: boolean
  canRunAi?: boolean
  matchScore?: number | null
  onOpenObsidianDoc?: () => void
  obsidianDocTitle?: string
  hasObsidianDoc?: boolean
}

export function Header({
  onLoadDemo,
  mode,
  onModeChange,
  showLeftPanel,
  onToggleLeftPanel,
  showRightPanel,
  onToggleRightPanel,
  issueCount,
  onRunAi,
  aiRunning,
  canRunAi,
  matchScore,
  onOpenObsidianDoc,
  obsidianDocTitle,
  hasObsidianDoc,
}: HeaderProps) {
  const isLive = mode === 'live'

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-ink-950 px-3 z-30 select-none">
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleLeftPanel}
          title={showLeftPanel ? 'Ocultar Fontes & Captura (Ctrl+B)' : 'Mostrar Fontes & Captura (Ctrl+B)'}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg border transition-all duration-150',
            showLeftPanel
              ? 'border-iris-500/30 bg-iris-500/15 text-iris-300 shadow-sm'
              : 'border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
          )}
        >
          {showLeftPanel ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="grid size-6 grid-cols-2 gap-[2px] rounded-md bg-ink-800 p-1 ring-1 ring-white/10">
            <span className="rounded-[1.5px] bg-gradient-to-br from-iris-500 to-neon-500" />
            <span className="rounded-[1.5px] bg-ink-500" />
            <span className="rounded-[1.5px] bg-ink-500" />
            <span className="rounded-[1.5px] bg-gradient-to-br from-iris-500 to-neon-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-bold tracking-tight text-white">
              PixelAudit<span className="bg-gradient-to-r from-iris-400 to-neon-400 bg-clip-text text-transparent">2Prompt</span>
            </span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-medium text-ink-300 tracking-wide">
              PRO
            </span>
            <span className="border-l border-white/10 pl-2.5 text-[10px] font-medium text-ink-500 whitespace-nowrap">
              Desenvolvido por Victor Picelli
            </span>
          </div>
        </div>
      </div>

      {/* Center: Clean Segmented Mode Selector */}
      <div className="flex items-center rounded-xl bg-ink-900 p-1 ring-1 ring-white/10 shadow-inner">
        <button
          type="button"
          id="header-mode-live"
          onClick={() => onModeChange('live')}
          className={cn(
            'flex h-7.5 items-center gap-2 rounded-lg px-3.5 text-[12px] font-medium transition-all duration-150',
            isLive
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold shadow-[0_2px_12px_rgba(16,185,129,0.35)]'
              : 'text-ink-300 hover:text-white hover:bg-white/[0.05]',
          )}
        >
          <Globe size={13} className={isLive ? 'text-black' : 'text-emerald-400'} />
          <span>Ao Vivo</span>
          <span className={cn('size-1.5 rounded-full', isLive ? 'bg-black animate-pulse' : 'bg-emerald-400/80')} />
        </button>

        <button
          type="button"
          id="header-mode-diff"
          onClick={() => {
            if (isLive) onModeChange('diff')
          }}
          className={cn(
            'flex h-7.5 items-center gap-2 rounded-lg px-3.5 text-[12px] font-medium transition-all duration-150',
            !isLive
              ? 'bg-iris-500 text-white font-semibold shadow-[0_2px_12px_rgba(74,91,49,0.5)]'
              : 'text-ink-300 hover:text-white hover:bg-white/[0.05]',
          )}
        >
          <ScanSearch size={13} className={!isLive ? 'text-white' : 'text-iris-300'} />
          <span>Pixel Diff &amp; Inspeção</span>
        </button>
      </div>

      {/* Right: Actions & Auditor Toggle */}
      <div className="flex items-center gap-2">
        {/* Match Score Indicator (When in diff mode) */}
        {!isLive && matchScore !== undefined && matchScore !== null && (
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold ring-1',
              matchScore >= 99
                ? 'bg-mint-400/10 text-mint-400 ring-mint-400/30'
                : matchScore >= 95
                  ? 'bg-amber-400/10 text-amber-400 ring-amber-400/30'
                  : 'bg-neon-500/10 text-neon-300 ring-neon-500/30',
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            <span>{matchScore.toFixed(1)}% Match</span>
          </div>
        )}

        {/* AI Audit Primary CTA */}
        {onRunAi && (
          <Button
            id="header-run-ai"
            size="sm"
            variant="neon"
            loading={aiRunning}
            disabled={!canRunAi}
            onClick={onRunAi}
            icon={<Sparkles size={13} className={aiRunning ? 'animate-spin' : ''} />}
            title="Executar auditoria inteligente com Gemini Vision AI"
            className="font-bold shadow-[0_2px_14px_rgba(34,197,94,0.35)]"
          >
            {aiRunning ? 'Auditando…' : 'Auditar com IA'}
          </Button>
        )}

        {/* Obsidian Doc Trigger */}
        {onOpenObsidianDoc && (
          <Button
            size="sm"
            variant="subtle"
            id="header-obsidian-doc"
            icon={<BookOpen size={12} className={hasObsidianDoc ? 'text-military-400' : 'text-ink-300'} />}
            onClick={onOpenObsidianDoc}
            title={
              hasObsidianDoc
                ? `Doc Obsidian ativo: ${obsidianDocTitle || 'Documentação'} (clique para editar ou trocar)`
                : 'Adicionar documentação ou regras do Obsidian'
            }
            className={cn(
              'transition-all',
              hasObsidianDoc
                ? 'border-military-500/40 bg-military-500/15 text-military-300 font-semibold'
                : 'text-ink-300 hover:text-white',
            )}
          >
            <span className="hidden md:inline max-w-[130px] truncate">
              {hasObsidianDoc ? (obsidianDocTitle || 'Doc Obsidian') : 'Doc Obsidian'}
            </span>
            {hasObsidianDoc && <span className="size-1.5 rounded-full bg-military-400 shrink-0" />}
          </Button>
        )}

        {/* Demo Scenario Button */}
        <Button
          size="sm"
          variant="subtle"
          icon={<FlaskConical size={12} />}
          onClick={onLoadDemo}
          id="header-demo"
          className="text-ink-300 hover:text-white"
        >
          Demo
        </Button>

        {/* Right Panel Toggle (Divergências & Prompt) */}
        <button
          type="button"
          onClick={onToggleRightPanel}
          title={showRightPanel ? 'Ocultar Auditoria & Prompt (Ctrl+I)' : 'Mostrar Auditoria & Prompt (Ctrl+I)'}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg border transition-all duration-150 relative',
            showRightPanel
              ? 'border-iris-500/30 bg-iris-500/15 text-iris-300 shadow-sm'
              : 'border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
          )}
        >
          {showRightPanel ? <PanelRightClose size={15} /> : <PanelRight size={15} />}
          {issueCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-500 px-1 font-mono text-[9px] font-bold text-black ring-2 ring-ink-950">
              {issueCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
