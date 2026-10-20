/**
 * Shared domain types for PixelAudit2Prompt.
 *
 * This file is imported by BOTH the browser bundle and `vite.config.ts`
 * (the Playwright capture middleware), so it must stay free of runtime code.
 */

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                   */
/* -------------------------------------------------------------------------- */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/* -------------------------------------------------------------------------- */
/*  Playwright capture API (POST /api/capture)                                 */
/* -------------------------------------------------------------------------- */

export interface CaptureRequest {
  /** Target URL, e.g. "http://localhost:3000". */
  url: string
  /** Target CSS viewport width. */
  width: number
  /** Target CSS viewport height. */
  height: number
  /** 1 or 2 (matches Figma 1x / 2x Retina exports). 0.5 is also accepted. */
  deviceScaleFactor: number
  /** Optional CSS selector for isolated component capture. */
  selector?: string
  /** Optional extra delay (ms) after `networkidle` + fonts ready. */
  waitForMs?: number
  /** Default: true. Neutralises scrollbars to avoid 15-17px layout shifts. */
  hideScrollbars?: boolean
  /** Optional key-value localStorage entries injected before capture (e.g. auth tokens). */
  localStorage?: Record<string, string>
}

export interface DOMComputedStyles {
  display: string
  position: string
  width: string
  height: string
  padding: string
  margin: string
  gap: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  color: string
  backgroundColor: string
  borderRadius: string
  border: string
  justifyContent: string
  alignItems: string
}

export interface DOMElementNode {
  /** Lowercase tag name. */
  tagName: string
  id: string
  className: string
  /** First 40 characters of the element's own text. */
  textSnippet: string
  /** CSS-pixel rectangle, relative to the captured region's top-left. */
  rect: Rect
  computedStyles: DOMComputedStyles
  /** Nesting depth relative to the capture root (root = 0). */
  depth: number
}

export interface CaptureResponse {
  /** `data:image/png;base64,...` */
  imageBase64: string
  domMap: DOMElementNode[]
  /** Captured region width in CSS pixels. */
  capturedWidth: number
  /** Captured region height in CSS pixels. */
  capturedHeight: number
  /** Real PNG width in device pixels (capturedWidth * deviceScaleFactor). */
  imageWidth: number
  /** Real PNG height in device pixels. */
  imageHeight: number
  deviceScaleFactor: number
  /** Element bounding box (viewport coords) when a selector was used. */
  boundingBox: Rect | null
  durationMs: number
  warnings: string[]
}

export interface CaptureErrorResponse {
  error: string
}

/* -------------------------------------------------------------------------- */
/*  UI state                                                                   */
/* -------------------------------------------------------------------------- */

/** Pixel density of the Designer's export relative to CSS pixels. */
export type DesignScale = 0.5 | 1 | 2

export type InspectionMode = 'live' | 'diff' | 'onion' | 'blink' | 'split' | 'side'

export type ToolMode = 'inspect' | 'measure' | 'annotate'

export type DiffBase = 'design' | 'impl' | 'none'

export type GeminiModel =
  | 'gemini-3.5-flash'
  | 'gemini-3.8-flash'
  | 'gemini-flash-latest'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'

export type PasteTarget = 'design' | 'impl'

export interface ViewState {
  zoom: number
  panX: number
  panY: number
}

export interface LoadedImage {
  name: string
  /** blob: or data: URL usable as <img src>. */
  url: string
  element: HTMLImageElement
  width: number
  height: number
}

export interface CaptureMeta {
  domMap: DOMElementNode[]
  deviceScaleFactor: number
  capturedWidth: number
  capturedHeight: number
  url: string
  selector: string
  durationMs: number
}

export interface ComparisonLayout {
  /** Width of the shared comparison space (design pixels). */
  width: number
  height: number
  /** Where the implementation's top-left sits inside the comparison space. */
  offsetX: number
  offsetY: number
}

export interface DiffResult {
  width: number
  height: number
  mismatched: number
  total: number
  /** 0 - 100. */
  matchScore: number
  /** Transparent canvas containing only the neon-magenta diff pixels. */
  maskCanvas: HTMLCanvasElement
}

export interface RulerMeasurement {
  a: Point
  b: Point
}

/* -------------------------------------------------------------------------- */
/*  Issues / annotations                                                       */
/* -------------------------------------------------------------------------- */

export const ISSUE_CATEGORIES = [
  'spacing',
  'size',
  'alignment',
  'typography',
  'color',
  'border-radius',
  'border-shadow',
  'missing-element',
  'extra-element',
  'image-icon',
  'layout',
  'other',
] as const

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]

export const CATEGORY_LABELS_PT: Record<IssueCategory, string> = {
  spacing: 'Espaçamento',
  size: 'Dimensão / Tamanho',
  alignment: 'Alinhamento',
  typography: 'Tipografia / Texto',
  color: 'Cor / Contraste',
  'border-radius': 'Raio de Borda (Radius)',
  'border-shadow': 'Borda e Sombra',
  'missing-element': 'Elemento Faltando',
  'extra-element': 'Elemento Extra',
  'image-icon': 'Imagem / Ícone',
  layout: 'Estrutura / Layout',
  other: 'Outro',
}

export const ISSUE_SEVERITIES = ['critical', 'major', 'minor'] as const

export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number]

export const SEVERITY_LABELS_PT: Record<IssueSeverity, string> = {
  critical: 'CRÍTICO',
  major: 'GRAVE',
  minor: 'LEVE',
}

export interface AuditIssue {
  id: string
  source: 'ai' | 'manual'
  /** Rectangle in comparison-space pixels. */
  rect: Rect
  category: IssueCategory
  severity: IssueSeverity
  description: string
  expectedFix: string
  /** Free-form developer notes. */
  notes: string
  designHex: string | null
  implHex: string | null
  /** Live DOM node (from the Playwright domMap) under the box centre. */
  dom: DOMElementNode | null
}

/** Raw shape returned by Gemini (Structured Output). */
export interface AiRawIssue {
  /** [ymin, xmin, ymax, xmax] on a 0 - 1000 scale. */
  box_2d: [number, number, number, number]
  category: string
  severity: string
  description: string
  expectedFix: string
}

/* -------------------------------------------------------------------------- */
/*  Capture form                                                               */
/* -------------------------------------------------------------------------- */

export interface CaptureSettings {
  url: string
  selector: string
  waitForMs: number
  hideScrollbars: boolean
  /** Derive width / height / DPR from the Design image + Design Scale. */
  autoSync: boolean
  manualWidth: number
  manualHeight: number
  manualDeviceScaleFactor: number
  localStorage?: Record<string, string>
}
