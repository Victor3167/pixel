import { useCallback, useMemo, useState } from 'react'
import { AiControls } from './components/AiControls'
import { Header } from './components/Header'
import { IssuesPanel } from './components/IssuesPanel'
import { PromptPanel } from './components/PromptPanel'
import { RightPanel, type RightTab } from './components/RightPanel'
import { SourcePanel } from './components/SourcePanel'
import { Toasts, type Toast } from './components/Toasts'
import { Toolbar } from './components/Toolbar'
import { Viewport, type FocusRequest } from './components/viewport/Viewport'
import { useImageIntake, useShortcuts } from './hooks/useGlobalInput'
import type {
  AuditIssue,
  CaptureMeta,
  CaptureSettings,
  DesignScale,
  DiffBase,
  DiffResult,
  GeminiModel,
  InspectionMode,
  LoadedImage,
  PasteTarget,
  Point,
  Rect,
  RulerMeasurement,
  ToolMode,
  ViewState,
} from './types/audit'
import { downloadBlob, downloadText, renderAnnotatedComparison } from './utils/annotatedExport'
import { captureLocalhost } from './utils/captureClient'
import { resolveCaptureViewport } from './utils/captureParams'
import { crossReferenceRect, refreshIssueReferences, type CrossReferenceContext } from './utils/crossReference'
import { createDemoPair } from './utils/demo'
import { copyText } from './utils/dom'
import {
  MODEL_STORAGE,
  boxToPixels,
  describeGeminiError,
  hasEnvApiKey,
  normalizeCategory,
  normalizeSeverity,
  readStoredApiKey,
  resolveApiKey,
  runVisionAudit,
  writeStoredApiKey,
} from './utils/geminiVisionAudit'
import { disposeImage, loadImageFromBlob, loadImageFromUrl } from './utils/imageLoader'
import { buildDiffComposite, canvasToBase64Png, computeDiff, computeLayout, formatMatchScore, rasterizeLayer } from './utils/pixelDiff'
import { PixelSampler } from './utils/pixelSampler'
import { compilePrompt } from './utils/promptCompiler'

const INITIAL_DESIGN_CAPTURE_SETTINGS: CaptureSettings = {
  url: 'https://lojasilvasalesdesign.bisws.com.br',
  selector: '',
  waitForMs: 0,
  hideScrollbars: true,
  autoSync: false,
  manualWidth: 1280,
  manualHeight: 800,
  manualDeviceScaleFactor: 1,
}

const INITIAL_IMPL_CAPTURE_SETTINGS: CaptureSettings = {
  url: 'http://localhost:3000',
  selector: '',
  waitForMs: 0,
  hideScrollbars: true,
  autoSync: true,
  manualWidth: 1280,
  manualHeight: 800,
  manualDeviceScaleFactor: 1,
}

export default function App() {
  /* ------------------------------ Images & Source --------------------------- */
  const [design, setDesign] = useState<LoadedImage | null>(null)
  const [impl, setImpl] = useState<LoadedImage | null>(null)
  const [pasteTarget, setPasteTarget] = useState<PasteTarget>('design')
  const [designScale, setDesignScale] = useState<DesignScale>(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })

  /* ----------------------------- Inspection Modes --------------------------- */
  const [inspectionMode, setInspectionMode] = useState<InspectionMode>('diff')
  const [toolMode, setToolMode] = useState<ToolMode>('inspect')
  const [threshold, setThreshold] = useState<number>(0.1)
  const [includeAA, setIncludeAA] = useState<boolean>(false)
  const [diffBase, setDiffBase] = useState<DiffBase>('impl')
  const [onionOpacity, setOnionOpacity] = useState<number>(0.5)
  const [blendDifference, setBlendDifference] = useState<boolean>(false)
  const [blinkShowsDesign, setBlinkShowsDesign] = useState<boolean>(false)
  const [splitPos, setSplitPos] = useState<number>(0.5)

  /* ------------------------------- Viewport State --------------------------- */
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [fitSignal, setFitSignal] = useState<number>(0)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)

  /* ------------------------------- Capture State ---------------------------- */
  const [designCaptureSettings, setDesignCaptureSettings] = useState<CaptureSettings>(
    INITIAL_DESIGN_CAPTURE_SETTINGS,
  )
  const [capturingDesign, setCapturingDesign] = useState<boolean>(false)
  const [designMeta, setDesignMeta] = useState<CaptureMeta | null>(null)
  const [designCaptureError, setDesignCaptureError] = useState<string | null>(null)
  const [designCaptureWarnings, setDesignCaptureWarnings] = useState<string[]>([])

  const [implCaptureSettings, setImplCaptureSettings] = useState<CaptureSettings>(
    INITIAL_IMPL_CAPTURE_SETTINGS,
  )
  const [capturingImpl, setCapturingImpl] = useState<boolean>(false)
  const [implMeta, setImplMeta] = useState<CaptureMeta | null>(null)
  const [implCaptureError, setImplCaptureError] = useState<string | null>(null)
  const [implCaptureWarnings, setImplCaptureWarnings] = useState<string[]>([])

  const [capturingBoth, setCapturingBoth] = useState<boolean>(false)

  /* -------------------------------- AI Engine ------------------------------- */
  const [storedApiKey, setStoredApiKey] = useState<string>(() => readStoredApiKey())
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE)
      if (saved === 'gemini-3.5-flash' || saved === 'gemini-3.8-flash' || saved === 'gemini-flash-latest') return saved
    } catch {
      /* ignore */
    }
    return 'gemini-3.5-flash'
  })
  const [aiRunning, setAiRunning] = useState<boolean>(false)
  const [aiError, setAiError] = useState<string | null>(null)

  /* --------------------------- Annotations & Issues ------------------------- */
  const [issues, setIssues] = useState<AuditIssue[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [ruler, setRuler] = useState<RulerMeasurement | null>(null)

  /* ------------------------------ Right Sidebar ----------------------------- */
  const [rightTab, setRightTab] = useState<RightTab>('issues')
  const [projectName, setProjectName] = useState<string>('')
  const [extraContext, setExtraContext] = useState<string>('')

  /* --------------------------------- Toasts --------------------------------- */
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  /* -------------------------- Pixel Samplers & Layout ----------------------- */
  const designSampler = useMemo(() => (design ? new PixelSampler(design.element) : null), [design])
  const implSampler = useMemo(() => (impl ? new PixelSampler(impl.element) : null), [impl])
  const layout = useMemo(() => computeLayout(design, impl, offset), [design, impl, offset])

  const crossRefContext: CrossReferenceContext = useMemo(
    () => ({
      designSampler,
      implSampler,
      layout,
      meta: implMeta,
    }),
    [designSampler, implSampler, layout, implMeta],
  )

  // Dynamically cross-reference issues with live DOM and samplers
  const resolvedIssues = useMemo(
    () => refreshIssueReferences(issues, crossRefContext),
    [issues, crossRefContext],
  )

  /* ---------------------------- Pixelmatch Diff ----------------------------- */
  const diffResult = useMemo<DiffResult | null>(() => {
    if (!design || !impl) return null
    try {
      return computeDiff({
        design,
        impl,
        layout,
        threshold,
        includeAA,
      })
    } catch (err) {
      console.error('[pixel-audit] diff error:', err)
      return null
    }
  }, [design, impl, layout, threshold, includeAA])

  /* --------------------------- Resolved Viewport ---------------------------- */
  const resolvedViewport = useMemo(
    () => resolveCaptureViewport(implCaptureSettings, design, designScale),
    [implCaptureSettings, design, designScale],
  )

  /* ----------------------------- Clean Image Loaders ------------------------ */
  const loadDesignImage = useCallback((newImage: LoadedImage, meta: CaptureMeta | null = null) => {
    setDesign((prev) => {
      disposeImage(prev)
      return newImage
    })
    if (meta) setDesignMeta(meta)
    setPasteTarget('impl')
  }, [])

  const loadImplImage = useCallback(
    (newImage: LoadedImage, meta: CaptureMeta | null = null) => {
      setImpl((prev) => {
        disposeImage(prev)
        return newImage
      })
      if (meta) setImplMeta(meta)
    },
    [],
  )

  const handleDesignFile = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadImageFromBlob(file, file.name)
        loadDesignImage(loaded)
        setDesignMeta(null)
        addToast('success', `Design reference loaded: ${loaded.width}×${loaded.height}px`)
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Failed to load design image')
      }
    },
    [loadDesignImage, addToast],
  )

  const handleImplFile = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadImageFromBlob(file, file.name)
        loadImplImage(loaded, null)
        addToast('success', `Implementation screenshot loaded: ${loaded.width}×${loaded.height}px`)
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Failed to load implementation image')
      }
    },
    [loadImplImage, addToast],
  )

  const handleClearDesign = useCallback(() => {
    setDesign((prev) => {
      disposeImage(prev)
      return null
    })
    setDesignMeta(null)
  }, [])

  const handleClearImpl = useCallback(() => {
    setImpl((prev) => {
      disposeImage(prev)
      return null
    })
    setImplMeta(null)
  }, [])

  /* --------------------------- Automated Capture ---------------------------- */
  const runCaptureDesign = useCallback(async (): Promise<LoadedImage | null> => {
    if (capturingDesign) return null
    const url = designCaptureSettings.url.trim()
    if (!url) {
      setDesignCaptureError('Please enter a reference URL')
      return null
    }

    setCapturingDesign(true)
    setDesignCaptureError(null)
    setDesignCaptureWarnings([])

    try {
      const manualW = Number(designCaptureSettings.manualWidth)
      const manualH = Number(designCaptureSettings.manualHeight)
      const manualDsf = Number(designCaptureSettings.manualDeviceScaleFactor)

      const response = await captureLocalhost({
        url,
        width: Number.isInteger(manualW) && manualW >= 1 ? manualW : 1280,
        height: Number.isInteger(manualH) && manualH >= 1 ? manualH : 800,
        deviceScaleFactor: Number.isFinite(manualDsf) && manualDsf >= 0.25 ? manualDsf : 1,
        selector: designCaptureSettings.selector.trim() || undefined,
        waitForMs: designCaptureSettings.waitForMs || 0,
        hideScrollbars: designCaptureSettings.hideScrollbars !== false,
        localStorage: designCaptureSettings.localStorage,
      })

      const loaded = await loadImageFromUrl(
        response.imageBase64,
        `design-${new URL(url).hostname}.png`,
      )

      const meta: CaptureMeta = {
        domMap: response.domMap,
        deviceScaleFactor: response.deviceScaleFactor,
        capturedWidth: response.capturedWidth,
        capturedHeight: response.capturedHeight,
        url,
        selector: designCaptureSettings.selector,
        durationMs: response.durationMs,
      }

      loadDesignImage(loaded, meta)
      if (response.warnings?.length) setDesignCaptureWarnings(response.warnings)
      addToast(
        'success',
        `Reference captured in ${response.durationMs}ms (${response.domMap.length} DOM elements mapped)`,
      )
      return loaded
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reference capture failed'
      setDesignCaptureError(message)
      addToast('error', message)
      return null
    } finally {
      setCapturingDesign(false)
    }
  }, [capturingDesign, designCaptureSettings, loadDesignImage, addToast])

  const runCaptureImpl = useCallback(
    async (overrideDesign?: LoadedImage | null): Promise<LoadedImage | null> => {
      if (capturingImpl) return null
      const url = implCaptureSettings.url.trim()
      if (!url) {
        setImplCaptureError('Please enter a target URL')
        return null
      }

      setCapturingImpl(true)
      setImplCaptureError(null)
      setImplCaptureWarnings([])

      const currentDesign = overrideDesign !== undefined ? overrideDesign : design
      const currentResolved = resolveCaptureViewport(
        implCaptureSettings,
        currentDesign,
        designScale,
      )

      try {
        const width = Number.isInteger(currentResolved.width) && currentResolved.width >= 1 ? currentResolved.width : 1280
        const height = Number.isInteger(currentResolved.height) && currentResolved.height >= 1 ? currentResolved.height : 800
        const dsf = Number.isFinite(currentResolved.deviceScaleFactor) ? currentResolved.deviceScaleFactor : 1

        const response = await captureLocalhost({
          url,
          width,
          height,
          deviceScaleFactor: dsf,
          selector: implCaptureSettings.selector.trim() || undefined,
          waitForMs: implCaptureSettings.waitForMs || 0,
          hideScrollbars: implCaptureSettings.hideScrollbars !== false,
          localStorage: implCaptureSettings.localStorage,
        })

        const loaded = await loadImageFromUrl(
          response.imageBase64,
          `impl-${new URL(url).pathname.replace(/\//g, '_') || 'root'}.png`,
        )

        const meta: CaptureMeta = {
          domMap: response.domMap,
          deviceScaleFactor: response.deviceScaleFactor,
          capturedWidth: response.capturedWidth,
          capturedHeight: response.capturedHeight,
          url,
          selector: implCaptureSettings.selector,
          durationMs: response.durationMs,
        }

        loadImplImage(loaded, meta)
        if (response.warnings?.length) setImplCaptureWarnings(response.warnings)
        addToast(
          'success',
          `Implementation captured in ${response.durationMs}ms (${response.domMap.length} DOM elements mapped)`,
        )
        return loaded
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Implementation capture failed'
        setImplCaptureError(message)
        addToast('error', message)
        return null
      } finally {
        setCapturingImpl(false)
      }
    },
    [capturingImpl, implCaptureSettings, design, designScale, loadImplImage, addToast],
  )

  const runCaptureBoth = useCallback(async () => {
    if (capturingBoth || capturingDesign || capturingImpl) return
    setCapturingBoth(true)
    addToast('info', 'Capturing Reference URL first…')
    const capturedDesign = await runCaptureDesign()
    if (capturedDesign) {
      addToast('info', 'Reference captured! Now capturing Localhost…')
      await runCaptureImpl(capturedDesign)
      addToast('success', 'Both Reference and Localhost captured and aligned!')
      setInspectionMode('diff')
    }
    setCapturingBoth(false)
  }, [capturingBoth, capturingDesign, capturingImpl, runCaptureDesign, runCaptureImpl, addToast])

  /* ------------------------------- AI Vision Audit -------------------------- */
  const activeApiKey = resolveApiKey(storedApiKey)
  const canRunAi = Boolean(
    activeApiKey && (
      (design && impl) ||
      (designCaptureSettings.url.trim() && implCaptureSettings.url.trim())
    ),
  )

  const runAiAudit = useCallback(async () => {
    if (!activeApiKey) {
      addToast('error', 'Por favor, informe sua chave Gemini API no painel.')
      setRightTab('issues')
      return
    }
    if (aiRunning) return

    setAiRunning(true)
    setAiError(null)

    try {
      let activeDesign = design
      let activeImpl = impl

      // If images haven't been captured yet (e.g. user is in Live Mode), auto-capture both pages!
      if (!activeDesign || !activeImpl) {
        if (!designCaptureSettings.url.trim() || !implCaptureSettings.url.trim()) {
          addToast('info', 'Carregue as imagens ou informe as URLs de referência e da sua loja local.')
          setAiRunning(false)
          return
        }
        addToast('info', 'Capturando ambas as páginas para auditoria com IA...')
        setCapturingBoth(true)
        const capDesign = await runCaptureDesign()
        if (capDesign) {
          const capImpl = await runCaptureImpl(capDesign)
          activeDesign = capDesign
          activeImpl = capImpl
        }
        setCapturingBoth(false)
        if (!activeDesign || !activeImpl) {
          addToast('error', 'Falha ao capturar as páginas. Verifique se os sites estão respondendo.')
          setAiRunning(false)
          return
        }
      }

      // Compute comparison layout
      const currentLayout = computeLayout(activeDesign, activeImpl, offset)

      // 1. Design 1:1 in comparison layout
      const designCanvas = rasterizeLayer(activeDesign.element, currentLayout.width, currentLayout.height, 0, 0)
      // 2. Implementation 1:1 with offset
      const implCanvas = rasterizeLayer(activeImpl.element, currentLayout.width, currentLayout.height, currentLayout.offsetX, currentLayout.offsetY)
      // 3. Diff composite (dimmed design + neon magenta mask)
      const currentDiff = diffResult ?? computeDiff({ design: activeDesign, impl: activeImpl, layout: currentLayout, threshold, includeAA })
      const diffCanvas = buildDiffComposite(activeDesign, currentDiff, currentLayout)

      const designB64 = canvasToBase64Png(designCanvas)
      const implB64 = canvasToBase64Png(implCanvas)
      const diffB64 = canvasToBase64Png(diffCanvas)

      const rawIssues = await runVisionAudit({
        apiKey: activeApiKey,
        model: geminiModel,
        designBase64: designB64,
        implBase64: implB64,
        diffBase64: diffB64,
        width: currentLayout.width,
        height: currentLayout.height,
        designScale,
        matchScore: currentDiff.matchScore,
      })

      const newIssues: AuditIssue[] = rawIssues.map((raw, idx) => {
        const rect = boxToPixels(raw.box_2d, currentLayout.width, currentLayout.height)
        const refData = crossReferenceRect(rect, crossRefContext)
        return {
          id: `ai-${Date.now()}-${idx + 1}`,
          source: 'ai',
          rect,
          category: normalizeCategory(raw.category),
          severity: normalizeSeverity(raw.severity),
          description: raw.description,
          expectedFix: raw.expectedFix,
          notes: '',
          ...refData,
        }
      })

      setIssues(newIssues)
      setRightTab('issues')
      setInspectionMode('diff')
      if (newIssues.length > 0) {
        setSelectedIssueId(newIssues[0].id)
        setFocusRequest({ rect: newIssues[0].rect, nonce: Date.now() })
        addToast('success', `${newIssues.length} divergências visuais detectadas pela IA!`)
      } else {
        addToast('info', 'Auditoria concluída! Nenhuma divergência visual detectada pelo Gemini.')
      }
    } catch (err) {
      const message = describeGeminiError(err)
      setAiError(message)
      addToast('error', message)
    } finally {
      setAiRunning(false)
    }
  }, [
    activeApiKey,
    aiRunning,
    design,
    impl,
    designCaptureSettings.url,
    implCaptureSettings.url,
    runCaptureDesign,
    runCaptureImpl,
    offset,
    diffResult,
    threshold,
    includeAA,
    geminiModel,
    designScale,
    crossRefContext,
    addToast,
  ])

  const handleGeneratePrompt = useCallback(async () => {
    if (issues.length === 0) {
      addToast('info', 'Iniciando auditoria para compilar o prompt de correção...')
      await runAiAudit()
    } else {
      addToast('success', 'Prompt de correção atualizado!')
    }
    setRightTab('prompt')
  }, [issues.length, runAiAudit, addToast])

  /* ---------------------------- Demo Scenario ------------------------------- */
  const handleLoadDemo = useCallback(async () => {
    try {
      const pair = await createDemoPair()
      loadDesignImage(pair.design)
      loadImplImage(pair.impl, null)
      setDesignScale(1)
      setOffset({ x: 0, y: 0 })
      setProjectName('Orbit Landing Page')
      setExtraContext('React 18 + Tailwind CSS. Component file is at src/components/Hero.tsx.')
      addToast('success', 'Demo scenario loaded! Press 1-5 to inspect modes or G for AI audit.')
      setFitSignal((s) => s + 1)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to load demo scenario')
    }
  }, [loadDesignImage, loadImplImage, addToast])

  /* ----------------------------- Manual Annotations ------------------------- */
  const handleCreateBox = useCallback(
    (rect: Rect) => {
      const refData = crossReferenceRect(rect, crossRefContext)
      const newIssue: AuditIssue = {
        id: `manual-${Date.now()}`,
        source: 'manual',
        rect,
        category: 'layout',
        severity: 'minor',
        description: '',
        expectedFix: '',
        notes: '',
        ...refData,
      }
      setIssues((prev) => [...prev, newIssue])
      setSelectedIssueId(newIssue.id)
      setRightTab('issues')
      addToast('info', `Annotation #${issues.length + 1} added`)
    },
    [crossRefContext, issues.length, addToast],
  )

  const handleUpdateIssue = useCallback((id: string, patch: Partial<AuditIssue>) => {
    setIssues((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const handleDeleteIssue = useCallback(
    (id: string) => {
      setIssues((prev) => prev.filter((item) => item.id !== id))
      if (selectedIssueId === id) setSelectedIssueId(null)
    },
    [selectedIssueId],
  )

  const handleClearIssues = useCallback(() => {
    setIssues([])
    setSelectedIssueId(null)
  }, [])

  const handleSelectIssue = useCallback(
    (id: string) => {
      setSelectedIssueId(id)
      setRightTab('issues')
      const target = issues.find((i) => i.id === id)
      if (target) {
        if (inspectionMode === 'live') setInspectionMode('diff')
        setFocusRequest({ rect: target.rect, nonce: Date.now() })
      }
    },
    [issues, inspectionMode],
  )

  /* ---------------------------- Prompt Compilation -------------------------- */
  const compiledPrompt = useMemo(
    () =>
      compilePrompt(
        {
          projectName,
          extraContext,
          designName: designMeta?.url ?? (design?.name ?? null),
          designSize: design ? { width: design.width, height: design.height } : null,
          implName: implMeta?.url ?? (impl?.name ?? null),
          implSize: impl ? { width: impl.width, height: impl.height } : null,
          designScale,
          offset,
          captureUrl: implMeta?.url ?? (implCaptureSettings.url || null),
          captureSelector: implMeta?.selector ?? (implCaptureSettings.selector || null),
          captureViewport: implMeta
            ? {
                width: implMeta.capturedWidth,
                height: implMeta.capturedHeight,
                deviceScaleFactor: implMeta.deviceScaleFactor,
              }
            : null,
          matchScore: formatMatchScore(diffResult),
          mismatchedPixels: diffResult?.mismatched ?? null,
          totalPixels: diffResult?.total ?? null,
          threshold,
        },
        resolvedIssues,
      ),
    [
      projectName,
      extraContext,
      design,
      designMeta,
      impl,
      implMeta,
      designScale,
      offset,
      implCaptureSettings,
      diffResult,
      threshold,
      resolvedIssues,
    ],
  )

  /* ------------------------------- Export Actions --------------------------- */
  const handleCopyPrompt = useCallback(async (): Promise<boolean> => {
    const ok = await copyText(compiledPrompt)
    if (ok) addToast('success', 'Prompt copied to clipboard! Paste into Cursor or Antigravity IDE.')
    else addToast('error', 'Clipboard write failed. Select text manually from the Prompt tab.')
    return ok
  }, [compiledPrompt, addToast])

  const handleDownloadMarkdown = useCallback(() => {
    const filename = `pixel-audit-${(projectName || 'prompt').toLowerCase().replace(/\s+/g, '-')}.md`
    downloadText(compiledPrompt, filename)
    addToast('success', `Saved ${filename}`)
  }, [compiledPrompt, projectName, addToast])

  const handleDownloadPng = useCallback(async () => {
    if (!design && !impl) return
    try {
      const blob = await renderAnnotatedComparison({
        design,
        impl,
        layout,
        issues: resolvedIssues,
      })
      const filename = `pixel-audit-annotated-${Date.now()}.png`
      downloadBlob(blob, filename)
      addToast('success', `Exported annotated PNG (${filename})`)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to export annotated PNG')
    }
  }, [design, impl, layout, resolvedIssues, addToast])

  /* ---------------------------- Global Key & Drag Hooks --------------------- */
  useImageIntake((file) => {
    if (pasteTarget === 'design') {
      void handleDesignFile(file)
    } else {
      void handleImplFile(file)
    }
  })

  useShortcuts({
    mode: inspectionMode,
    onMode: setInspectionMode,
    tool: toolMode,
    onTool: setToolMode,
    onCapture: () => void runCaptureImpl(),
    onAudit: () => void runAiAudit(),
    onFit: () => setFitSignal((s) => s + 1),
    onNudge: (dx, dy) => setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy })),
    onBlink: setBlinkShowsDesign,
    onDeleteSelected: () => {
      if (selectedIssueId) handleDeleteIssue(selectedIssueId)
      else if (ruler) setRuler(null)
    },
    onEscape: () => {
      setRuler(null)
      setSelectedIssueId(null)
      setToolMode('inspect')
    },
  })

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-ink-100 select-none">
      <Header onLoadDemo={handleLoadDemo} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Drawer: Source, Calibration & Localhost Capture */}
        <SourcePanel
          design={design}
          impl={impl}
          pasteTarget={pasteTarget}
          onPasteTarget={setPasteTarget}
          onDesignFile={handleDesignFile}
          onImplFile={handleImplFile}
          onClearDesign={handleClearDesign}
          onClearImpl={handleClearImpl}
          designScale={designScale}
          onDesignScale={setDesignScale}
          offset={offset}
          onOffset={setOffset}
          designCaptureSettings={designCaptureSettings}
          onDesignCaptureSettings={(patch) =>
            setDesignCaptureSettings((s) => ({ ...s, ...patch }))
          }
          capturingDesign={capturingDesign}
          onCaptureDesign={runCaptureDesign}
          designMeta={designMeta}
          designCaptureError={designCaptureError}
          designCaptureWarnings={designCaptureWarnings}
          implCaptureSettings={implCaptureSettings}
          onImplCaptureSettings={(patch) =>
            setImplCaptureSettings((s) => ({ ...s, ...patch }))
          }
          resolvedViewport={resolvedViewport}
          capturingImpl={capturingImpl}
          onCaptureImpl={runCaptureImpl}
          implMeta={implMeta}
          implCaptureError={implCaptureError}
          implCaptureWarnings={implCaptureWarnings}
          onCaptureBoth={runCaptureBoth}
          capturingBoth={capturingBoth}
          onOpenLiveMode={() => setInspectionMode(inspectionMode === 'live' ? 'diff' : 'live')}
          isLiveMode={inspectionMode === 'live'}
        />

        {/* Center: Toolbar + Infinite Pan/Zoom Stage Viewport + Loupe + HUD */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <Toolbar
            mode={inspectionMode}
            onModeChange={setInspectionMode}
            tool={toolMode}
            onToolChange={setToolMode}
            hasBoth={design !== null && impl !== null}
            diff={diffResult}
            diffBusy={false}
            threshold={threshold}
            onThreshold={setThreshold}
            includeAA={includeAA}
            onIncludeAA={setIncludeAA}
            diffBase={diffBase}
            onDiffBase={setDiffBase}
            onionOpacity={onionOpacity}
            onOnionOpacity={setOnionOpacity}
            blendDifference={blendDifference}
            onBlendDifference={setBlendDifference}
            blinkShowsDesign={blinkShowsDesign}
            onBlinkHold={setBlinkShowsDesign}
            onSplitReset={() => setSplitPos(0.5)}
          />

          <Viewport
            mode={inspectionMode}
            tool={toolMode}
            design={design}
            impl={impl}
            layout={layout}
            diff={diffResult}
            diffBase={diffBase}
            onionOpacity={onionOpacity}
            blendDifference={blendDifference}
            blinkShowsDesign={blinkShowsDesign}
            splitPos={splitPos}
            onSplitChange={setSplitPos}
            view={view}
            onViewChange={setView}
            fitSignal={fitSignal}
            focusRequest={focusRequest}
            designSampler={designSampler}
            implSampler={implSampler}
            meta={implMeta}
            designScale={designScale}
            issues={resolvedIssues}
            selectedId={selectedIssueId}
            onSelectIssue={handleSelectIssue}
            onCreateBox={handleCreateBox}
            ruler={ruler}
            onRulerChange={setRuler}
            onLoadDemo={handleLoadDemo}
            designSettings={designCaptureSettings}
            implSettings={implCaptureSettings}
            onUpdateDesignSettings={(patch) => setDesignCaptureSettings((prev) => ({ ...prev, ...patch }))}
            onUpdateImplSettings={(patch) => setImplCaptureSettings((prev) => ({ ...prev, ...patch }))}
            onCaptureBoth={runCaptureBoth}
            capturingBoth={capturingBoth}
            onAddToast={addToast}
          />
        </div>

        {/* Right Drawer: AI Vision Audit + Issues List + Structured Prompt Compiler */}
        <RightPanel
          tab={rightTab}
          onTab={setRightTab}
          issueCount={resolvedIssues.length}
          aiControls={
            <AiControls
              apiKey={storedApiKey}
              onApiKey={(k) => {
                setStoredApiKey(k)
                writeStoredApiKey(k)
              }}
              envKeyAvailable={hasEnvApiKey()}
              model={geminiModel}
              onModel={(m) => {
                setGeminiModel(m)
                try {
                  localStorage.setItem(MODEL_STORAGE, m)
                } catch {
                  /* ignore */
                }
              }}
              running={aiRunning}
              canRun={canRunAi}
              onRun={runAiAudit}
              error={aiError}
            />
          }
          issues={
            <IssuesPanel
              issues={resolvedIssues}
              selectedId={selectedIssueId}
              designScale={designScale}
              design={design}
              impl={impl}
              diff={diffResult}
              layout={layout}
              onSelect={handleSelectIssue}
              onChange={handleUpdateIssue}
              onDelete={handleDeleteIssue}
              onClear={handleClearIssues}
              onRunAi={runAiAudit}
              aiRunning={aiRunning}
              onFocusOnCanvas={(rect) => {
                if (inspectionMode === 'live') setInspectionMode('diff')
                setFocusRequest({ rect, nonce: Date.now() })
              }}
            />
          }
          prompt={
            <PromptPanel
              projectName={projectName}
              onProjectName={setProjectName}
              extraContext={extraContext}
              onExtraContext={setExtraContext}
              prompt={compiledPrompt}
              issueCount={resolvedIssues.length}
              canExportImage={design !== null || impl !== null}
              aiRunning={aiRunning}
              onGeneratePrompt={handleGeneratePrompt}
              onCopy={handleCopyPrompt}
              onDownloadPng={handleDownloadPng}
              onDownloadMarkdown={handleDownloadMarkdown}
            />
          }
        />
      </div>

      <Toasts toasts={toasts} />
    </div>
  )
}
