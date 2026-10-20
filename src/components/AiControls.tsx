import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Sparkles, TriangleAlert } from 'lucide-react'
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
}

export function AiControls({ apiKey, onApiKey, envKeyAvailable, model, onModel, running, canRun, onRun, error }: AiControlsProps) {
  const [reveal, setReveal] = useState(false)

  return (
    <div className="space-y-2.5 border-b border-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-300">
          <Sparkles size={12} /> AI Vision Audit
        </h2>
        <Segmented
          id="model-select"
          value={model}
          onChange={onModel}
          options={GEMINI_MODELS.map((m) => ({ value: m.value, label: m.label, title: m.hint }))}
        />
      </div>

      <div className="relative">
        <KeyRound size={12} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
        <TextInput
          id="gemini-key"
          type={reveal ? 'text' : 'password'}
          value={apiKey}
          autoComplete="off"
          spellCheck={false}
          placeholder={envKeyAvailable ? 'Using VITE_GEMINI_API_KEY' : 'GEMINI_API_KEY'}
          className="pr-8 pl-7 font-mono"
          onChange={(e) => onApiKey(e.target.value)}
        />
        <button
          type="button"
          aria-label={reveal ? 'Hide API key' : 'Show API key'}
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
        className="w-full"
        icon={<Sparkles size={15} />}
        shortcut="G"
        loading={running}
        disabled={!canRun}
        onClick={onRun}
      >
        {running ? 'Gemini is auditing…' : 'AI Auto-Detect Bugs'}
      </Button>

      {!canRun && !running && <p className="text-[10.5px] text-ink-400">Needs a Design, an Implementation and a Gemini API key.</p>}

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-[11.5px] text-rose-300">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
