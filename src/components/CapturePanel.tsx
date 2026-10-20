import { Camera, Globe, Link2, TriangleAlert } from 'lucide-react'
import type { CaptureMeta, CaptureSettings } from '../types/audit'
import type { ResolvedViewport } from '../utils/captureParams'
import { Button, FieldLabel, Segmented, TextInput, Toggle } from './ui'

interface CapturePanelProps {
  type: 'design' | 'impl'
  settings: CaptureSettings
  onChange: (patch: Partial<CaptureSettings>) => void
  resolved?: ResolvedViewport
  hasDesign?: boolean
  companionUrl?: string
  capturing: boolean
  onCapture: () => void
  meta: CaptureMeta | null
  error: string | null
  warnings: string[]
}

export function CapturePanel({
  type,
  settings,
  onChange,
  resolved,
  hasDesign,
  companionUrl,
  capturing,
  onCapture,
  meta,
  error,
  warnings,
}: CapturePanelProps) {
  const isDesign = type === 'design'

  const handleSyncPath = () => {
    if (!companionUrl) return
    try {
      const comp = new URL(companionUrl)
      const current = settings.url.trim() ? new URL(settings.url.trim()) : new URL('http://localhost:3000')
      current.pathname = comp.pathname
      current.search = comp.search
      onChange({ url: current.toString() })
    } catch {
      // If not a full URL yet, append path
      try {
        const comp = new URL(companionUrl)
        onChange({ url: `http://localhost:3000${comp.pathname}${comp.search}` })
      } catch {
        /* ignore */
      }
    }
  }

  const numberField = (value: number, onValue: (n: number) => void, min: number, max: number, step = 1) => (
    <TextInput
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      className="font-mono"
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onValue(n)
      }}
    />
  )

  return (
    <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3">
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel>
            <span className="inline-flex items-center gap-1">
              <Globe size={11} /> {isDesign ? 'Designer / Reference URL' : 'Target / Localhost URL'}
            </span>
          </FieldLabel>
          {!isDesign && companionUrl && (
            <button
              type="button"
              onClick={handleSyncPath}
              title="Copy path from reference URL"
              className="mb-1 inline-flex items-center gap-1 text-[10px] text-iris-300 hover:text-white"
            >
              <Link2 size={10} /> Sync path
            </button>
          )}
        </div>
        <TextInput
          id={isDesign ? 'capture-design-url' : 'capture-url'}
          value={settings.url}
          placeholder={isDesign ? 'https://lojasilvasalesdesign.bisws.com.br' : 'http://localhost:3000'}
          spellCheck={false}
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-[1fr_76px] gap-2">
        <label className="block">
          <FieldLabel>Selector (optional)</FieldLabel>
          <TextInput
            id={isDesign ? 'capture-design-selector' : 'capture-selector'}
            value={settings.selector}
            placeholder="#hero, .product-main"
            spellCheck={false}
            onChange={(e) => onChange({ selector: e.target.value })}
          />
        </label>
        <label className="block">
          <FieldLabel>Wait (ms)</FieldLabel>
          {numberField(settings.waitForMs, (waitForMs) => onChange({ waitForMs }), 0, 30000, 100)}
        </label>
      </div>

      <div className="space-y-2 rounded-lg bg-black/25 p-2.5">
        {!isDesign && resolved && (
          <div className="flex items-center justify-between">
            <Toggle
              id="auto-sync"
              checked={settings.autoSync}
              onChange={(autoSync) => onChange({ autoSync })}
              label="Auto-sync with Design"
            />
            <span className="font-mono text-[10.5px] text-ink-300" id="resolved-viewport">
              {resolved.width}×{resolved.height} @{resolved.deviceScaleFactor}x
            </span>
          </div>
        )}

        {!isDesign && settings.autoSync && !hasDesign && (
          <p className="text-[10.5px] text-amber-400/90">Load or capture a Design first; using manual size meanwhile.</p>
        )}

        {(isDesign || !settings.autoSync) && (
          <div className="grid grid-cols-3 gap-2">
            <label>
              <FieldLabel>Width</FieldLabel>
              {numberField(settings.manualWidth, (manualWidth) => onChange({ manualWidth }), 1, 8192)}
            </label>
            <label>
              <FieldLabel>Height</FieldLabel>
              {numberField(settings.manualHeight, (manualHeight) => onChange({ manualHeight }), 1, 8192)}
            </label>
            <div>
              <FieldLabel>DPR</FieldLabel>
              <Segmented
                value={settings.manualDeviceScaleFactor}
                onChange={(manualDeviceScaleFactor) => onChange({ manualDeviceScaleFactor })}
                options={[
                  { value: 1, label: '1x' },
                  { value: 2, label: '2x' },
                ]}
                className="w-full"
              />
            </div>
          </div>
        )}

        <Toggle
          id={isDesign ? 'design-hide-scrollbars' : 'hide-scrollbars'}
          checked={settings.hideScrollbars}
          onChange={(hideScrollbars) => onChange({ hideScrollbars })}
          label="Hide scrollbars (no 15-17px shift)"
        />
      </div>

      <Button
        id={isDesign ? 'capture-design-button' : 'capture-button'}
        variant={isDesign ? 'subtle' : 'primary'}
        size="lg"
        className="w-full"
        icon={<Camera size={15} />}
        shortcut={isDesign ? undefined : 'R'}
        loading={capturing}
        onClick={onCapture}
        disabled={!settings.url.trim()}
      >
        {capturing
          ? 'Capturing…'
          : isDesign
            ? 'Capture Reference Layout'
            : 'Capture Localhost'}
      </Button>

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-[11.5px] text-rose-300">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {warnings.map((warning) => (
        <div key={warning} className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] text-amber-300">
          <TriangleAlert size={13} className="mt-px shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      {meta && !error && (
        <p className="font-mono text-[10.5px] text-ink-400">
          Captured in {meta.durationMs}ms · {meta.domMap.length} DOM nodes mapped
        </p>
      )}
    </div>
  )
}
