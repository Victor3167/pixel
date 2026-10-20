import { useEffect, useRef } from 'react'
import { Bug, Crosshair, Eye, Trash } from 'lucide-react'
import {
  CATEGORY_LABELS_PT,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  SEVERITY_LABELS_PT,
  type AuditIssue,
  type ComparisonLayout,
  type DesignScale,
  type DiffResult,
  type IssueCategory,
  type IssueSeverity,
  type LoadedImage,
  type Rect,
} from '../types/audit'
import { cn } from '../utils/cn'
import { describeDomNode, selectorHint } from '../utils/domMatch'
import { formatNumber } from '../utils/geometry'
import { IssueCropComparison } from './IssueCropComparison'
import { ColorSwatch, IconButton } from './ui'

const SEVERITY_STYLE: Record<IssueSeverity, string> = {
  critical: 'bg-rose-400/15 text-rose-300',
  major: 'bg-amber-400/15 text-amber-300',
  minor: 'bg-sky-400/15 text-sky-300',
}

interface IssueCardProps {
  issue: AuditIssue
  index: number
  selected: boolean
  designScale: DesignScale
  design: LoadedImage | null
  impl: LoadedImage | null
  diff: DiffResult | null
  layout: ComparisonLayout
  onSelect: () => void
  onChange: (patch: Partial<AuditIssue>) => void
  onDelete: () => void
  onFocusOnCanvas?: () => void
}

const fieldClass =
  'w-full resize-none rounded-md border border-white/[0.07] bg-black/30 px-2 py-1.5 text-[11.5px] leading-snug text-ink-100 ' +
  'placeholder:text-ink-400 transition-colors hover:border-white/15 focus:border-iris-500/60 focus:outline-none'

function IssueCard({
  issue,
  index,
  selected,
  designScale,
  design,
  impl,
  diff,
  layout,
  onSelect,
  onChange,
  onDelete,
  onFocusOnCanvas,
}: IssueCardProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const { rect, dom } = issue
  const css = (n: number) => formatNumber(Math.round((n / designScale) * 100) / 100)

  return (
    <article
      ref={ref}
      id={`issue-${index + 1}`}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-xl border bg-ink-850/80 p-3 transition-all duration-200 animate-slide-up',
        selected
          ? 'border-neon-500/60 ring-2 ring-neon-500/30 shadow-[0_0_24px_rgba(20,241,149,0.2)]'
          : 'border-white/[0.07] hover:border-white/20 hover:bg-ink-850',
      )}
    >
      <header className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[11.5px] font-bold text-white',
            selected ? 'bg-neon-500 text-black shadow-md' : 'bg-[#ff4d5e]',
          )}
        >
          {index + 1}
        </span>
        <select
          value={issue.category}
          aria-label="Categoria"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ category: e.target.value as IssueCategory })}
          className="h-6 min-w-0 flex-1 rounded-md border border-white/[0.07] bg-black/40 px-1.5 text-[11px] font-medium text-ink-50 focus:outline-none"
        >
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-ink-800">
              {CATEGORY_LABELS_PT[c] ?? c}
            </option>
          ))}
        </select>
        <select
          value={issue.severity}
          aria-label="Gravidade"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ severity: e.target.value as IssueSeverity })}
          className={cn(
            'h-6 rounded-md border-0 px-1.5 text-[10px] font-semibold uppercase tracking-wide focus:outline-none',
            SEVERITY_STYLE[issue.severity],
          )}
        >
          {ISSUE_SEVERITIES.map((s) => (
            <option key={s} value={s} className="bg-ink-800 text-ink-50">
              {SEVERITY_LABELS_PT[s] ?? s}
            </option>
          ))}
        </select>
        <IconButton
          label="Excluir divergência"
          className="size-6 hover:text-rose-400"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash size={12} />
        </IconButton>
      </header>

      {/* Coordinates & Source Badges */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink-300">
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-sans font-semibold uppercase tracking-wider">
          {issue.source === 'ai' ? '✦ IA' : 'Manual'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Crosshair size={10} />
          {rect.x},{rect.y} · {rect.width}×{rect.height}px
        </span>
        {designScale !== 1 && (
          <span className="text-ink-400">
            css {css(rect.x)},{css(rect.y)} · {css(rect.width)}×{css(rect.height)}
          </span>
        )}
      </div>

      {/* Color Swatches */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <ColorSwatch hex={issue.designHex} label="Design (Esperado)" />
        <ColorSwatch hex={issue.implHex} label="Local (Atual)" />
      </div>

      {/* DOM Node Descriptor */}
      <div className="mt-2">
        {dom ? (
          <p
            className="truncate rounded-md border border-iris-500/30 bg-iris-500/10 px-2 py-1 font-mono text-[10.5px] text-iris-300"
            title={`${describeDomNode(dom)} → ${selectorHint(dom)}`}
          >
            {describeDomNode(dom)}
          </p>
        ) : (
          <p className="text-[10px] text-ink-400">Nenhum elemento DOM resolvido para este ponto.</p>
        )}
      </div>

      {/* ==================================================================== */}
      {/*  VISUAL CROP COMPARISON (Revealed when card is selected/clicked)     */}
      {/* ==================================================================== */}
      {selected ? (
        <IssueCropComparison
          rect={issue.rect}
          design={design}
          impl={impl}
          diff={diff}
          layout={layout}
          designHex={issue.designHex}
          implHex={issue.implHex}
          onFocusOnCanvas={onFocusOnCanvas}
        />
      ) : (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-ink-400 hover:text-ink-200 transition-colors">
          <span className="flex items-center gap-1.5">
            <Eye size={11} className="text-iris-400" />
            <span>Clique para abrir a comparação visual lado a lado</span>
          </span>
          <span className="text-[10px] font-semibold text-iris-400">Ver Recorte →</span>
        </div>
      )}

      {/* Editable Fields in pt-BR */}
      <div className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-ink-300">
            O que está diferente:
          </label>
          <textarea
            aria-label="O que está diferente"
            rows={2}
            value={issue.description}
            placeholder="Descreva o que está divergente em relação ao design de referência..."
            className={fieldClass}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-ink-300">
            Correção sugerida (CSS / Marcação):
          </label>
          <textarea
            aria-label="Correção sugerida"
            rows={2}
            value={issue.expectedFix}
            placeholder="Instruções de código ou CSS para corrigir o componente..."
            className={cn(fieldClass, 'font-mono text-[11px]')}
            onChange={(e) => onChange({ expectedFix: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-ink-400">
            Anotações do desenvolvedor:
          </label>
          <textarea
            aria-label="Anotações do desenvolvedor"
            rows={1}
            value={issue.notes}
            placeholder="Anotações internas..."
            className={fieldClass}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      </div>

      {dom && (
        <details className="mt-2 group" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none text-[10.5px] font-medium text-ink-300 hover:text-white">
            Snapshot de CSS Computado
          </summary>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-black/40 p-2 font-mono text-[10.5px]">
            {Object.entries(dom.computedStyles).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-ink-400">{key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}</dt>
                <dd className="truncate text-ink-100" title={value}>
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  )
}

interface IssuesPanelProps {
  issues: AuditIssue[]
  selectedId: string | null
  designScale: DesignScale
  design: LoadedImage | null
  impl: LoadedImage | null
  diff: DiffResult | null
  layout: ComparisonLayout
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<AuditIssue>) => void
  onDelete: (id: string) => void
  onClear: () => void
  onFocusOnCanvas?: (rect: Rect) => void
}

export function IssuesPanel({
  issues,
  selectedId,
  designScale,
  design,
  impl,
  diff,
  layout,
  onSelect,
  onChange,
  onDelete,
  onClear,
  onFocusOnCanvas,
}: IssuesPanelProps) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
          <Bug size={22} className="text-ink-300" />
        </div>
        <p className="text-[12.5px] font-medium text-ink-100">Nenhuma divergência registrada</p>
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          Pressione <b className="text-neon-300">G</b> para auditar com a IA, ou pressione <b className="text-iris-300">A</b> e arraste
          uma caixa retangular na tela para marcar manualmente.
        </p>
      </div>
    )
  }

  return (
    <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto p-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-ink-300">
          {issues.length} {issues.length === 1 ? 'divergência detectada' : 'divergências detectadas'}
        </span>
        <button type="button" onClick={onClear} className="text-[11px] text-ink-400 hover:text-rose-400">
          Limpar todas
        </button>
      </div>
      {issues.map((issue, index) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          index={index}
          selected={issue.id === selectedId}
          designScale={designScale}
          design={design}
          impl={impl}
          diff={diff}
          layout={layout}
          onSelect={() => onSelect(issue.id)}
          onChange={(patch) => onChange(issue.id, patch)}
          onDelete={() => onDelete(issue.id)}
          onFocusOnCanvas={() => onFocusOnCanvas?.(issue.rect)}
        />
      ))}
    </div>
  )
}
