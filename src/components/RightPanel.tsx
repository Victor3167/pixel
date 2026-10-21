import type { ReactNode } from 'react'
import { ClipboardList, ListChecks, PanelRightClose } from 'lucide-react'
import { cn } from '../utils/cn'

export type RightTab = 'issues' | 'prompt'

interface RightPanelProps {
  tab: RightTab
  onTab: (tab: RightTab) => void
  issueCount: number
  aiControls: ReactNode
  issues: ReactNode
  prompt: ReactNode
  onClose?: () => void
}

export function RightPanel({ tab, onTab, issueCount, aiControls, issues, prompt, onClose }: RightPanelProps) {
  const tabs: { id: RightTab; label: string; icon: ReactNode }[] = [
    { id: 'issues', label: 'Divergências', icon: <ListChecks size={13} /> },
    { id: 'prompt', label: 'Prompt de Correção', icon: <ClipboardList size={13} /> },
  ]

  return (
    <aside
      id="right-panel"
      className="flex w-[380px] shrink-0 flex-col border-l border-white/[0.08] bg-ink-950 transition-all duration-200 z-10"
    >
      {/* Top AI Controls */}
      {aiControls}

      {/* Tabs Row with Close Button */}
      <div role="tablist" className="flex items-center justify-between border-b border-white/[0.08] px-3 pt-1.5 bg-ink-900/50">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-medium transition-colors',
                tab === t.id ? 'text-white font-semibold' : 'text-ink-400 hover:text-white',
              )}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.id === 'issues' && issueCount > 0 && (
                <span className="rounded-full bg-neon-500/20 px-1.5 font-mono text-[10px] font-bold text-neon-300">
                  {issueCount}
                </span>
              )}
              {tab === t.id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-iris-500 to-neon-500" />
              )}
            </button>
          ))}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Recolher painel (Ctrl+I)"
            className="flex size-6 items-center justify-center rounded text-ink-400 hover:bg-white/[0.08] hover:text-white transition-colors mb-1"
          >
            <PanelRightClose size={13} />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{tab === 'issues' ? issues : prompt}</div>
    </aside>
  )
}
