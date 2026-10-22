import type { AnythingLlmEnrichment, AnythingLlmSource, AuditIssue } from '../types/audit'

export const ANYTHING_API_KEY_STORAGE = 'pixelaudit.anythingApiKey'
export const ANYTHING_WORKSPACE_STORAGE = 'pixelaudit.anythingWorkspace'
export const ANYTHING_AUTO_ENRICH_STORAGE = 'pixelaudit.anythingAutoEnrich'

const DEFAULT_WORKSPACE = 'obsidian-infra'
const DEFAULT_FALLBACK_KEY = 'XD826KJ-WXP4J2Q-QQ8NPA8-PRFYM5W'

export function readStoredAnythingApiKey(): string {
  try {
    const saved = localStorage.getItem(ANYTHING_API_KEY_STORAGE)?.trim()
    if (saved) return saved
  } catch {
    /* ignore */
  }
  const fromEnv = (import.meta.env.VITE_ANYTHINGLLM_API_KEY as string | undefined)?.trim()
  return fromEnv || DEFAULT_FALLBACK_KEY
}

export function writeStoredAnythingApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(ANYTHING_API_KEY_STORAGE, key.trim())
    else localStorage.removeItem(ANYTHING_API_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}

export function readStoredAnythingWorkspace(): string {
  try {
    const saved = localStorage.getItem(ANYTHING_WORKSPACE_STORAGE)?.trim()
    if (saved) return saved
  } catch {
    /* ignore */
  }
  const fromEnv = (import.meta.env.VITE_ANYTHINGLLM_WORKSPACE as string | undefined)?.trim()
  return fromEnv || DEFAULT_WORKSPACE
}

export function writeStoredAnythingWorkspace(slug: string): void {
  try {
    if (slug.trim()) localStorage.setItem(ANYTHING_WORKSPACE_STORAGE, slug.trim())
    else localStorage.removeItem(ANYTHING_WORKSPACE_STORAGE)
  } catch {
    /* ignore */
  }
}

export function readStoredAutoEnrich(): boolean {
  try {
    const saved = localStorage.getItem(ANYTHING_AUTO_ENRICH_STORAGE)
    if (saved !== null) return saved === 'true'
  } catch {
    /* ignore */
  }
  return true
}

export function writeStoredAutoEnrich(enabled: boolean): void {
  try {
    localStorage.setItem(ANYTHING_AUTO_ENRICH_STORAGE, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export interface WorkspaceItem {
  id: number
  name: string
  slug: string
}

export interface HealthCheckResult {
  online: boolean
  workspaces: WorkspaceItem[]
  error?: string
}

/** Base API path routed through the Vite proxy to avoid CORS. */
function getApiUrl(endpoint: string): string {
  return `/api/anythingllm${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
}

/** Check if AnythingLLM is reachable and list available workspaces */
export async function checkAnythingLlmHealth(apiKey: string): Promise<HealthCheckResult> {
  const token = apiKey.trim()
  if (!token) {
    return { online: false, workspaces: [], error: 'Chave de API do AnythingLLM não fornecida.' }
  }

  try {
    const res = await fetch(getApiUrl('/workspaces'), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      if (res.status === 403) {
        return { online: false, workspaces: [], error: 'Chave de API do AnythingLLM inválida (403 Forbidden).' }
      }
      return { online: false, workspaces: [], error: `Erro na API do AnythingLLM: HTTP ${res.status}` }
    }

    const data = await res.json()
    const workspaces: WorkspaceItem[] = Array.isArray(data.workspaces)
      ? data.workspaces.map((w: { id: number; name: string; slug: string }) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
        }))
      : []

    return { online: true, workspaces }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      online: false,
      workspaces: [],
      error: `Não foi possível conectar ao AnythingLLM (verifique se está rodando em localhost:3001). Detalhe: ${msg}`,
    }
  }
}

export interface QueryAnythingLlmInput {
  apiKey: string
  workspaceSlug: string
  message: string
  mode?: 'query' | 'chat'
}

export interface QueryAnythingLlmResult {
  textResponse: string
  sources: AnythingLlmSource[]
}

/** Direct chat query against a specific AnythingLLM workspace */
export async function queryAnythingLlm(input: QueryAnythingLlmInput): Promise<QueryAnythingLlmResult> {
  const token = input.apiKey.trim()
  const slug = input.workspaceSlug.trim() || DEFAULT_WORKSPACE
  if (!token) throw new Error('Chave de API do AnythingLLM não configurada.')

  const res = await fetch(getApiUrl(`/workspace/${slug}/chat`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: input.message,
      mode: input.mode || 'query',
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Falha na consulta ao AnythingLLM (HTTP ${res.status}): ${errText || res.statusText}`)
  }

  const json = await res.json()
  const textResponse = typeof json.textResponse === 'string' ? json.textResponse.trim() : ''
  const sources: AnythingLlmSource[] = Array.isArray(json.sources)
    ? json.sources.map((s: { title?: string; text?: string }) => ({
        title: s.title || 'Nota Obsidian',
        text: s.text,
      }))
    : []

  return { textResponse, sources }
}

export interface EnrichPromptInput {
  apiKey: string
  workspaceSlug: string
  issues: AuditIssue[]
  projectName?: string
  extraContext?: string
}

/** Queries the Obsidian RAG in AnythingLLM with the detected audit issues to retrieve guidelines */
export async function enrichPromptWithAnythingLlm(input: EnrichPromptInput): Promise<AnythingLlmEnrichment> {
  if (input.issues.length === 0) {
    throw new Error('Nenhuma divergência registrada para enriquecer.')
  }

  const issuesList = input.issues
    .slice(0, 15)
    .map((issue, idx) => {
      const domInfo = issue.dom ? ` [Elemento: <${issue.dom.tagName}> seletor: ${issue.dom.className || issue.dom.id}]` : ''
      const hexInfo = issue.designHex || issue.implHex ? ` [Cores: design ${issue.designHex || 'n/a'} vs impl ${issue.implHex || 'n/a'}]` : ''
      return `${idx + 1}. [Categoria: ${issue.category} - ${issue.severity}] ${issue.description || 'Diferença visual'}${domInfo}${hexInfo}. Correção sugerida: ${issue.expectedFix || 'Ajustar layout'}`
    })
    .join('\n')

  const queryMessage =
    `Você é o consultor técnico especialista em arquitetura front-end, CSS tokens e infraestrutura da nossa documentação do Obsidian.\n\n` +
    `Nossa auditoria visual pixel-perfect detectou as seguintes divergências na tela:\n` +
    `${issuesList}\n\n` +
    (input.extraContext ? `Contexto do Projeto: ${input.extraContext}\n\n` : '') +
    `Com base estritamente nas regras, tokens de design, componentes e convenções contidas nas notas do Obsidian do workspace:\n` +
    `1. Aponte quais são as cores exatas, classes utilitárias, espaçamentos ou padrões oficiais do projeto aplicáveis a essas divergências.\n` +
    `2. Destaque diretrizes mandatórias e restrições que os desenvolvedores NÃO devem violar.\n` +
    `3. Forneça instruções técnicas diretas para correção sem rodeios teóricos.`

  const result = await queryAnythingLlm({
    apiKey: input.apiKey,
    workspaceSlug: input.workspaceSlug,
    message: queryMessage,
    mode: 'query',
  })

  return {
    guidelines: result.textResponse,
    sources: result.sources,
    workspace: input.workspaceSlug,
    timestamp: Date.now(),
  }
}
