import { useState } from 'react'
import { BookOpen, Eye, EyeOff, KeyRound, Sparkles, TriangleAlert } from 'lucide-react'
import type { GeminiModel } from '../types/audit'
import { GEMINI_MODELS } from '../utils/geminiVisionAudit'
import { Button, Segmented, TextInput } from './ui'

interface AiControlsProps {
  apiKey: string
  onApiKey: (key: string) => void
  envKeyAvailable: boolean
  model: GeminiModel
  onModel: (model: GeminiModel) => void
  running: boolean
  canRun: boolean
  onRun: () => void
  error: string | null
  onOpenObsidianDoc?: () => void
  hasObsidianDoc?: boolean
  obsidianDocTitle?: string
  obsidianDocInAudit?: boolean
}

export function AiControls({
  apiKey,
  onApiKey,
  envKeyAvailable,
  model,
  onModel,
  running,
  canRun,
  onRun,
  error,
  onOpenObsidianDoc,
  hasObsidianDoc,
  obsidianDocTitle,
  obsidianDocInAudit,
}: AiControlsProps) {
  const [reveal, setReveal] = useState(false)

  return (
    <div className="space-y-2.5 border-b border-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-300">
          <Sparkles size={12} className="text-neon-400" /> Auditoria Visual com IA
        </h2>
        <Segmented
          id="model-select"
          value={model}
          onChange={onModel}
          options={GEMINI_MODELS.map((m) => ({ value: m.value, label: m.label, title: m.hint }))}
        />
      </div>

      {/* Obsidian Doc spec status banner */}
      {onOpenObsidianDoc && (
        <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen size={13} className={hasObsidianDoc && obsidianDocInAudit ? 'text-military-400' : 'text-ink-400'} />
            <span className="text-ink-300 font-medium">Doc Obsidian:</span>
            <span className="truncate font-mono text-white text-[10.5px] max-w-[120px]">
              {hasObsidianDoc ? (obsidianDocTitle || 'Doc ativo') : 'Nenhum'}
            </span>
            {hasObsidianDoc && obsidianDocInAudit && (
              <span className="rounded bg-military-500/20 px-1 py-0.5 text-[9px] font-semibold text-military-300">
                Ativo na IA
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenObsidianDoc}
            className="text-[10.5px] font-semibold text-military-300 hover:text-white hover:underline shrink-0 ml-2"
          >
            {hasObsidianDoc ? 'Editar' : '+ Anexar'}
          </button>
        </div>
      )}

      <div className="relative">
        <KeyRound size={12} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
        <TextInput
          id="gemini-key"
          type={reveal ? 'text' : 'password'}
          value={apiKey}
          autoComplete="off"
          spellCheck={false}
          placeholder={envKeyAvailable ? 'Usando chave do .env' : 'Cole sua Gemini API Key aqui'}
          className="pr-8 pl-7 font-mono text-[11px]"
          onChange={(e) => onApiKey(e.target.value)}
        />
        <button
          type="button"
          aria-label={reveal ? 'Ocultar chave' : 'Mostrar chave'}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-400 hover:text-white"
          onClick={() => setReveal((v) => !v)}
        >
          {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      <Button
        id="ai-audit-button"
        variant="neon"
        size="lg"
        className="w-full font-bold shadow-md"
        icon={<Sparkles size={15} />}
        shortcut="G"
        loading={running}
        disabled={!canRun}
        onClick={onRun}
      >
        {running ? 'IA analisando divergências…' : 'Detectar Diferenças com IA'}
      </Button>

      {!canRun && !running && (
        <p className="text-[10.5px] text-amber-300/90">
          {!apiKey.trim() && !envKeyAvailable
            ? 'Cole sua chave Gemini API acima para habilitar a auditoria.'
            : 'Defina a URL de referência e de implementação para auditar.'}
        </p>
      )}

      {canRun && !running && (
        <p className="text-[10px] text-neon-300/90">
          ✨ Pronto para auditar! Clique no botão para comparar e detectar divergências.
        </p>
      )}

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-[11.5px] text-rose-300">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
