import { Check, Copy, Download, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, FieldLabel, TextInput } from './ui'

interface PromptPanelProps {
  projectName: string
  onProjectName: (value: string) => void
  extraContext: string
  onExtraContext: (value: string) => void
  prompt: string
  issueCount: number
  canExportImage: boolean
  aiRunning?: boolean
  onGeneratePrompt?: () => void
  onCopy: () => Promise<boolean>
  onDownloadPng: () => void
  onDownloadMarkdown: () => void
}

export function PromptPanel({
  projectName,
  onProjectName,
  extraContext,
  onExtraContext,
  prompt,
  issueCount,
  canExportImage,
  aiRunning,
  onGeneratePrompt,
  onCopy,
  onDownloadPng,
  onDownloadMarkdown,
}: PromptPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (await onCopy()) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Generate / Refresh Button */}
      {onGeneratePrompt && (
        <div className="border-b border-white/[0.06] p-3 bg-white/[0.02]">
          <Button
            id="generate-prompt-btn"
            variant="neon"
            size="lg"
            className="w-full font-bold shadow-[0_0_16px_rgba(20,241,149,0.3)] transition-transform hover:scale-[1.01]"
            icon={<Sparkles size={15} />}
            loading={aiRunning}
            onClick={onGeneratePrompt}
          >
            {aiRunning ? 'Analisando e gerando prompt…' : '✨ Gerar / Atualizar Prompt de Correção'}
          </Button>
        </div>
      )}

      {/* Project & Context Inputs */}
      <div className="space-y-2.5 border-b border-white/[0.06] p-4">
        <label className="block">
          <FieldLabel>Nome do Projeto / Componente</FieldLabel>
          <TextInput
            id="project-name"
            value={projectName}
            placeholder="ex: Loja Virtual - Página Principal"
            onChange={(e) => onProjectName(e.target.value)}
          />
        </label>
        <label className="block">
          <FieldLabel>Contexto adicional para o Agente / IDE</FieldLabel>
          <textarea
            id="extra-context"
            rows={2}
            value={extraContext}
            placeholder="Stack, convenções, arquivos a editar (ex: Next.js + Tailwind, editar src/components/Header.tsx)…"
            onChange={(e) => onExtraContext(e.target.value)}
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/35 px-2.5 py-2 text-[12px] text-ink-50 placeholder:text-ink-400 hover:border-white/15 focus:border-iris-500/70 focus:outline-none"
          />
        </label>
      </div>

      {/* Prompt Preview Textarea */}
      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-300">
            <FileText size={12} className="text-iris-400" /> Prompt Estruturado (Cursor / Antigravity)
          </span>
          <span className="font-mono text-[10.5px] text-ink-400">
            {issueCount} {issueCount === 1 ? 'divergência' : 'divergências'} · {prompt.length.toLocaleString('pt-BR')} caracteres
          </span>
        </div>
        <textarea
          id="prompt-output"
          readOnly
          value={prompt}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          className="scroll-thin min-h-0 flex-1 resize-none rounded-xl border border-white/[0.07] bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-ink-100 focus:border-iris-500/50 focus:outline-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-3">
        <Button
          id="copy-prompt"
          variant="primary"
          size="lg"
          className="col-span-2 font-bold shadow-md"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={handleCopy}
        >
          {copied ? 'Copiado para a Área de Transferência!' : 'Copiar Prompt para a Área de Transferência'}
        </Button>
        <Button
          id="download-png"
          icon={<ImageIcon size={14} />}
          disabled={!canExportImage}
          onClick={onDownloadPng}
        >
          Baixar PNG Anotado
        </Button>
        <Button id="download-md" icon={<Download size={14} />} onClick={onDownloadMarkdown}>
          Baixar Arquivo .md
        </Button>
      </div>
    </div>
  )
}
