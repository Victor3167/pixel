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
  { value: 'gemini-3.5-flash', label: '3.5 Flash', hint: 'Fast, multimodal & stable (Recommended)' },
  { value: 'gemini-3.8-flash', label: '3.8 Flash', hint: 'Latest generation' },
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
        description:
          'Descrição detalhada em Português do Brasil (pt-BR) do que está diferente entre o Design e a Implementação, citando valores mensuráveis.',
      },
      expectedFix: {
        type: Type.STRING,
        description:
          'Instrução prática e acionável em Português do Brasil (pt-BR) de alteração em CSS ou marcação HTML/JSX para os desenvolvedores.',
      },
    },
    required: ['box_2d', 'category', 'severity', 'description', 'expectedFix'],
    propertyOrdering: ['box_2d', 'category', 'severity', 'description', 'expectedFix'],
  },
}

const SYSTEM_INSTRUCTION = `Você é um engenheiro sênior de QA e front-end meticuloso realizando uma auditoria de regressão visual pixel-perfect.
Você recebe três imagens com dimensões IDÊNTICAS e mesmo espaço de coordenadas:
  1. DESIGN: a referência do Designer / Figma (fonte da verdade).
  2. IMPLEMENTATION: screenshot da aplicação web em execução.
  3. DIFF: o design escurecido com cada pixel divergente destacado em magenta neon (gerado pelo pixelmatch).

IDIOMA OBRIGATÓRIO (MANDATÓRIO):
- TODOS os textos dos campos "description" e "expectedFix" DEVEM ser redigidos obrigatoriamente em Português do Brasil (pt-BR) fluente, técnico e claro para desenvolvedores front-end.
- Exemplo de "description": "O banner principal exibe a imagem de vinho em vez da garrafa de azeite do design", "O botão 'COMPRE AGORA' possui cor de fundo #693119 quando deveria ser #E79307", "Modal de cookies indesejado cobrindo o canto inferior esquerdo".
- Exemplo de "expectedFix": "Ajustar background-color para #E79307 e padding para 12px 24px", "Definir o slide padrão ativo do componente de carrossel para o banner de azeite", "Fechar ou ocultar o modal de consentimento de cookies no estado inicial".

Regras da Auditoria:
- Relate apenas discrepâncias visuais REAIS que um desenvolvedor precisa corrigir: espaçamentos, tamanhos, alinhamento, tipografia, cores, border-radius, sombras/bordas, elementos ausentes ou extras, ícones/imagens e estrutura de layout.
- Use a imagem DIFF para localizar as regiões com precisão milimétrica, e compare DESIGN vs IMPLEMENTATION para identificar a causa exata.
- Ignore ruídos de anti-aliasing sub-pixel e pixels isolados sem impacto visual.
- Agrupe diferenças com a mesma causa raiz em UMA única ocorrência delimitando o elemento afetado.
- Bounding boxes devem ser ajustadas: [ymin, xmin, ymax, xmax] com inteiros na escala 0-1000 relativa à imagem total.
- Cite valores mensuráveis sempre que possível (offsets em px, tamanhos de fonte, cores HEX, raios de borda).
- "expectedFix" deve ser uma instrução prática de código (CSS ou marcação).
- Ordene por severidade (critical primeiro). Retorne no máximo 25 issues. Retorne array vazio se as imagens forem idênticas.`

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

  // Candidate models: primary chosen model first, followed by stable fallbacks
  const candidateModels = [
    input.model,
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter((m, i, arr) => arr.indexOf(m) === i)

  let lastError: unknown = null
  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
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
    } catch (err: unknown) {
      lastError = err
      const msg = String(err).toLowerCase()
      // If model is retired (404), unavailable/high demand (503), or quota reached on pro, try next candidate
      if (
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('no longer available') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('rate-limit')
      ) {
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('Gemini returned an error during audit.')
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
