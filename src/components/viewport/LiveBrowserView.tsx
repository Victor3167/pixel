import {
  ArrowRight,
  Camera,
  Columns2,
  ExternalLink,
  KeyRound,
  Layers,
  RefreshCw,
  SplitSquareVertical,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaptureSettings } from '../../types/audit'
import { cn } from '../../utils/cn'
import { Button, Kbd, Toggle } from '../ui'

export type ActiveControlTarget = 'a' | 'b' | 'both'
export type LiveComparisonMode = 'split' | 'onion' | 'blink' | 'side' | 'focus-a' | 'focus-b'
export type DevicePreset = 'fluid' | '1440' | '1280' | '768' | '390'

const COMMON_ROUTES = [
  { label: 'Home', path: '/' },
  { label: 'Login', path: '/login' },
  { label: 'Produtos', path: '/produtos' },
  { label: 'Carrinho', path: '/carrinho' },
  { label: 'Minha Conta', path: '/minha-conta' },
]

interface LiveBrowserViewProps {
  designSettings: CaptureSettings
  implSettings: CaptureSettings
  onUpdateDesignSettings: (patch: Partial<CaptureSettings>) => void
  onUpdateImplSettings: (patch: Partial<CaptureSettings>) => void
  onCaptureBoth: () => void
  capturingBoth: boolean
  onAddToast: (kind: 'info' | 'success' | 'error', message: string) => void
}

/** Parses a base origin and current pathname/search */
function parseUrl(rawUrl: string, fallbackDefault: string): { origin: string; path: string } {
  const trimmed = rawUrl.trim() || fallbackDefault
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`)
    return {
      origin: parsed.origin,
      path: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/',
    }
  } catch {
    return { origin: fallbackDefault, path: '/' }
  }
}

export function LiveBrowserView({
  designSettings,
  implSettings,
  onUpdateDesignSettings,
  onUpdateImplSettings,
  onCaptureBoth,
  capturingBoth,
  onAddToast,
}: LiveBrowserViewProps) {
  /* ------------------------------- State ----------------------------------- */
  // Active page to interact with ("escolher qual página mexer")
  const [activeTarget, setActiveTarget] = useState<ActiveControlTarget>('a')
  // Comparison layout ("um em cima do outro para usar as funcionalidades de comparação")
  const [mode, setMode] = useState<LiveComparisonMode>('split')
  const [devicePreset, setDevicePreset] = useState<DevicePreset>('fluid')

  // Onion skin controls
  const [onionOpacity, setOnionOpacity] = useState<number>(0.5)
  const [blendDifference, setBlendDifference] = useState<boolean>(false)

  // Blink mode controls
  const [blinkShowsDesign, setBlinkShowsDesign] = useState<boolean>(false)

  // Split curtain controls
  const [splitPos, setSplitPos] = useState<number>(50) // percentage (0 - 100)
  const isDraggingSplit = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Parsed URLs & current paths
  const parsedA = useMemo(
    () => parseUrl(designSettings.url, 'https://lojasilvasalesdesign.bisws.com.br'),
    [designSettings.url],
  )
  const parsedB = useMemo(
    () => parseUrl(implSettings.url, 'http://localhost:3000'),
    [implSettings.url],
  )

  const [pathA, setPathA] = useState<string>(parsedA.path || '/')
  const [pathB, setPathB] = useState<string>(parsedB.path || '/')
  const [sharedRouteInput, setSharedRouteInput] = useState<string>(parsedA.path || '/')

  // Frame refresh keys
  const [refreshKeyA, setRefreshKeyA] = useState<number>(0)
  const [refreshKeyB, setRefreshKeyB] = useState<number>(0)

  // Full URLs for the iframes
  const fullUrlA = useMemo(
    () => `${parsedA.origin}${pathA.startsWith('/') ? '' : '/'}${pathA}`,
    [parsedA.origin, pathA],
  )
  const fullUrlB = useMemo(
    () => `${parsedB.origin}${pathB.startsWith('/') ? '' : '/'}${pathB}`,
    [parsedB.origin, pathB],
  )

  /* -------------------------- Location Syncing ----------------------------- */
  /** Syncs location from active page to the other, or from A to B */
  const handleSyncLocation = useCallback(
    (direction?: 'a-to-b' | 'b-to-a') => {
      const dir = direction ?? (activeTarget === 'b' ? 'b-to-a' : 'a-to-b')
      if (dir === 'a-to-b') {
        const nextPath = pathA
        setPathB(nextPath)
        setSharedRouteInput(nextPath)
        const nextFull = `${parsedB.origin}${nextPath.startsWith('/') ? '' : '/'}${nextPath}`
        onUpdateImplSettings({ url: nextFull })
        setRefreshKeyB((k) => k + 1)
        onAddToast('success', `Localização sincronizada da Página A para B (${nextPath})`)
      } else {
        const nextPath = pathB
        setPathA(nextPath)
        setSharedRouteInput(nextPath)
        const nextFull = `${parsedA.origin}${nextPath.startsWith('/') ? '' : '/'}${nextPath}`
        onUpdateDesignSettings({ url: nextFull })
        setRefreshKeyA((k) => k + 1)
        onAddToast('success', `Localização sincronizada da Página B para A (${nextPath})`)
      }
    },
    [activeTarget, pathA, pathB, parsedA.origin, parsedB.origin, onUpdateDesignSettings, onUpdateImplSettings, onAddToast],
  )

  /** Navigates both pages to a specific pathname */
  const handleNavigateBoth = useCallback(
    (targetPath: string) => {
      const cleanPath = targetPath.trim() || '/'
      const formatted = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
      setPathA(formatted)
      setPathB(formatted)
      setSharedRouteInput(formatted)

      const fullA = `${parsedA.origin}${formatted}`
      const fullB = `${parsedB.origin}${formatted}`
      onUpdateDesignSettings({ url: fullA })
      onUpdateImplSettings({ url: fullB })

      setRefreshKeyA((k) => k + 1)
      setRefreshKeyB((k) => k + 1)
      onAddToast('info', `Navegando ambas as páginas para: ${formatted}`)
    },
    [parsedA.origin, parsedB.origin, onUpdateDesignSettings, onUpdateImplSettings, onAddToast],
  )

  /** Quick auto-login into prototype A using known token */
  const handleAutoLoginOptionA = useCallback(() => {
    try {
      const frame = document.getElementById('live-frame-a') as HTMLIFrameElement | null
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.localStorage.setItem('loja-base-proto-auth', 'true')
        } catch {
          /* cross-origin handled via query or Playwright */
        }
      }
      onUpdateDesignSettings({
        localStorage: {
          'loja-base-proto-auth': 'true',
        },
      })
      setRefreshKeyA((k) => k + 1)
      onAddToast('success', 'Chave de autenticação aplicada à Opção A!')
    } catch {
      onAddToast('info', 'Você pode fazer login digitando seus dados diretamente na Página A.')
    }
  }, [onUpdateDesignSettings, onAddToast])

  /* -------------------------- Keyboard Shortcuts --------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Spacebar for Blink mode
      if (e.code === 'Space' && mode === 'blink') {
        e.preventDefault()
        if (!e.repeat) setBlinkShowsDesign(true)
        return
      }

      // Alt+A: focus A
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setActiveTarget('a')
        onAddToast('info', 'Mexendo na Página A (Referência)')
      }
      // Alt+B: focus B
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setActiveTarget('b')
        onAddToast('info', 'Mexendo na Página B (Localhost)')
      }
      // Alt+S: sync location
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSyncLocation()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && mode === 'blink') {
        e.preventDefault()
        setBlinkShowsDesign(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [mode, handleSyncLocation, onAddToast])

  /* -------------------------- Split Drag Handlers -------------------------- */
  const handleSplitPointerDown = (e: React.PointerEvent) => {
    isDraggingSplit.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit.current || !splitContainerRef.current) return
    const rect = splitContainerRef.current.getBoundingClientRect()
    const pct = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100))
    setSplitPos(pct)
  }

  const handleSplitPointerUp = () => {
    isDraggingSplit.current = false
  }

  /* -------------------------- Frame Container Sizing ----------------------- */
  const frameContainerStyle = useMemo(() => {
    if (devicePreset === '1440') return { maxWidth: '1440px', margin: '0 auto' }
    if (devicePreset === '1280') return { maxWidth: '1280px', margin: '0 auto' }
    if (devicePreset === '768') return { maxWidth: '768px', margin: '0 auto' }
    if (devicePreset === '390') return { maxWidth: '390px', margin: '0 auto' }
    return { width: '100%' }
  }, [devicePreset])

  const isStackedMode = mode === 'split' || mode === 'onion' || mode === 'blink'

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ink-950 font-sans text-ink-100">
      {/* ==================================================================== */}
      {/*  Top Live Control Bar                                                */}
      {/* ==================================================================== */}
      <div className="z-30 flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.08] bg-ink-900/95 px-4 py-2.5 backdrop-blur-md shadow-lg">
        {/* Left: Active Page Selector ("Escolher qual página mexer") */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-ink-300 uppercase">
            Mexer na Página:
          </span>
          <div className="glass flex items-center rounded-xl p-0.5" role="group" aria-label="Página para interagir">
            <button
              type="button"
              id="control-target-a"
              onClick={() => setActiveTarget('a')}
              title="Interagir e navegar na Página A (Referência / Login) [Alt+A]"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all duration-150',
                activeTarget === 'a'
                  ? 'bg-iris-500 text-white shadow-[0_0_16px_rgba(99,84,240,0.6)]'
                  : 'text-ink-200 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <span className="size-2 rounded-full bg-iris-300 animate-pulse" />
              <span>A: Referência</span>
              <Kbd className="text-[9px]">Alt+A</Kbd>
            </button>

            <button
              type="button"
              id="control-target-b"
              onClick={() => setActiveTarget('b')}
              title="Interagir e navegar na Página B (Localhost / Front) [Alt+B]"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all duration-150',
                activeTarget === 'b'
                  ? 'bg-neon-500 text-black shadow-[0_0_16px_rgba(20,241,149,0.6)]'
                  : 'text-ink-200 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <span className="size-2 rounded-full bg-neon-300 animate-pulse" />
              <span>B: Localhost</span>
              <Kbd className="text-[9px]">Alt+B</Kbd>
            </button>

            {mode === 'side' && (
              <button
                type="button"
                id="control-target-both"
                onClick={() => setActiveTarget('both')}
                title="Interagir com ambas as páginas lado a lado"
                className={cn(
                  'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all duration-150',
                  activeTarget === 'both'
                    ? 'bg-gradient-to-r from-iris-500 to-neon-500 text-white font-semibold shadow-md'
                    : 'text-ink-200 hover:bg-white/[0.07] hover:text-white',
                )}
              >
                <span>Ambas</span>
              </button>
            )}
          </div>
        </div>

        {/* Center-Left: Comparison Mode Switcher ("Um em cima do outro para comparar") */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-ink-300 uppercase">
            Comparação:
          </span>
          <div className="glass flex items-center rounded-xl p-0.5" role="group" aria-label="Modos de comparação ao vivo">
            <button
              type="button"
              id="live-mode-split"
              onClick={() => setMode('split')}
              title="Cortina Divisória: Páginas sobrepostas com divisor deslizante"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all',
                mode === 'split' ? 'bg-iris-500 text-white shadow-md' : 'text-ink-300 hover:text-white hover:bg-white/[0.07]',
              )}
            >
              <SplitSquareVertical size={13} />
              <span>Cortina</span>
            </button>

            <button
              type="button"
              id="live-mode-onion"
              onClick={() => setMode('onion')}
              title="Onion Skin: Páginas sobrepostas uma em cima da outra com opacidade"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all',
                mode === 'onion' ? 'bg-iris-500 text-white shadow-md' : 'text-ink-300 hover:text-white hover:bg-white/[0.07]',
              )}
            >
              <Layers size={13} />
              <span>Onion Skin</span>
            </button>

            <button
              type="button"
              id="live-mode-blink"
              onClick={() => setMode('blink')}
              title="Blink: Segure a barra de espaço para alternar entre as duas páginas"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all',
                mode === 'blink' ? 'bg-iris-500 text-white shadow-md' : 'text-ink-300 hover:text-white hover:bg-white/[0.07]',
              )}
            >
              <Zap size={13} />
              <span>Blink</span>
            </button>

            <button
              type="button"
              id="live-mode-side"
              onClick={() => setMode('side')}
              title="Lado a Lado: Ambas as páginas em paralelo"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all',
                mode === 'side' ? 'bg-iris-500 text-white shadow-md' : 'text-ink-300 hover:text-white hover:bg-white/[0.07]',
              )}
            >
              <Columns2 size={13} />
              <span>Lado a Lado</span>
            </button>

            <button
              type="button"
              id="live-mode-focus-a"
              onClick={() => setMode('focus-a')}
              title="Foco 100% na Página A"
              className={cn(
                'flex size-7.5 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                mode === 'focus-a' ? 'bg-iris-500 text-white' : 'text-ink-400 hover:text-white',
              )}
            >
              A
            </button>

            <button
              type="button"
              id="live-mode-focus-b"
              onClick={() => setMode('focus-b')}
              title="Foco 100% na Página B"
              className={cn(
                'flex size-7.5 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                mode === 'focus-b' ? 'bg-neon-500 text-black' : 'text-ink-400 hover:text-white',
              )}
            >
              B
            </button>
          </div>
        </div>

        {/* Center-Right: Location Synchronizer ("btn de sincronizar a localização") */}
        <div className="flex items-center gap-2">
          <Button
            id="sync-location-btn"
            variant="neon"
            size="sm"
            onClick={() => handleSyncLocation()}
            icon={<RefreshCw size={13} className="text-black" />}
            title="Sincronizar rota entre a página ativa e a outra [Alt+S]"
            className="font-bold shadow-[0_0_16px_rgba(20,241,149,0.35)] hover:scale-[1.02]"
          >
            Sincronizar Localização
          </Button>

          {/* Quick directional sync */}
          <div className="flex items-center gap-0.5 rounded-lg bg-black/40 p-0.5 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => handleSyncLocation('a-to-b')}
              title="Copiar rota da Página A para B"
              className="flex h-7 items-center gap-1 rounded px-2 text-[10.5px] font-medium text-ink-200 hover:bg-white/10 hover:text-white"
            >
              <span className="text-iris-400">A</span>
              <ArrowRight size={10} />
              <span className="text-neon-400">B</span>
            </button>
            <button
              type="button"
              onClick={() => handleSyncLocation('b-to-a')}
              title="Copiar rota da Página B para A"
              className="flex h-7 items-center gap-1 rounded px-2 text-[10.5px] font-medium text-ink-200 hover:bg-white/10 hover:text-white"
            >
              <span className="text-neon-400">B</span>
              <ArrowRight size={10} />
              <span className="text-iris-400">A</span>
            </button>
          </div>

          {/* Shared Route Bar */}
          <div className="flex items-center rounded-lg bg-black/50 ring-1 ring-white/10 px-2 py-0.5 focus-within:ring-iris-500/50">
            <span className="font-mono text-[10.5px] text-ink-400 select-none mr-1.5">Rota:</span>
            <input
              type="text"
              id="shared-route-input"
              value={sharedRouteInput}
              onChange={(e) => setSharedRouteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNavigateBoth(sharedRouteInput)
              }}
              placeholder="/produtos, /carrinho..."
              className="w-28 xl:w-36 bg-transparent font-mono text-[11.5px] text-white outline-none placeholder:text-ink-500"
            />
            <button
              type="button"
              onClick={() => handleNavigateBoth(sharedRouteInput)}
              className="ml-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-iris-300 hover:bg-iris-500/20 hover:text-white"
            >
              Ir
            </button>
          </div>

          {/* Quick Route Preset Chips */}
          <div className="hidden 2xl:flex items-center gap-1">
            {COMMON_ROUTES.map((route) => (
              <button
                key={route.path}
                type="button"
                onClick={() => handleNavigateBoth(route.path)}
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors',
                  sharedRouteInput === route.path
                    ? 'bg-iris-500/30 text-iris-200 ring-1 ring-iris-500/40'
                    : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Quick Login & Snapshot */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="quick-login-option-a"
            onClick={handleAutoLoginOptionA}
            title="Injeta token de autenticação diretamente na Opção A para acessar o protótipo imediatamente"
            className="flex h-7.5 items-center gap-1.5 rounded-xl border border-iris-500/40 bg-iris-500/15 px-2.5 text-[11px] font-medium text-iris-200 hover:bg-iris-500/25 hover:text-white transition-all shadow-sm"
          >
            <KeyRound size={12} className="text-iris-400" />
            <span className="hidden xl:inline">Auto-Login A</span>
          </button>

          {/* Device Presets */}
          <div className="hidden 2xl:flex items-center gap-1 rounded-xl bg-black/30 p-0.5 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setDevicePreset('fluid')}
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === 'fluid' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setDevicePreset('1440')}
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === '1440' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              1440
            </button>
            <button
              type="button"
              onClick={() => setDevicePreset('768')}
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === '768' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              768
            </button>
          </div>

          {/* Action: Snapshot live views to diff */}
          <Button
            id="capture-live-both-btn"
            variant="neon"
            size="sm"
            onClick={onCaptureBoth}
            loading={capturingBoth}
            icon={<Camera size={13} className="text-black" />}
            title="Capturar o estado atual de ambas as páginas para comparar no Pixel Diff e AI"
            className="font-bold shadow-[0_0_20px_rgba(20,241,149,0.35)]"
          >
            {capturingBoth ? 'Capturando…' : '📸 Capturar para Diff'}
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/*  Contextual Controls Bar (Onion, Blink, Curtain)                     */}
      {/* ==================================================================== */}
      {isStackedMode && (
        <div className="z-20 flex items-center justify-between border-b border-white/[0.06] bg-ink-900/80 px-4 py-1.5 text-[11.5px] backdrop-blur-sm animate-slide-up">
          {/* Mode-specific tools */}
          <div className="flex items-center gap-4">
            {mode === 'onion' && (
              <>
                <span className="font-semibold text-iris-300">Modo Onion Skin ao Vivo:</span>
                <div className="flex items-center gap-2">
                  <span className="text-ink-300">Opacidade:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={onionOpacity}
                    onChange={(e) => setOnionOpacity(Number(e.target.value))}
                    className="h-1.5 w-28 accent-iris-500 cursor-pointer"
                  />
                  <span className="font-mono text-white text-[11px]">{Math.round(onionOpacity * 100)}%</span>
                </div>
                <Toggle
                  id="live-blend-diff"
                  checked={blendDifference}
                  onChange={setBlendDifference}
                  label="Modo Diferença (Difference Blend)"
                />
              </>
            )}

            {mode === 'blink' && (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-iris-300">Modo Blink ao Vivo:</span>
                <span className="text-ink-300">
                  Segure a tecla <Kbd>Espaço</Kbd> para ver a <strong>Página A</strong> (solte para ver a <strong>Página B</strong>)
                </span>
                <button
                  type="button"
                  onMouseDown={() => setBlinkShowsDesign(true)}
                  onMouseUp={() => setBlinkShowsDesign(false)}
                  onTouchStart={() => setBlinkShowsDesign(true)}
                  onTouchEnd={() => setBlinkShowsDesign(false)}
                  className="rounded-lg bg-iris-500/20 px-3 py-1 font-medium text-iris-300 ring-1 ring-iris-500/40 hover:bg-iris-500/30"
                >
                  Segure aqui para Alternar
                </button>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase transition-colors',
                    blinkShowsDesign
                      ? 'bg-iris-500 text-white shadow-[0_0_12px_rgba(99,84,240,0.6)]'
                      : 'bg-neon-500 text-black shadow-[0_0_12px_rgba(20,241,149,0.6)]',
                  )}
                >
                  Exibindo: {blinkShowsDesign ? 'A: Referência' : 'B: Localhost'}
                </span>
              </div>
            )}

            {mode === 'split' && (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-iris-300">Cortina Dividida ao Vivo:</span>
                <span className="text-ink-300">
                  Arraste a linha vertical para revelar: <strong className="text-iris-300">Esquerda = Página A</strong> |{' '}
                  <strong className="text-neon-300">Direita = Página B</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSplitPos(50)}
                  className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-ink-200 hover:bg-white/20 hover:text-white"
                >
                  Centralizar (50%)
                </button>
              </div>
            )}
          </div>

          {/* Active interaction indicator */}
          <div className="flex items-center gap-2">
            <span className="text-ink-400">Interação ativa:</span>
            <span
              className={cn(
                'rounded-lg px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1.5',
                activeTarget === 'a'
                  ? 'bg-iris-500/20 text-iris-300 ring-1 ring-iris-500/40'
                  : 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-500/40',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full animate-pulse',
                  activeTarget === 'a' ? 'bg-iris-400' : 'bg-neon-400',
                )}
              />
              {activeTarget === 'a' ? 'Página A (Referência)' : 'Página B (Localhost)'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTarget(activeTarget === 'a' ? 'b' : 'a')}
              className="text-[10px] text-iris-300 hover:text-white underline underline-offset-2 ml-1"
            >
              Alternar
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/*  Live Viewport (Stacked or Side-by-Side)                             */}
      {/* ==================================================================== */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden p-2.5 bg-ink-950">
        <div style={frameContainerStyle} className="relative flex size-full flex-col">
          {/* ================================================================ */}
          {/*  STACKED COMPARISON: Split Curtain, Onion Skin, Blink            */}
          {/* ================================================================ */}
          {isStackedMode ? (
            <div
              ref={splitContainerRef}
              onPointerMove={mode === 'split' ? handleSplitPointerMove : undefined}
              onPointerUp={mode === 'split' ? handleSplitPointerUp : undefined}
              className={cn(
                'relative flex-1 overflow-hidden rounded-2xl border bg-black shadow-2xl select-none',
                activeTarget === 'a' ? 'border-iris-500/50 ring-2 ring-iris-500/30' : 'border-neon-500/50 ring-2 ring-neon-500/30',
              )}
            >
              {/* Common Window Header for Stacked Mode */}
              <div className="absolute top-0 inset-x-0 z-30 flex h-9 items-center justify-between border-b border-white/[0.08] bg-ink-900/90 px-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500/70" />
                    <span className="size-2.5 rounded-full bg-yellow-500/70" />
                    <span className="size-2.5 rounded-full bg-green-500/70" />
                  </div>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {mode === 'split' && 'CORTINA AO VIVO'}
                    {mode === 'onion' && 'ONION SKIN AO VIVO'}
                    {mode === 'blink' && 'BLINK AO VIVO'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-iris-300">
                    A: {parsedA.origin}
                    {pathA}
                  </span>
                  <span className="text-white/20">|</span>
                  <span className="font-mono text-[11px] text-neon-300">
                    B: {parsedB.origin}
                    {pathB}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRefreshKeyA((k) => k + 1)
                      setRefreshKeyB((k) => k + 1)
                    }}
                    title="Recarregar ambas as páginas"
                    className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {/* Stacked Frames Container */}
              <div className="absolute inset-0 top-9 bg-white overflow-hidden">
                {/* ------------------------------------------------------------ */}
                {/*  FRAME A (Reference)                                         */}
                {/* ------------------------------------------------------------ */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex:
                      mode === 'blink'
                        ? blinkShowsDesign
                          ? 20
                          : 5
                        : activeTarget === 'a'
                          ? 20
                          : 10,
                    opacity:
                      mode === 'blink'
                        ? blinkShowsDesign
                          ? 1
                          : 0
                        : mode === 'onion'
                          ? onionOpacity
                          : 1,
                    mixBlendMode: mode === 'onion' && blendDifference ? 'difference' : 'normal',
                    pointerEvents: activeTarget === 'a' ? 'auto' : 'none',
                  }}
                  className="size-full transition-opacity duration-75"
                >
                  <iframe
                    id="live-frame-a"
                    key={refreshKeyA}
                    src={fullUrlA}
                    title="Página A (Referência)"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    className="size-full border-0"
                  />
                </div>

                {/* ------------------------------------------------------------ */}
                {/*  FRAME B (Localhost / Implementation)                        */}
                {/* ------------------------------------------------------------ */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex:
                      mode === 'blink'
                        ? blinkShowsDesign
                          ? 5
                          : 20
                        : activeTarget === 'b'
                          ? 20
                          : 10,
                    opacity: mode === 'blink' ? (blinkShowsDesign ? 0 : 1) : 1,
                    clipPath: mode === 'split' ? `inset(0 0 0 ${splitPos}%)` : undefined,
                    pointerEvents: activeTarget === 'b' ? 'auto' : 'none',
                  }}
                  className="size-full transition-opacity duration-75"
                >
                  <iframe
                    id="live-frame-b"
                    key={refreshKeyB}
                    src={fullUrlB}
                    title="Página B (Implementação)"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    className="size-full border-0"
                  />
                </div>

                {/* ------------------------------------------------------------ */}
                {/*  DRAGGABLE SPLIT CURTAIN HANDLE (when mode === 'split')      */}
                {/* ------------------------------------------------------------ */}
                {mode === 'split' && (
                  <div
                    onPointerDown={handleSplitPointerDown}
                    style={{ left: `${splitPos}%` }}
                    className="absolute top-0 bottom-0 z-40 -ml-2.5 w-5 cursor-col-resize flex items-center justify-center group"
                  >
                    <div className="h-full w-0.5 bg-neon-400 shadow-[0_0_12px_rgba(20,241,149,0.8)]" />
                    <div className="absolute top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-ink-900 border-2 border-neon-400 text-neon-300 shadow-xl group-hover:scale-110 transition-transform">
                      <SplitSquareVertical size={13} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================================================================ */
            /*  SIDE-BY-SIDE OR FULL FOCUS MODES                                */
            /* ================================================================ */
            <div className="relative flex min-h-0 flex-1 gap-2.5 overflow-hidden">
              {/* Frame A */}
              {(mode === 'side' || mode === 'focus-a') && (
                <div
                  className={cn(
                    'relative flex flex-1 flex-col rounded-2xl border bg-ink-900 shadow-2xl overflow-hidden transition-all',
                    activeTarget === 'a' || activeTarget === 'both'
                      ? 'border-iris-500/60 ring-2 ring-iris-500/40 shadow-[0_0_24px_rgba(99,84,240,0.25)]'
                      : 'border-white/[0.08] opacity-90',
                  )}
                >
                  {/* Header A */}
                  <div className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-500/70" />
                        <span className="size-2.5 rounded-full bg-yellow-500/70" />
                        <span className="size-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <span className="rounded bg-iris-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-iris-300">
                        A: REFERÊNCIA
                      </span>
                    </div>

                    <div className="flex flex-1 max-w-sm items-center mx-2 rounded bg-black/50 px-2 py-0.5 ring-1 ring-white/10">
                      <span className="truncate font-mono text-[10.5px] text-ink-400 select-none mr-1">
                        {parsedA.origin}
                      </span>
                      <input
                        type="text"
                        value={pathA}
                        onChange={(e) => setPathA(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateDesignSettings({ url: `${parsedA.origin}${pathA}` })
                            setRefreshKeyA((k) => k + 1)
                          }
                        }}
                        className="w-full bg-transparent font-mono text-[11px] text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRefreshKeyA((k) => k + 1)}
                        className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                      >
                        <RefreshCw size={11} />
                      </button>
                      <a
                        href={fullUrlA}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  <div className="relative flex-1 bg-white">
                    <iframe
                      id="live-frame-a"
                      key={refreshKeyA}
                      src={fullUrlA}
                      title="Página A (Referência)"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                      className="size-full border-0"
                    />
                    {activeTarget === 'b' && (
                      <div
                        onClick={() => setActiveTarget('a')}
                        title="Clique para mexer na Página A"
                        className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-ink-950/30 hover:bg-ink-950/10 transition-all"
                      >
                        <div className="glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] text-ink-100 shadow-md">
                          <span className="size-2 rounded-full bg-iris-400" />
                          <span>Clique para mexer na Página A</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Frame B */}
              {(mode === 'side' || mode === 'focus-b') && (
                <div
                  className={cn(
                    'relative flex flex-1 flex-col rounded-2xl border bg-ink-900 shadow-2xl overflow-hidden transition-all',
                    activeTarget === 'b' || activeTarget === 'both'
                      ? 'border-neon-500/60 ring-2 ring-neon-500/40 shadow-[0_0_24px_rgba(20,241,149,0.25)]'
                      : 'border-white/[0.08] opacity-90',
                  )}
                >
                  {/* Header B */}
                  <div className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-500/70" />
                        <span className="size-2.5 rounded-full bg-yellow-500/70" />
                        <span className="size-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <span className="rounded bg-neon-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-neon-300">
                        B: LOCALHOST
                      </span>
                    </div>

                    <div className="flex flex-1 max-w-sm items-center mx-2 rounded bg-black/50 px-2 py-0.5 ring-1 ring-white/10">
                      <span className="truncate font-mono text-[10.5px] text-ink-400 select-none mr-1">
                        {parsedB.origin}
                      </span>
                      <input
                        type="text"
                        value={pathB}
                        onChange={(e) => setPathB(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateImplSettings({ url: `${parsedB.origin}${pathB}` })
                            setRefreshKeyB((k) => k + 1)
                          }
                        }}
                        className="w-full bg-transparent font-mono text-[11px] text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRefreshKeyB((k) => k + 1)}
                        className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                      >
                        <RefreshCw size={11} />
                      </button>
                      <a
                        href={fullUrlB}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  <div className="relative flex-1 bg-white">
                    <iframe
                      id="live-frame-b"
                      key={refreshKeyB}
                      src={fullUrlB}
                      title="Página B (Implementação)"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                      className="size-full border-0"
                    />
                    {activeTarget === 'a' && (
                      <div
                        onClick={() => setActiveTarget('b')}
                        title="Clique para mexer no Localhost (Página B)"
                        className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-ink-950/30 hover:bg-ink-950/10 transition-all"
                      >
                        <div className="glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] text-ink-100 shadow-md">
                          <span className="size-2 rounded-full bg-neon-400" />
                          <span>Clique para mexer no Localhost</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Helper Banner at Bottom */}
      <div className="z-10 flex items-center justify-between border-t border-white/[0.06] bg-ink-950/90 px-4 py-1.5 text-[11px] text-ink-400">
        <div className="flex items-center gap-2">
          <span className="text-iris-400">💡 Comparação ao Vivo:</span>
          <span>
            Use os botões de modo acima (<strong className="text-white">Cortina, Onion Skin, Blink</strong>) para comparar as páginas sobrepostas uma em cima da outra.
            Você pode escolher em qual mexer a qualquer momento com <Kbd>Alt+A</Kbd> ou <Kbd>Alt+B</Kbd>!
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Atalhos: <Kbd>Espaço</Kbd> Blink · <Kbd>Alt+A</Kbd> Mexer em A · <Kbd>Alt+B</Kbd> Mexer em B · <Kbd>Alt+S</Kbd> Sincronizar
          </span>
        </div>
      </div>
    </div>
  )
}
