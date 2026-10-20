import {
  ArrowRight,
  Camera,
  Columns2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  SplitSquareVertical,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaptureSettings } from '../../types/audit'
import { cn } from '../../utils/cn'
import { Button, Kbd } from '../ui'

export type ActiveControlTarget = 'a' | 'b' | 'both'
export type LiveLayoutMode = 'side' | 'focus-a' | 'focus-b' | 'split'
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
      path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
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
  const [activeTarget, setActiveTarget] = useState<ActiveControlTarget>('both')
  const [layoutMode, setLayoutMode] = useState<LiveLayoutMode>('side')
  const [devicePreset, setDevicePreset] = useState<DevicePreset>('fluid')
  const [splitPos, setSplitPos] = useState<number>(50) // percentage for split view

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

  // Dragging split bar
  const isDraggingSplit = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Full URLs for the iframes
  const fullUrlA = useMemo(() => `${parsedA.origin}${pathA.startsWith('/') ? '' : '/'}${pathA}`, [parsedA.origin, pathA])
  const fullUrlB = useMemo(() => `${parsedB.origin}${pathB.startsWith('/') ? '' : '/'}${pathB}`, [parsedB.origin, pathB])

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
      // Injects token into prototype's origin or current frame
      const frame = document.getElementById('live-frame-a') as HTMLIFrameElement | null
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.localStorage.setItem('loja-base-proto-auth', 'true')
        } catch {
          /* Cross-origin iframe localStorage handled via query/header or Playwright */
        }
      }
      // Also pass it into designSettings.localStorage for Playwright capture
      onUpdateDesignSettings({
        localStorage: {
          'loja-base-proto-auth': 'true',
        },
      })
      // Reload frame A with auth parameter or reload
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
      // Alt+A: focus A
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setActiveTarget('a')
        onAddToast('info', 'Controle ativo: Página A (Referência)')
      }
      // Alt+B: focus B
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setActiveTarget('b')
        onAddToast('info', 'Controle ativo: Página B (Implementação)')
      }
      // Alt+S: sync location
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSyncLocation()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSyncLocation, onAddToast])

  /* -------------------------- Split Drag Handlers -------------------------- */
  const handleSplitPointerDown = (e: React.PointerEvent) => {
    isDraggingSplit.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit.current || !splitContainerRef.current) return
    const rect = splitContainerRef.current.getBoundingClientRect()
    const pct = Math.min(90, Math.max(10, ((e.clientX - rect.left) / rect.width) * 100))
    setSplitPos(pct)
  }

  const handleSplitPointerUp = () => {
    isDraggingSplit.current = false
  }

  /* -------------------------- Width / Preset Calc -------------------------- */
  const frameWidthStyle = useMemo(() => {
    if (devicePreset === '1440') return { maxWidth: '1440px' }
    if (devicePreset === '1280') return { maxWidth: '1280px' }
    if (devicePreset === '768') return { maxWidth: '768px' }
    if (devicePreset === '390') return { maxWidth: '390px' }
    return { width: '100%' }
  }, [devicePreset])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ink-950 font-sans text-ink-100">
      {/* ==================================================================== */}
      {/*  Top Live Control Bar                                                */}
      {/* ==================================================================== */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.08] bg-ink-900/95 px-4 py-2.5 backdrop-blur-md">
        {/* Left: Active Page Selector ("Escolher qual página mexer") */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-ink-300 uppercase">
            Mexer na Página:
          </span>
          <div className="glass flex items-center rounded-xl p-0.5" role="group" aria-label="Active control target">
            <button
              type="button"
              id="control-target-a"
              onClick={() => setActiveTarget('a')}
              title="Interagir e navegar na Página A (Figma / Referência) [Alt+A]"
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
              title="Interagir e navegar na Página B (Implementação Localhost) [Alt+B]"
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

            <button
              type="button"
              id="control-target-both"
              onClick={() => setActiveTarget('both')}
              title="Interagir com ambas as páginas simultaneamente"
              className={cn(
                'flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-all duration-150',
                activeTarget === 'both'
                  ? 'bg-gradient-to-r from-iris-500 to-neon-500 text-white font-semibold shadow-md'
                  : 'text-ink-200 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <span>Ambas</span>
            </button>
          </div>
        </div>

        {/* Center: Sync Location Button & Shared Path */}
        <div className="flex flex-1 items-center justify-center gap-2 max-w-2xl">
          {/* Main Sync Location Button */}
          <Button
            id="sync-location-btn"
            variant="neon"
            size="sm"
            onClick={() => handleSyncLocation()}
            icon={<RefreshCw size={13} className="text-black" />}
            title="Sincronizar a localização/rota entre a página ativa e a outra [Alt+S]"
            className="font-semibold shadow-md hover:scale-[1.02]"
          >
            Sincronizar Localização
          </Button>

          {/* Directional shortcuts */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSyncLocation('a-to-b')}
              title="Copiar rota da Página A para B"
              className="flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] text-ink-200 hover:bg-white/[0.12] hover:text-white"
            >
              <span>A</span>
              <ArrowRight size={11} className="text-iris-400" />
              <span>B</span>
            </button>
            <button
              type="button"
              onClick={() => handleSyncLocation('b-to-a')}
              title="Copiar rota da Página B para A"
              className="flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] text-ink-200 hover:bg-white/[0.12] hover:text-white"
            >
              <span>B</span>
              <ArrowRight size={11} className="text-neon-400" />
              <span>A</span>
            </button>
          </div>

          {/* Quick Route Input Bar */}
          <div className="flex flex-1 items-center rounded-lg bg-black/40 ring-1 ring-white/10 px-2 py-0.5 focus-within:ring-iris-500/50">
            <span className="font-mono text-[11px] text-ink-400 select-none mr-1.5">Rota:</span>
            <input
              type="text"
              id="shared-route-input"
              value={sharedRouteInput}
              onChange={(e) => setSharedRouteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNavigateBoth(sharedRouteInput)
              }}
              placeholder="/produtos, /carrinho..."
              className="w-full bg-transparent font-mono text-[12px] text-white outline-none placeholder:text-ink-500"
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

        {/* Right: Quick Login helper & Snapshot to Diff */}
        <div className="flex items-center gap-2">
          {/* Quick Login button for Option A */}
          <button
            type="button"
            id="quick-login-option-a"
            onClick={handleAutoLoginOptionA}
            title="Injeta token de autenticação diretamente na Opção A para acessar o protótipo imediatamente"
            className="flex h-7.5 items-center gap-1.5 rounded-xl border border-iris-500/30 bg-iris-500/10 px-2.5 text-[11px] font-medium text-iris-200 hover:bg-iris-500/20 hover:text-white transition-all"
          >
            <KeyRound size={12} className="text-iris-400" />
            <span className="hidden xl:inline">Auto-Login A</span>
          </button>

          {/* Layout switch */}
          <div className="glass flex items-center rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setLayoutMode('side')}
              title="Lado a Lado (50/50)"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg transition-colors',
                layoutMode === 'side' ? 'bg-white/15 text-white' : 'text-ink-400 hover:text-white',
              )}
            >
              <Columns2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              title="Divisor Interativo (Split Curtain)"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg transition-colors',
                layoutMode === 'split' ? 'bg-white/15 text-white' : 'text-ink-400 hover:text-white',
              )}
            >
              <SplitSquareVertical size={13} />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('focus-a')}
              title="Foco em Tela Cheia na Página A (Referência)"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg transition-colors text-[10.5px] font-bold',
                layoutMode === 'focus-a' ? 'bg-iris-500/30 text-iris-300 ring-1 ring-iris-500/40' : 'text-ink-400 hover:text-white',
              )}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('focus-b')}
              title="Foco em Tela Cheia na Página B (Localhost)"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg transition-colors text-[10.5px] font-bold',
                layoutMode === 'focus-b' ? 'bg-neon-500/30 text-neon-300 ring-1 ring-neon-500/40' : 'text-ink-400 hover:text-white',
              )}
            >
              B
            </button>
          </div>

          {/* Viewport Width Device Presets */}
          <div className="hidden xl:flex items-center gap-1 rounded-xl bg-black/30 p-0.5 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setDevicePreset('fluid')}
              title="Largura Fluida (100%)"
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === 'fluid' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setDevicePreset('1440')}
              title="Desktop (1440px)"
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === '1440' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              1440
            </button>
            <button
              type="button"
              onClick={() => setDevicePreset('768')}
              title="Tablet (768px)"
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === '768' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              768
            </button>
            <button
              type="button"
              onClick={() => setDevicePreset('390')}
              title="Mobile (390px)"
              className={cn('rounded px-1.5 py-0.5 text-[10px]', devicePreset === '390' ? 'bg-white/15 text-white' : 'text-ink-400')}
            >
              390
            </button>
          </div>

          {/* Action: Snapshot current live pages into Diff */}
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
      {/*  Dual Live Browser Viewport                                          */}
      {/* ==================================================================== */}
      <div
        ref={splitContainerRef}
        onPointerMove={layoutMode === 'split' ? handleSplitPointerMove : undefined}
        onPointerUp={layoutMode === 'split' ? handleSplitPointerUp : undefined}
        className="relative flex min-h-0 flex-1 overflow-hidden p-2.5 gap-2.5 bg-ink-950/70"
      >
        {/* Frame A: Reference / Design (lojasilvasalesdesign.bisws.com.br) */}
        {(layoutMode === 'side' || layoutMode === 'split' || layoutMode === 'focus-a') && (
          <div
            style={
              layoutMode === 'split'
                ? { width: `${splitPos}%`, ...frameWidthStyle }
                : layoutMode === 'focus-a'
                  ? { width: '100%', ...frameWidthStyle }
                  : { flex: 1, ...frameWidthStyle }
            }
            className={cn(
              'relative flex flex-col rounded-2xl border bg-ink-900 shadow-2xl transition-all duration-150 overflow-hidden',
              activeTarget === 'a' || activeTarget === 'both'
                ? 'border-iris-500/60 ring-2 ring-iris-500/40 shadow-[0_0_28px_rgba(99,84,240,0.25)]'
                : 'border-white/[0.08] opacity-90',
            )}
          >
            {/* Browser Window Header A */}
            <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3">
              {/* Traffic lights & Label */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500/70" />
                  <span className="size-2.5 rounded-full bg-yellow-500/70" />
                  <span className="size-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="ml-1 rounded bg-iris-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-iris-300">
                  A: REFERÊNCIA
                </span>
                {activeTarget === 'a' && (
                  <span className="flex items-center gap-1 text-[10.5px] font-medium text-iris-400 animate-pulse">
                    ● Mexendo nesta
                  </span>
                )}
              </div>

              {/* Address bar A */}
              <div className="flex flex-1 max-w-lg items-center mx-3 rounded-lg bg-black/50 px-2 py-1 ring-1 ring-white/10">
                <span className="truncate font-mono text-[11px] text-ink-300 select-none mr-1">
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

              {/* Actions A */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRefreshKeyA((k) => k + 1)}
                  title="Recarregar Página A"
                  className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw size={12} />
                </button>
                <a
                  href={fullUrlA}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir Página A em nova aba"
                  className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* The Live Frame A */}
            <div className="relative flex-1 bg-white">
              <iframe
                id="live-frame-a"
                key={refreshKeyA}
                src={fullUrlA}
                title="Página A (Referência)"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                className="size-full border-0"
              />

              {/* Focus Overlay: If user is interacting only with B, show helper to switch */}
              {activeTarget === 'b' && (
                <div
                  onClick={() => {
                    setActiveTarget('a')
                    onAddToast('info', 'Controle alternado para Página A')
                  }}
                  title="Clique para mexer na Página A"
                  className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-ink-950/40 backdrop-blur-[1px] hover:bg-ink-950/20 transition-all group"
                >
                  <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-[12px] text-ink-100 shadow-xl group-hover:scale-105 transition-transform">
                    <span className="size-2 rounded-full bg-iris-400" />
                    <span>Clique para interagir com a Página A</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Draggable Split Handle (when layoutMode === 'split') */}
        {layoutMode === 'split' && (
          <div
            onPointerDown={handleSplitPointerDown}
            className="group relative z-30 flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-neon-500/40 rounded transition-colors"
          >
            <div className="h-14 w-1 rounded-full bg-white/40 group-hover:bg-neon-400 shadow-md" />
          </div>
        )}

        {/* Frame B: Implementation / Localhost (http://localhost:3000) */}
        {(layoutMode === 'side' || layoutMode === 'split' || layoutMode === 'focus-b') && (
          <div
            style={
              layoutMode === 'split'
                ? { width: `${100 - splitPos}%`, ...frameWidthStyle }
                : layoutMode === 'focus-b'
                  ? { width: '100%', ...frameWidthStyle }
                  : { flex: 1, ...frameWidthStyle }
            }
            className={cn(
              'relative flex flex-col rounded-2xl border bg-ink-900 shadow-2xl transition-all duration-150 overflow-hidden',
              activeTarget === 'b' || activeTarget === 'both'
                ? 'border-neon-500/60 ring-2 ring-neon-500/40 shadow-[0_0_28px_rgba(20,241,149,0.25)]'
                : 'border-white/[0.08] opacity-90',
            )}
          >
            {/* Browser Window Header B */}
            <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-black/40 px-3">
              {/* Traffic lights & Label */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500/70" />
                  <span className="size-2.5 rounded-full bg-yellow-500/70" />
                  <span className="size-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="ml-1 rounded bg-neon-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-neon-300">
                  B: LOCALHOST
                </span>
                {activeTarget === 'b' && (
                  <span className="flex items-center gap-1 text-[10.5px] font-medium text-neon-400 animate-pulse">
                    ● Mexendo nesta
                  </span>
                )}
              </div>

              {/* Address bar B */}
              <div className="flex flex-1 max-w-lg items-center mx-3 rounded-lg bg-black/50 px-2 py-1 ring-1 ring-white/10">
                <span className="truncate font-mono text-[11px] text-ink-300 select-none mr-1">
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

              {/* Actions B */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRefreshKeyB((k) => k + 1)}
                  title="Recarregar Página B"
                  className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw size={12} />
                </button>
                <a
                  href={fullUrlB}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir Página B em nova aba"
                  className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* The Live Frame B */}
            <div className="relative flex-1 bg-white">
              <iframe
                id="live-frame-b"
                key={refreshKeyB}
                src={fullUrlB}
                title="Página B (Implementação)"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                className="size-full border-0"
              />

              {/* Focus Overlay: If user is interacting only with A, show helper to switch */}
              {activeTarget === 'a' && (
                <div
                  onClick={() => {
                    setActiveTarget('b')
                    onAddToast('info', 'Controle alternado para Página B')
                  }}
                  title="Clique para mexer no Localhost (Página B)"
                  className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-ink-950/40 backdrop-blur-[1px] hover:bg-ink-950/20 transition-all group"
                >
                  <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-[12px] text-ink-100 shadow-xl group-hover:scale-105 transition-transform">
                    <span className="size-2 rounded-full bg-neon-400" />
                    <span>Clique para interagir com o Localhost</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Helper Banner at Bottom */}
      <div className="z-10 flex items-center justify-between border-t border-white/[0.06] bg-ink-950/90 px-4 py-1.5 text-[11px] text-ink-400">
        <div className="flex items-center gap-2">
          <span className="text-iris-400">💡 Dica:</span>
          <span>
            Navegue e digite seu login na <strong>Página A</strong>. Quando estiver na tela desejada, clique em{' '}
            <strong className="text-white">"Sincronizar Localização"</strong> para igualar a rota no Localhost, depois em{' '}
            <strong className="text-neon-400">"📸 Capturar para Diff"</strong> para auditar visualmente!
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Atalhos: <Kbd>Alt+A</Kbd> focar A · <Kbd>Alt+B</Kbd> focar B · <Kbd>Alt+S</Kbd> sincronizar
          </span>
        </div>
      </div>
    </div>
  )
}
