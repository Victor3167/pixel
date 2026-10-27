import { GoogleGenAI, Type, type Schema } from '@google/genai'
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  type AiRawIssue,
  type DOMElementNode,
  type GeminiModel,
  type IssueCategory,
  type IssueSeverity,
  type Rect,
} from '../types/audit'
import { clamp } from './geometry'

export const API_KEY_STORAGE = 'pixelaudit.geminiApiKey'
export const MODEL_STORAGE = 'pixelaudit.geminiModel'

export const GEMINI_MODELS: { value: GeminiModel; label: string; hint: string }[] = [
  { value: 'gemini-3.5-flash-lite', label: '3.5 Flash Lite', hint: 'Ultra rápido, alta disponibilidade e multimodal (Recomendado)' },
  { value: 'gemini-flash-lite-latest', label: 'Flash Lite Latest', hint: 'Versão mais recente de alta disponibilidade' },
  { value: 'gemini-3.5-flash', label: '3.5 Flash', hint: 'Multimodal padrão' },
  { value: 'gemini-3.8-flash', label: '3.8 Flash', hint: 'Última geração' },
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

const SYSTEM_INSTRUCTION = `Você é um engenheiro sênior de QA e front-end especialista em auditoria de regressão visual pixel-perfect.
Você recebe imagens com dimensões IDÊNTICAS e mesmo espaço de coordenadas:
  1. DESIGN: a referência do Designer / Figma (fonte da verdade absoluta).
  2. IMPLEMENTATION: screenshot da aplicação web em execução no navegador.
  3. DIFF: o design escurecido com cada pixel divergente destacado em magenta neon (gerado pelo pixelmatch).

IDIOMA OBRIGATÓRIO (MANDATÓRIO):
- TODOS os textos dos campos "description" e "expectedFix" DEVEM ser redigidos obrigatoriamente em Português do Brasil (pt-BR) fluente, técnico e acionável para desenvolvedores front-end.

DIRETRIZES DE ANÁLISE DE ALTA PRECISÃO:
1. Tipografia & Textos (MÁXIMA PRIORIDADE - RIGOROSO E CRÍTICO):
   - Inspecione minuciosamente CADA TEXTO VISÍVEL: títulos principais, botões, preços, badges promocionais, menus, categorias e parágrafos.
   - Família de Fonte (Font Family): compare o desenho tipográfico (serifada vs sem serifa, fontes arredondadas como Poppins/Nunito vs fontes neutras como Inter/Roboto/Arial). Se a fonte do design não foi carregada ou foi substituída pela padrão, aponte obrigatoriamente como "typography" com severidade ALTA ou CRÍTICA.
   - Peso da Fonte (Font Weight): verifique se textos no design estão em negrito/bold (600, 700, 800) e na implementação aparecem em peso regular/normal (400), ou vice-versa.
   - Tamanho da Fonte (Font Size) e Entrelinha (Line Height): verifique proporção, altura em pixels e espaçamento entre linhas.
   - Conteúdo Textual (Copy & Casing): aponte palavras alteradas, maiúsculas/minúsculas (text-transform: uppercase), pontuação, preços diferentes ou textos ausentes.
2. Estrutura & Layout Vertical:
   - Inspecione a altura do header e da barra de categorias. Se houver padding vertical excessivo empurrando seções subsequentes (ex.: início do banner em Y=198px em vez de Y=152px), aponte como CRÍTICO de Estrutura / Layout.
   - Compare rigorosamente os links de menu/categorias no desktop: itens presentes no design vs itens trocados ou ausentes na implementação.
3. Elementos Extras & Modais Invasivos:
   - Detecte modais de consentimento de cookies, popups LGPD ou badges de depuração ("Rendering...", "Dev") cobrindo o conteúdo de base (ex.: cards de benefícios). Aponte como GRAVE de Elemento Extra.
4. Botões Flutuantes & Componentes Satélite:
   - Analise botões flutuantes (ex.: WhatsApp, ajuda): verifique se foi implementado como pílula expandida com texto ("Precisa de ajuda?") ou botões extras adjacentes, quando no design é um botão circular simples (~56x56px, background verde, rounded-full) com ícone SVG.
5. Elementos Faltando & Badges:
   - Verifique badges numéricos sobrepostos a ícones (ex.: badge preto com número "3" e texto branco sobre o ícone de coração de favoritos no header). Aponte como Elemento Faltando.
6. Sliders, Carrosséis & Paginação:
   - Verifique os indicadores de paginação (dots): a barra ou dot ativo está no primeiro slide (índice 0) ou avançou para outro? O slide ativo corresponde ao da referência?
7. Tokens e Regras do Obsidian:
   - Se documentação Obsidian for fornecida, respeite integralmente os tokens, arquitetura (zero forks, Level A composition) e convenções do projeto.

Regras de Saída:
- Relate discrepâncias visuais reais que um dev precisa corrigir. Não ignore diferenças de fonte, peso ou texto.
- Agrupe diferenças com a mesma causa raiz em UMA ocorrência delimitando o elemento afetado.
- Bounding boxes ajustadas: [ymin, xmin, ymax, xmax] com inteiros na escala 0-1000 relativa à imagem total.
- "expectedFix" deve ser uma instrução prática de código (CSS ou marcação JSX/Tailwind).
- Ordene por severidade (critical primeiro). Retorne até 20 issues.`

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
  /** Optional documentation / specifications from Obsidian. */
  obsidianDoc?: {
    title: string
    content: string
  } | null
  /** Optional telemetry of visible DOM nodes in the implementation. */
  domMap?: DOMElementNode[]
  /** Optional telemetry of visible DOM nodes in the design reference. */
  designDomMap?: DOMElementNode[]
}

export async function runVisionAudit(input: VisionAuditInput): Promise<AiRawIssue[]> {
  if (!input.apiKey) {
    throw new Error('Adicione uma chave de API do Gemini (salva no localStorage ou no .env como VITE_GEMINI_API_KEY).')
  }
  const ai = new GoogleGenAI({ apiKey: input.apiKey })
  const png = (data: string) => ({ inlineData: { mimeType: 'image/png', data } })

  const docSection = input.obsidianDoc?.content.trim()
    ? `\n\n[DOCUMENTAÇÃO & ESPECIFICAÇÕES DO PROJETO (DOC OBSIDIAN: "${input.obsidianDoc.title || 'Documentação'}")]:\n"""\n${input.obsidianDoc.content.trim()}\n"""\n` +
      'INSTRUÇÃO ESPECIAL DE AUDITORIA: Analise se a implementação respeita estritamente as regras de negócio, tokens de cores/espaçamentos e convenções descritas no documento Obsidian acima. Cite os requisitos correspondentes na descrição da issue quando aplicável.'
    : ''

  const formatTelemetryNode = (n: DOMElementNode) => {
    const text = n.textSnippet ? ` text="${n.textSnippet}"` : ''
    const cls = n.className ? ` class="${n.className.slice(0, 50)}"` : ''
    const cs = n.computedStyles
    const fontInfo = cs?.fontFamily
      ? ` font="${cs.fontSize || ''} ${cs.fontFamily.split(',')[0].replace(/['"]/g, '')} weight:${cs.fontWeight || ''} color:${cs.color || ''}"`
      : ''
    return `<${n.tagName}${cls}>${text}${fontInfo} rect=[x:${Math.round(n.rect.x)}, y:${Math.round(n.rect.y)}, w:${Math.round(n.rect.width)}, h:${Math.round(n.rect.height)}]`
  }

  let domSection = ''
  if (input.domMap && input.domMap.length > 0) {
    const keyNodes = input.domMap
      .filter((n) => {
        const inView = n.rect.x < input.width && n.rect.y < input.height && n.rect.width > 8 && n.rect.height > 8
        const isInteresting =
          Boolean(n.textSnippet) ||
          n.tagName === 'svg' ||
          n.tagName === 'button' ||
          n.tagName === 'a' ||
          n.tagName === 'input' ||
          n.tagName === 'h1' ||
          n.tagName === 'h2' ||
          n.tagName === 'h3' ||
          n.className.includes('fixed') ||
          n.className.includes('nav') ||
          n.className.includes('header') ||
          n.className.includes('banner') ||
          n.className.includes('modal')
        return inView && isInteresting
      })
      .slice(0, 50)

    if (keyNodes.length > 0) {
      domSection =
        '\n\n[ELEMENTOS DOM REAIS CAPTURADOS NA IMPLEMENTAÇÃO (Use para ancorar fontes, pesos e tags)]:\n' +
        keyNodes.map(formatTelemetryNode).join('\n')
    }
  }

  if (input.designDomMap && input.designDomMap.length > 0) {
    const keyDesignNodes = input.designDomMap
      .filter((n) => Boolean(n.textSnippet) && n.rect.width > 8 && n.rect.height > 8)
      .slice(0, 40)
    if (keyDesignNodes.length > 0) {
      domSection +=
        '\n\n[ELEMENTOS DOM DO DESIGN DE REFERÊNCIA (Compare os textos e fontes abaixo contra a implementação)]:\n' +
        keyDesignNodes.map(formatTelemetryNode).join('\n')
    }
  }

  const context =
    `Espaço de comparação: ${input.width}x${input.height} px. ` +
    `Densidade de exportação: ${input.designScale}x (1 CSS px = ${input.designScale} image px). ` +
    (input.matchScore !== null ? `Score de correspondência pixelmatch: ${input.matchScore.toFixed(2)}%. ` : '') +
    'Realize a auditoria visual detalhada da implementação contra o design de referência.' +
    domSection +
    docSection

  // Candidate models: primary chosen model first, followed by stable fallbacks
  const candidateModels: string[] = [
    input.model,
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
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
              { text: 'Imagem 1 - DESIGN (Referência do Figma / Designer):' },
              png(input.designBase64),
              { text: 'Imagem 2 - IMPLEMENTATION (Screenshot da aplicação ativa no navegador):' },
              png(input.implBase64),
              { text: 'Imagem 3 - DIFF (Pixels divergentes destacados em magenta neon):' },
              png(input.diffBase64),
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ISSUE_RESPONSE_SCHEMA,
          temperature: 0.15,
        },
      })

      const text = response.text
      if (!text) throw new Error('O Gemini retornou uma resposta vazia.')

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('O Gemini retornou um JSON malformado.')
      }
      if (!Array.isArray(parsed)) throw new Error('A resposta do Gemini não foi uma lista de divergências.')

      return parsed.filter(isRawIssue)
    } catch (err: unknown) {
      lastError = err
      const msg = String(err).toLowerCase()
      // If model has high demand (503), quota (429), or is not found (404), seamlessly try next candidate
      if (
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('no longer available') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('spikes in demand') ||
        msg.includes('rate-limit') ||
        msg.includes('429') ||
        msg.includes('resource_exhausted')
      ) {
        console.warn(`[pixel-audit] Modelo ${modelName} indisponível ou com alta demanda (${msg.slice(0, 80)}). Tentando próximo modelo...`)
        await new Promise((r) => setTimeout(r, 600))
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('Falha ao executar auditoria com o Gemini.')
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
