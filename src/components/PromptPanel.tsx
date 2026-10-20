import { Check, Copy, Download, FileText, Image as ImageIcon } from 'lucide-react'
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
      <div className="space-y-2.5 border-b border-white/[0.06] p-4">
        <label className="block">
          <FieldLabel>Project / component name</FieldLabel>
          <TextInput id="project-name" value={projectName} placeholder="e.g. Checkout page" onChange={(e) => onProjectName(e.target.value)} />
        </label>
        <label className="block">
          <FieldLabel>Extra context for the IDE agent</FieldLabel>
          <textarea
            id="extra-context"
            rows={2}
            value={extraContext}
            placeholder="Stack, conventions, files to touch (e.g. React + Tailwind, edit src/components/Hero.tsx)…"
            onChange={(e) => onExtraContext(e.target.value)}
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/35 px-2.5 py-2 text-[12px] text-ink-50 placeholder:text-ink-400 hover:border-white/15 focus:border-iris-500/70 focus:outline-none"
          />
        </label>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-300">
            <FileText size={12} /> Cursor / Antigravity prompt
          </span>
          <span className="font-mono text-[10.5px] text-ink-400">
            {issueCount} issue{issueCount === 1 ? '' : 's'} · {prompt.length.toLocaleString('en-US')} chars
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

      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-3">
        <Button
          id="copy-prompt"
          variant="primary"
          size="lg"
          className="col-span-2"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={handleCopy}
        >
          {copied ? 'Copied to clipboard' : 'Copy Prompt to Clipboard'}
        </Button>
        <Button id="download-png" icon={<ImageIcon size={14} />} disabled={!canExportImage} onClick={onDownloadPng}>
          Annotated PNG
        </Button>
        <Button id="download-md" icon={<Download size={14} />} onClick={onDownloadMarkdown}>
          Prompt .md
        </Button>
      </div>
    </div>
  )
}
