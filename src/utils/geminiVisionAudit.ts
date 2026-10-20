import { GoogleGenAI, Type, type Schema } from '@google/genai'
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  type AiRawIssue,
  type GeminiModel,
  type IssueCategory,
  type IssueSeverity,
  type Rect,
} from '../types/audit'
import { clamp } from './geometry'

export const API_KEY_STORAGE = 'pixelaudit.geminiApiKey'
export const MODEL_STORAGE = 'pixelaudit.geminiModel'

export const GEMINI_MODELS: { value: GeminiModel; label: string; hint: string }[] = [
  { value: 'gemini-2.5-pro', label: '2.5 Pro', hint: 'Most precise' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash', hint: 'Fastest' },
]

/** Key persisted by the user in localStorage ('' when none). */
export function readStoredApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeStoredApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(API_KEY_STORAGE, key.trim())
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch {
    /* storage unavailable */
  }
}

/** localStorage first, then `VITE_GEMINI_API_KEY`. */
export function resolveApiKey(stored: string): string {
  if (stored.trim()) return stored.trim()
  const fromEnv = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  return fromEnv?.trim() ?? ''
}

export function hasEnvApiKey(): boolean {
  return Boolean((import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim())
}

/** Structured Output schema: forces an array of issues with 0-1000 boxes. */
export const ISSUE_RESPONSE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      box_2d: {
        type: Type.ARRAY,
        description: 'Bounding box [ymin, xmin, ymax, xmax], integers on a 0-1000 scale.',
        items: { type: Type.INTEGER },
        minItems: '4',
        maxItems: '4',
      },
      category: { type: Type.STRING, enum: [...ISSUE_CATEGORIES] },
      severity: { type: Type.STRING, enum: [...ISSUE_SEVERITIES] },
      description: {
        type: Type.STRING,
        description: 'What differs between Design and Implementation, with measurable values.',
      },
      expectedFix: {
        type: Type.STRING,
        description: 'Concrete CSS / markup change that makes the Implementation match the Design.',
      },
    },
    required: ['box_2d', 'category', 'severity', 'description', 'expectedFix'],
    propertyOrdering: ['box_2d', 'category', 'severity', 'description', 'expectedFix'],
  },
}

const SYSTEM_INSTRUCTION = `You are a meticulous pixel-perfect UI QA engineer performing a visual regression audit.
You receive three images of IDENTICAL dimensions and an identical coordinate space:
  1. DESIGN: the Designer's reference (source of truth).
  2. IMPLEMENTATION: a screenshot of the live front-end.
  3. DIFF: the dimmed design with every mismatching pixel painted neon magenta (computed by pixelmatch).

Rules:
- Report only REAL visual discrepancies a developer must fix: spacing, size, alignment, typography, colour, border radius, borders / shadows, missing or extra elements, icons / images, layout.
- Use the DIFF image to locate regions precisely, then compare DESIGN vs IMPLEMENTATION to understand the cause.
- Ignore sub-pixel anti-aliasing noise and isolated single-pixel differences.
- Merge diffs that share a single root cause into ONE issue with a box covering the affected element.
- Boxes must be tight: [ymin, xmin, ymax, xmax] with integers on a 0-1000 scale relative to the full image height / width.
- Quote measurable values whenever possible (px offsets, font sizes, HEX colours, radii) using the pixel scale of the images.
- "expectedFix" must be an actionable CSS or markup instruction.
- Order issues by severity (critical first). Return at most 25 issues. Return an empty array if the images match.`

export interface VisionAuditInput {
  apiKey: string
  model: GeminiModel
  designBase64: string
  implBase64: string
  diffBase64: string
  /** Size (px) of the comparison space the boxes refer to. */
  width: number
  height: number
  /** Pixel density of the design export relative to CSS px. */
  designScale: number
  matchScore: number | null
}

export async function runVisionAudit(input: VisionAuditInput): Promise<AiRawIssue[]> {
  if (!input.apiKey) {
    throw new Error('Add a Gemini API key first (stored in localStorage or VITE_GEMINI_API_KEY).')
  }
  const ai = new GoogleGenAI({ apiKey: input.apiKey })
  const png = (data: string) => ({ inlineData: { mimeType: 'image/png', data } })

  const context =
    `Comparison space: ${input.width}x${input.height} px. ` +
    `Design export density: ${input.designScale}x (1 CSS px = ${input.designScale} image px). ` +
    (input.matchScore !== null ? `pixelmatch score: ${input.matchScore.toFixed(2)}%. ` : '') +
    'Audit the implementation against the design.'

  const response = await ai.models.generateContent({
    model: input.model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: context },
          { text: 'Image 1 - DESIGN (reference):' },
          png(input.designBase64),
          { text: 'Image 2 - IMPLEMENTATION (live screenshot):' },
          png(input.implBase64),
          { text: 'Image 3 - DIFF (magenta = mismatching pixels):' },
          png(input.diffBase64),
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: ISSUE_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned an empty response.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned malformed JSON.')
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini response was not an array of issues.')

  return parsed.filter(isRawIssue)
}

function isRawIssue(value: unknown): value is AiRawIssue {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.box_2d) &&
    v.box_2d.length === 4 &&
    v.box_2d.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    typeof v.description === 'string'
  )
}

/**
 * Normalised [ymin, xmin, ymax, xmax] (0-1000) -> exact pixels in a
 * `width x height` space. Always returns at least a 1x1 box inside the space.
 */
export function boxToPixels(box: [number, number, number, number], width: number, height: number): Rect {
  const [ymin, xmin, ymax, xmax] = box.map((n) => clamp(n, 0, 1000))
  const x1 = Math.round((Math.min(xmin, xmax) / 1000) * width)
  const x2 = Math.round((Math.max(xmin, xmax) / 1000) * width)
  const y1 = Math.round((Math.min(ymin, ymax) / 1000) * height)
  const y2 = Math.round((Math.max(ymin, ymax) / 1000) * height)
  const x = clamp(x1, 0, Math.max(0, width - 1))
  const y = clamp(y1, 0, Math.max(0, height - 1))
  return {
    x,
    y,
    width: clamp(x2 - x, 1, width - x),
    height: clamp(y2 - y, 1, height - y),
  }
}

export function normalizeCategory(value: string): IssueCategory {
  const lower = value.toLowerCase()
  return (ISSUE_CATEGORIES as readonly string[]).includes(lower) ? (lower as IssueCategory) : 'other'
}

export function normalizeSeverity(value: string): IssueSeverity {
  const lower = value.toLowerCase()
  return (ISSUE_SEVERITIES as readonly string[]).includes(lower) ? (lower as IssueSeverity) : 'minor'
}

/** Human-friendly message for SDK / network failures. */
export function describeGeminiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/API key not valid|API_KEY_INVALID|401|403/i.test(raw)) return 'Gemini rejected the API key.'
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(raw)) return 'Gemini quota / rate limit reached. Try Flash or wait a bit.'
  if (/Failed to fetch|NetworkError/i.test(raw)) return 'Network error while contacting Gemini.'
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw
}
