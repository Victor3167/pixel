import type { ReactNode } from 'react'
import { ClipboardList, ListChecks } from 'lucide-react'
import { cn } from '../utils/cn'

export type RightTab = 'issues' | 'prompt'

interface RightPanelProps {
  tab: RightTab
  onTab: (tab: RightTab) => void
  issueCount: number
  aiControls: ReactNode
  issues: ReactNode
  prompt: ReactNode
}

export function RightPanel({ tab, onTab, issueCount, aiControls, issues, prompt }: RightPanelProps) {
  const tabs: { id: RightTab; label: string; icon: ReactNode }[] = [
    { id: 'issues', label: 'Issues', icon: <ListChecks size={13} /> },
    { id: 'prompt', label: 'Prompt', icon: <ClipboardList size={13} /> },
  ]

  return (
    <aside id="right-panel" className="flex w-[380px] shrink-0 flex-col border-l border-white/[0.06] bg-ink-900">
      {aiControls}

      <div role="tablist" className="flex gap-1 border-b border-white/[0.06] px-3 pt-2">
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
              tab === t.id ? 'text-white' : 'text-ink-300 hover:text-white',
            )}
          >
            {t.icon}
            {t.label}
            {t.id === 'issues' && issueCount > 0 && (
              <span className="rounded-full bg-neon-500/20 px-1.5 font-mono text-[10px] text-neon-300">{issueCount}</span>
            )}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-iris-500 to-neon-500" />}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{tab === 'issues' ? issues : prompt}</div>
    </aside>
  )
}
