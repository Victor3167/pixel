import {
  ArrowDown,
  ArrowUp,
  Camera,
  Columns2,
  Compass,
  ExternalLink,
  KeyRound,
  Layers,
  Lock,
  MousePointer,
  MoveVertical,
  RefreshCw,
  SplitSquareVertical,
  Unlock,
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
  const [activeTarget, setActiveTarget] = useState<ActiveControlTarget>('both')
  // Comparison layout ("um em cima do outro para usar as funcionalidades de comparação")
  const [mode, setMode] = useState<LiveComparisonMode>('split')
  const [devicePreset, setDevicePreset] = useState<DevicePreset>('fluid')

  // Synchronized scrolling engine ("os dois lados tem que acompanhar")
  const [syncScroll, setSyncScroll] = useState<boolean>(true)
  const [scrollY, setScrollY] = useState<number>(0)
  const [offsetY, setOffsetY] = useState<number>(0) // Sub-pixel / calibration offset for Page B
  const [virtualHeight, setVirtualHeight] = useState<number>(18000) // Default 18,000px to cover long e-commerce pages
  const [containerHeight, setContainerHeight] = useState<number>(850)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || 850)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // In side-by-side mode, columns are ~50% narrower so content wraps and can be up to 2x taller
  const effectiveVirtualHeight = mode === 'side' ? Math.max(virtualHeight, 22000) : virtualHeight
  const maxScroll = Math.max(0, effectiveVirtualHeight - containerHeight)

  // Wheel sync overlay toggle
  const [wheelCaptureMode, setWheelCaptureMode] = useState<boolean>(false)

  // Onion skin controls
  const [onionOpacity, setOnionOpacity] = useState<number>(0.5)
  const [blendDifference, setBlendDifference] = useState<boolean>(false)

  // Blink mode controls
  const [blinkShowsDesign, setBlinkShowsDesign] = useState<boolean>(false)

  // Split curtain controls
  const [splitPos, setSplitPos] = useState<number>(50) // percentage (0 - 100)
  const isDraggingSplit = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Master scrollbar dragging
  const isDraggingScrollbar = useRef(false)
  const scrollbarTrackRef = useRef<HTMLDivElement>(null)

  // Parsed URLs & current paths
  const parsedA = useMemo(
    () => parseUrl(designSettings.url, 'http://cerealista-design.43.153.43.193.sslip.io'),
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

  /* -------------------------- Synchronized Scroll -------------------------- */
  const changeScroll = useCallback(
    (delta: number) => {
      setScrollY((prev) => {
        const next = Math.max(0, prev + delta)
        // Auto-expand virtual height if user scrolls near or beyond current bottom
        if (next + 1500 > effectiveVirtualHeight) {
          const expanded = Math.min(80000, effectiveVirtualHeight + 6000)
          setVirtualHeight(expanded)
          const newMax = Math.max(0, expanded - containerHeight)
          return Math.min(newMax, next)
        }
        return Math.min(maxScroll, next)
      })
    },
    [maxScroll, effectiveVirtualHeight, containerHeight],
  )

  const scrollToPercent = useCallback(
    (pct: number) => {
      setScrollY(Math.round(maxScroll * pct))
    },
    [maxScroll],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!syncScroll) return
      e.preventDefault()
      changeScroll(e.deltaY * 0.85)
    },
    [syncScroll, changeScroll],
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
      setScrollY(0) // Reset scroll so both start at top
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
      setScrollY(0) // Reset scroll so both align at top
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

  /* -------------------------- Keyboard Navigation -------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Spacebar for Blink mode
      if (e.code === 'Space' && mode === 'blink') {
        e.preventDefault()
        if (!e.repeat) setBlinkShowsDesign(true)
        return
      }

      // Arrow keys / PageUp / PageDown for synchronized scrolling
      if (syncScroll) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          changeScroll(60)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          changeScroll(-60)
          return
        }
        if (e.key === 'PageDown') {
          e.preventDefault()
          changeScroll(400)
          return
        }
        if (e.key === 'PageUp') {
          e.preventDefault()
          changeScroll(-400)
          return
        }
        if (e.key === 'Home') {
          e.preventDefault()
          setScrollY(0)
          return
        }
        if (e.key === 'End') {
          e.preventDefault()
          setScrollY(maxScroll)
          return
        }
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
  }, [mode, syncScroll, maxScroll, changeScroll, handleSyncLocation, onAddToast])

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

  /* -------------------------- Master Scrollbar Drag ------------------------- */
  const handleScrollbarMove = useCallback(
    (e: React.PointerEvent) => {
      if (!scrollbarTrackRef.current) return
      if (!isDraggingScrollbar.current && e.buttons === 0) return
      const rect = scrollbarTrackRef.current.getBoundingClientRect()
      const relativeY = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
      const pct = relativeY / rect.height
      setScrollY(Math.round(maxScroll * pct))
    },
    [maxScroll],
  )

  const handleScrollbarPointerDown = (e: React.PointerEvent) => {
    isDraggingScrollbar.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    handleScrollbarMove(e)
  }

  const handleScrollbarPointerUp = () => {
    isDraggingScrollbar.current = false
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
  const scrollPct = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ink-950 font-sans text-ink-100 select-none">
      {/* ==================================================================== */}
      {/*  Unified Single Live Control Bar                                     */}
      {/* ==================================================================== */}
      <div
        onWheel={handleWheel}
        className="z-30 flex h-11 shrink-0 items-center justify-between gap-2.5 border-b border-white/[0.08] bg-ink-950/95 px-3 backdrop-blur-md select-none overflow-x-auto scroll-thin"
      >
        {/* Left: Comparison Mode + Target Selector */}
        <div className="flex items-center gap-2">
          {/* Comparison Mode Selector */}
          <div className="flex items-center rounded-lg bg-black/50 p-0.5 ring-1 ring-white/10" role="group" aria-label="Modos de comparação ao vivo">
            <button
              type="button"
              id="live-mode-split"
              onClick={() => setMode('split')}
              title="Cortina Divisória: Páginas sobrepostas com divisor deslizante"
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-all duration-150',
                mode === 'split' ? 'bg-iris-500 text-white shadow-sm font-semibold' : 'text-ink-300 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <SplitSquareVertical size={13} />
              <span>Cortina</span>
            </button>

            <button
              type="button"
              id="live-mode-side"
              onClick={() => setMode('side')}
              title="Lado a Lado: Ambas as páginas em paralelo"
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-all duration-150',
                mode === 'side' ? 'bg-iris-500 text-white shadow-sm font-semibold' : 'text-ink-300 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Columns2 size={13} />
              <span>Lado a Lado</span>
            </button>

            <button
              type="button"
              id="live-mode-onion"
              onClick={() => setMode('onion')}
              title="Onion Skin: Páginas sobrepostas com transparência"
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-all duration-150',
                mode === 'onion' ? 'bg-iris-500 text-white shadow-sm font-semibold' : 'text-ink-300 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Layers size={13} />
              <span>Onion</span>
            </button>

            <button
              type="button"
              id="live-mode-blink"
              onClick={() => setMode('blink')}
              title="Blink: Segure espaço para alternar entre as duas páginas"
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-all duration-150',
                mode === 'blink' ? 'bg-iris-500 text-white shadow-sm font-semibold' : 'text-ink-300 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Zap size={13} />
              <span>Blink</span>
            </button>
          </div>

          <span className="h-4 w-px bg-white/10" />

          {/* Interactive Target: Ambas | A | B */}
          <div className="flex items-center rounded-lg bg-black/50 p-0.5 ring-1 ring-white/10" role="group" aria-label="Página para interagir">
            <span className="px-1.5 text-[10.5px] font-medium text-ink-400">Interagir:</span>
            <button
              type="button"
              id="control-target-both"
              onClick={() => setActiveTarget('both')}
              title="Interagir com ambas as páginas simultaneamente"
              className={cn(
                'flex h-6.5 items-center rounded px-2 text-[11px] font-medium transition-all duration-150',
                activeTarget === 'both'
                  ? 'bg-gradient-to-r from-iris-500 to-neon-500 text-white font-semibold shadow-xs'
                  : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              Ambas
            </button>
            <button
              type="button"
              id="control-target-a"
              onClick={() => setActiveTarget('a')}
              title="Interagir na Página A (Referência)"
              className={cn(
                'flex h-6.5 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all duration-150',
                activeTarget === 'a'
                  ? 'bg-iris-500 text-white font-semibold shadow-xs'
                  : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <span className="size-1.5 rounded-full bg-iris-300" />
              <span>A</span>
            </button>
            <button
              type="button"
              id="control-target-b"
              onClick={() => setActiveTarget('b')}
              title="Interagir na Página B (Localhost)"
              className={cn(
                'flex h-6.5 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all duration-150',
                activeTarget === 'b'
                  ? 'bg-neon-500 text-black font-semibold shadow-xs'
                  : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <span className="size-1.5 rounded-full bg-black" />
              <span>B</span>
            </button>
          </div>
        </div>

        {/* Center: Synchronized Route Navigator */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-black/60 px-2 py-0.5 ring-1 ring-white/10">
            <Compass size={12} className="text-neon-400 mr-1.5 shrink-0" />
            <span className="font-mono text-ink-500 mr-0.5 text-[11px]">/</span>
            <input
              type="text"
              value={sharedRouteInput.startsWith('/') ? sharedRouteInput.slice(1) : sharedRouteInput}
              onChange={(e) => setSharedRouteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNavigateBoth(sharedRouteInput)
                }
              }}
              placeholder="rota (ex: produtos)..."
              className="w-28 md:w-40 bg-transparent font-mono text-[11px] text-white placeholder-ink-500 outline-none"
            />
            <button
              type="button"
              onClick={() => handleNavigateBoth(sharedRouteInput)}
              className="ml-1 rounded bg-neon-500/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-300 hover:bg-neon-500/30 transition-colors"
            >
              Ir
            </button>
          </div>

          {/* Quick Route Chips */}
          <div className="hidden sm:flex items-center gap-1">
            {COMMON_ROUTES.slice(0, 4).map((route) => (
              <button
                key={route.path}
                type="button"
                onClick={() => handleNavigateBoth(route.path)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10.5px] transition-all',
                  pathA === route.path && pathB === route.path
                    ? 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-500/40 font-semibold'
                    : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {route.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            id="quick-login-option-a"
            onClick={handleAutoLoginOptionA}
            title="Injeta token de autenticação na Opção A para acessar o protótipo"
            className="flex h-6.5 items-center gap-1 rounded-md border border-iris-500/30 bg-iris-500/10 px-2 text-[10.5px] font-medium text-iris-200 hover:bg-iris-500/20 hover:text-white transition-all"
          >
            <KeyRound size={11} className="text-iris-400" />
            <span className="hidden xl:inline">Login A</span>
          </button>
        </div>

        {/* Right: Contextual Controls & Device Preset & Capture CTA */}
        <div className="flex items-center gap-2">
          {/* Mode Contextual Controls */}
          {mode === 'split' && (
            <button
              type="button"
              onClick={() => setSplitPos(50)}
              title="Centralizar divisor em 50%"
              className="hidden md:inline-flex rounded bg-white/10 px-2 py-0.5 text-[10px] text-ink-200 hover:bg-white/20 hover:text-white"
            >
              Centralizar 50%
            </button>
          )}

          {mode === 'onion' && (
            <div className="hidden md:flex items-center gap-2 text-[10.5px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={onionOpacity}
                onChange={(e) => setOnionOpacity(Number(e.target.value))}
                className="h-1.5 w-16 accent-iris-500 cursor-pointer"
              />
              <span className="font-mono text-white text-[10px]">{Math.round(onionOpacity * 100)}%</span>
              <Toggle id="live-blend-diff" checked={blendDifference} onChange={setBlendDifference} label="Diferença" />
            </div>
          )}

          {mode === 'blink' && (
            <div className="hidden md:flex items-center gap-1.5 text-[10.5px]">
              <span className="text-ink-400">Segure <Kbd>Espaço</Kbd></span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase transition-colors',
                  blinkShowsDesign ? 'bg-iris-500 text-white' : 'bg-neon-500 text-black',
                )}
              >
                {blinkShowsDesign ? 'A: Referência' : 'B: Localhost'}
              </span>
            </div>
          )}

          {/* Sub-pixel Calibration Offset Y */}
          <div className="hidden xl:flex items-center gap-1 rounded bg-black/40 px-1 py-0.5 ring-1 ring-white/10">
            <span className="text-[10px] text-ink-400 px-0.5">Offset B:</span>
            <button
              type="button"
              onClick={() => setOffsetY((y) => y - 5)}
              title="Subir Página B em 5px"
              className="rounded px-1 text-ink-300 hover:bg-white/10 hover:text-white text-[10px]"
            >
              -5
            </button>
            <span className="font-mono text-[10px] text-iris-300 px-0.5">
              {offsetY > 0 ? `+${offsetY}` : offsetY}px
            </span>
            <button
              type="button"
              onClick={() => setOffsetY((y) => y + 5)}
              title="Descer Página B em 5px"
              className="rounded px-1 text-ink-300 hover:bg-white/10 hover:text-white text-[10px]"
            >
              +5
            </button>
            {offsetY !== 0 && (
              <button
                type="button"
                onClick={() => setOffsetY(0)}
                title="Zerar calibração"
                className="text-ink-400 hover:text-white text-[9px] px-0.5"
              >
                0
              </button>
            )}
          </div>

          {/* Sync Scroll Toggle */}
          <button
            type="button"
            id="toggle-sync-scroll-btn"
            onClick={() => setSyncScroll((s) => !s)}
            title={syncScroll ? 'Rolagem sincronizada ativa (ambos acompanham juntos)' : 'Rolagem desincronizada'}
            className={cn(
              'flex h-7 items-center gap-1 rounded-md px-2 text-[10.5px] font-medium transition-all',
              syncScroll
                ? 'bg-neon-500/15 text-neon-300 ring-1 ring-neon-500/40'
                : 'bg-white/5 text-ink-400 hover:text-white',
            )}
          >
            {syncScroll ? <Lock size={11} className="text-neon-400" /> : <Unlock size={11} />}
            <span className="hidden xl:inline">{syncScroll ? 'Sincronizado' : 'Livre'}</span>
          </button>

          {/* Wheel Mode Toggle */}
          <button
            type="button"
            onClick={() => setWheelCaptureMode((w) => !w)}
            title={
              wheelCaptureMode
                ? 'Modo Rolar Ativo: a roda do mouse rola ambas as telas em qualquer posição'
                : 'Modo Clicar: o mouse clica e navega na página'
            }
            className={cn(
              'flex h-7 items-center gap-1 rounded-md px-2 text-[10.5px] font-medium transition-all',
              wheelCaptureMode
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                : 'bg-white/5 text-ink-400 hover:text-white',
            )}
          >
            {wheelCaptureMode ? <MoveVertical size={11} /> : <MousePointer size={11} />}
            <span className="hidden xl:inline">{wheelCaptureMode ? 'Rolar' : 'Clicar'}</span>
          </button>

          {/* Device Width Presets */}
          <div className="hidden lg:flex items-center rounded-lg bg-black/40 p-0.5 ring-1 ring-white/10">
            {(
              [
                { id: 'fluid', label: 'Fluido' },
                { id: '1440', label: '1440' },
                { id: '1280', label: '1280' },
                { id: '768', label: '768' },
                { id: '390', label: '390' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDevicePreset(preset.id)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  devicePreset === preset.id
                    ? 'bg-iris-500 text-white font-bold'
                    : 'text-ink-400 hover:text-white hover:bg-white/5',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Virtual Height Presets & Steppers */}
          <div className="hidden xl:flex items-center rounded-lg bg-black/40 p-0.5 ring-1 ring-white/10" title="Altura do conteúdo para rolagem sincronizada">
            <span className="px-1 text-[9.5px] text-ink-400">Altura:</span>
            {[8000, 14000, 20000, 30000].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setVirtualHeight(h)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9.5px] font-mono transition-colors',
                  virtualHeight === h
                    ? 'bg-neon-500/20 text-neon-300 font-bold ring-1 ring-neon-500/40'
                    : 'text-ink-400 hover:text-white hover:bg-white/5',
                )}
              >
                {h / 1000}k
              </button>
            ))}
            <button
              type="button"
              onClick={() => setVirtualHeight((h) => Math.min(80000, h + 5000))}
              title="Aumentar altura em +5000px"
              className="rounded px-1.5 py-0.5 text-[9.5px] text-ink-300 hover:text-white hover:bg-white/10 font-bold"
            >
              +5k
            </button>
          </div>

          {/* Snapshot Capture Button */}
          <Button
            id="capture-live-both-btn"
            variant="neon"
            size="sm"
            onClick={onCaptureBoth}
            loading={capturingBoth}
            icon={<Camera size={12} className="text-black" />}
            title="Capturar telas e analisar no Pixel Diff e Gemini IA"
            className="font-bold shadow-[0_0_16px_rgba(20,241,149,0.3)] h-7 text-[11px]"
          >
            {capturingBoth ? 'Capturando…' : '📸 Capturar para Diff'}
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/*  Live Viewport (Stacked or Side-by-Side)                             */}
      {/* ==================================================================== */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative flex min-h-0 flex-1 overflow-hidden p-2.5 bg-ink-950 gap-2"
      >
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
                'relative flex-1 overflow-hidden rounded-2xl border bg-black shadow-2xl',
                activeTarget === 'a'
                  ? 'border-iris-500/50 ring-2 ring-iris-500/30'
                  : activeTarget === 'b'
                    ? 'border-neon-500/50 ring-2 ring-neon-500/30'
                    : 'border-white/10',
              )}
            >
              {/* Common Window Header for Stacked Mode */}
              <div
                onWheel={handleWheel}
                className="absolute top-0 inset-x-0 z-40 flex h-9 items-center justify-between border-b border-white/[0.08] bg-ink-900/90 px-3 backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500/70" />
                    <span className="size-2.5 rounded-full bg-yellow-500/70" />
                    <span className="size-2.5 rounded-full bg-green-500/70" />
                  </div>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {mode === 'split' && 'CORTINA AO VIVO SINCRONIZADA'}
                    {mode === 'onion' && 'ONION SKIN AO VIVO SINCRONIZADO'}
                    {mode === 'blink' && 'BLINK AO VIVO SINCRONIZADO'}
                  </span>
                </div>

                {/* Live URL displays */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-iris-300 truncate max-w-xs">
                    A: {parsedA.origin}
                    {pathA}
                  </span>
                  <span className="text-white/20">|</span>
                  <span className="font-mono text-[11px] text-neon-300 truncate max-w-xs">
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

              {/* Stacked Frames Container with Synchronized Scroll Offset */}
              <div className="absolute inset-0 top-9 bg-white overflow-hidden">
                {/* ------------------------------------------------------------ */}
                {/*  FRAME A (Reference - Left side of curtain)                  */}
                {/* ------------------------------------------------------------ */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: syncScroll ? `${effectiveVirtualHeight}px` : '100%',
                    transform: syncScroll ? `translateY(-${scrollY}px)` : undefined,
                    zIndex:
                      mode === 'blink'
                        ? blinkShowsDesign
                          ? 20
                          : 5
                        : mode === 'split'
                          ? 10
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
                    clipPath: mode === 'split' ? `inset(0 ${100 - splitPos}% 0 0)` : undefined,
                    pointerEvents:
                      mode === 'split'
                        ? 'auto'
                        : activeTarget === 'a' || activeTarget === 'both'
                          ? 'auto'
                          : 'none',
                  }}
                  className="transition-[opacity] duration-75"
                >
                  <iframe
                    id="live-frame-a"
                    key={refreshKeyA}
                    src={fullUrlA}
                    title="Página A (Referência)"
                    scrolling={syncScroll ? 'no' : 'auto'}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    className="size-full border-0"
                  />
                </div>

                {/* ------------------------------------------------------------ */}
                {/*  FRAME B (Localhost / Right side of curtain)                 */}
                {/* ------------------------------------------------------------ */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: syncScroll ? `${effectiveVirtualHeight}px` : '100%',
                    transform: syncScroll ? `translateY(-${scrollY + offsetY}px)` : undefined,
                    zIndex:
                      mode === 'blink'
                        ? blinkShowsDesign
                          ? 5
                          : 20
                        : mode === 'split'
                          ? 15
                          : activeTarget === 'b'
                            ? 20
                            : 10,
                    opacity: mode === 'blink' ? (blinkShowsDesign ? 0 : 1) : 1,
                    clipPath: mode === 'split' ? `inset(0 0 0 ${splitPos}%)` : undefined,
                    pointerEvents:
                      mode === 'split'
                        ? 'auto'
                        : activeTarget === 'b' || activeTarget === 'both'
                          ? 'auto'
                          : 'none',
                  }}
                  className="transition-[opacity] duration-75"
                >
                  <iframe
                    id="live-frame-b"
                    key={refreshKeyB}
                    src={fullUrlB}
                    title="Página B (Implementação)"
                    scrolling={syncScroll ? 'no' : 'auto'}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    className="size-full border-0"
                  />
                </div>

                {/* ------------------------------------------------------------ */}
                {/*  WHEEL CAPTURE OVERLAY (When user wants wheel everywhere)    */}
                {/* ------------------------------------------------------------ */}
                {wheelCaptureMode && (
                  <div
                    onWheel={handleWheel}
                    title="Modo Rolar Ativo: Use a roda do mouse para rolar ambas as telas juntas"
                    className="absolute inset-0 z-35 cursor-ns-resize bg-black/10"
                  />
                )}

                {/* ------------------------------------------------------------ */}
                {/*  DRAGGABLE SPLIT CURTAIN HANDLE (when mode === 'split')      */}
                {/* ------------------------------------------------------------ */}
                {mode === 'split' && (
                  <div
                    onPointerDown={handleSplitPointerDown}
                    onWheel={handleWheel}
                    style={{ left: `${splitPos}%` }}
                    className="absolute top-0 bottom-0 z-40 -ml-3 w-6 cursor-col-resize flex items-center justify-center group"
                  >
                    <div className="h-full w-0.5 bg-neon-400 shadow-[0_0_12px_rgba(20,241,149,0.9)]" />
                    <div className="absolute top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-ink-900 border-2 border-neon-400 text-neon-300 shadow-2xl group-hover:scale-115 transition-transform">
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
                  <div
                    onWheel={handleWheel}
                    className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3"
                  >
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

                  <div className="relative flex-1 bg-white overflow-hidden">
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: syncScroll ? `${effectiveVirtualHeight}px` : '100%',
                        transform: syncScroll ? `translateY(-${scrollY}px)` : undefined,
                      }}
                    >
                      <iframe
                        id="live-frame-a"
                        key={refreshKeyA}
                        src={fullUrlA}
                        title="Página A (Referência)"
                        scrolling={syncScroll ? 'no' : 'auto'}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                        className="size-full border-0"
                      />
                    </div>
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
                  <div
                    onWheel={handleWheel}
                    className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3"
                  >
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

                  <div className="relative flex-1 bg-white overflow-hidden">
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: syncScroll ? `${effectiveVirtualHeight}px` : '100%',
                        transform: syncScroll ? `translateY(-${scrollY + offsetY}px)` : undefined,
                      }}
                    >
                      <iframe
                        id="live-frame-b"
                        key={refreshKeyB}
                        src={fullUrlB}
                        title="Página B (Implementação)"
                        scrolling={syncScroll ? 'no' : 'auto'}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                        className="size-full border-0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/*  MASTER UNIFIED SYNCHRONIZED SCROLLBAR (Right strip)                */}
        {/* ==================================================================== */}
        {syncScroll && (
          <div
            onWheel={handleWheel}
            className="flex w-9 shrink-0 flex-col items-center justify-between rounded-xl border border-white/[0.08] bg-ink-900/90 py-2 backdrop-blur-md shadow-xl"
          >
            <button
              type="button"
              onClick={() => setScrollY(0)}
              title="Ir para o Topo (0px)"
              className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
            >
              <ArrowUp size={12} />
            </button>

            {/* Draggable Vertical Track */}
            <div
              ref={scrollbarTrackRef}
              onPointerDown={handleScrollbarPointerDown}
              onPointerMove={handleScrollbarMove}
              onPointerUp={handleScrollbarPointerUp}
              className="relative my-2 w-2 flex-1 cursor-pointer rounded-full bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
            >
              {/* Draggable Thumb */}
              <div
                style={{
                  top: `${Math.min(92, Math.max(0, scrollPct * 0.92))}%`,
                  height: '24px',
                }}
                className="absolute inset-x-0 rounded-full bg-neon-400 shadow-[0_0_10px_rgba(20,241,149,0.8)]"
              />
            </div>

            <button
              type="button"
              onClick={() => changeScroll(400)}
              title="Descer 400px"
              className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
            >
              <ArrowDown size={12} />
            </button>

            {/* Vertical Scroll Percentage Button */}
            <button
              type="button"
              onClick={() => scrollToPercent(scrollPct >= 95 ? 0 : (scrollPct + 25) / 100)}
              title="Clique para rolar 25%"
              className="mt-1 font-mono text-[9px] text-ink-400 hover:text-white -rotate-90 select-none"
            >
              {Math.round(scrollPct)}%
            </button>

            {/* Jump directly to End of page */}
            <button
              type="button"
              onClick={() => setScrollY(maxScroll)}
              title="Rolar direto para o Fim da Página (Rodapé)"
              className="mt-1 rounded px-1 py-0.5 text-[8.5px] font-bold text-ink-400 hover:text-white hover:bg-white/10"
            >
              Fim
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
