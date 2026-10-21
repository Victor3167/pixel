import type { ObsidianDoc, ObsidianDocState, ObsidianFile } from '../types/audit'

export const OBSIDIAN_STORAGE_KEY = 'pixelaudit.obsidianVault'
const LEGACY_STORAGE_KEY = 'pixelaudit.obsidianDoc'

export const EMPTY_OBSIDIAN_STATE: ObsidianDocState = {
  files: [],
  activeFileId: null,
  useInAudit: true,
  useInPrompt: true,
  updatedAt: Date.now(),
}

export const SAMPLE_OBSIDIAN_FILES: ObsidianFile[] = [
  {
    id: 'sample-tema',
    name: '03 - Como funciona o tema.md',
    path: '10 - Do zero/03 - Como funciona o tema.md',
    enabled: true,
    updatedAt: Date.now(),
    content: `# 03 - Como funciona o tema

## Paleta de Cores e Tokens
- **Background Base**: #050505 (Obsidian Deep Black).
- **Superfícies**: Neutros Zinc (#09090b, #121215, #18181b, #27272a, #3f3f46).
- **Cor Primária de Ação**: Verde Militar (#5f7142 base, #4a5b31 hover, #3a4726 active).
- **Acentos e Badges**: Verde Esmeralda (#22c55e / #4ade80) com efeito glow sutil.
- **Tipografia**: 'Inter' para UI e 'JetBrains Mono' para valores técnicos e códigos.
`,
  },
  {
    id: 'sample-layout',
    name: '04 - Como funciona o layout.md',
    path: '10 - Do zero/04 - Como funciona o layout.md',
    enabled: true,
    updatedAt: Date.now(),
    content: `# 04 - Como funciona o layout

## Estrutura da Página
- **Header**: Barra fixa superior com 48px de altura (h-12), padding horizontal de 16px (px-4).
- **Sidebar**: Largura fixa de 380px no drawer direito, com transição suave de 200ms.
- **Área Central (Stage)**: Ocupa 100% da viewport restante com fundo #050505.
- **Alinhamento**: Todos os elementos internos devem seguir múltiplos de 4px ou 8px de espaçamento.
`,
  },
  {
    id: 'sample-composition',
    name: '05 - Como funciona a composition.md',
    path: '10 - Do zero/05 - Como funciona a composition.md',
    enabled: true,
    updatedAt: Date.now(),
    content: `# 05 - Como funciona a composition

## Composição de Componentes
- Componentes modulares conectados via slots e props desacopladas.
- Botões primários utilizam variante 'primary' com gradiente vertical e sombra verde militar.
- Modais e popups devem possuir overlay com blur (backdrop-blur-md) e borda de 1px com rgba(255,255,255,0.1).
`,
  },
]

export function getActiveObsidianMarkdown(state: ObsidianDocState): string {
  const active = state.files.filter((f) => f.enabled && f.content.trim())
  if (active.length === 0) return ''
  if (active.length === 1) return active[0].content.trim()

  return active
    .map((f) => {
      const header = f.path || f.name
      return `### 📄 ${header}\n\n${f.content.trim()}`
    })
    .join('\n\n---\n\n')
}

export function getActiveObsidianTitle(state: ObsidianDocState): string {
  const active = state.files.filter((f) => f.enabled && f.content.trim())
  if (active.length === 0) return ''
  if (active.length === 1) return active[0].name

  const names = active.map((f) => f.name.replace(/\.md$/, ''))
  const preview = names.slice(0, 2).join(', ')
  const remaining = names.length - 2
  return `${active.length} docs (${preview}${remaining > 0 ? ` +${remaining}` : ''})`
}

export function readStoredObsidianVault(): ObsidianDocState {
  try {
    const raw = localStorage.getItem(OBSIDIAN_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ObsidianDocState>
      const files: ObsidianFile[] = Array.isArray(parsed.files)
        ? parsed.files.map((f) => ({
            id: typeof f.id === 'string' ? f.id : `file-${Math.random()}`,
            name: typeof f.name === 'string' ? f.name : 'sem-nome.md',
            path: typeof f.path === 'string' ? f.path : undefined,
            content: typeof f.content === 'string' ? f.content : '',
            enabled: typeof f.enabled === 'boolean' ? f.enabled : true,
            updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : Date.now(),
          }))
        : []

      return {
        files,
        activeFileId: typeof parsed.activeFileId === 'string' ? parsed.activeFileId : (files[0]?.id ?? null),
        useInAudit: typeof parsed.useInAudit === 'boolean' ? parsed.useInAudit : true,
        useInPrompt: typeof parsed.useInPrompt === 'boolean' ? parsed.useInPrompt : true,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      }
    }

    // Migration from legacy single-file storage
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<ObsidianDoc>
      if (legacy.content?.trim()) {
        const file: ObsidianFile = {
          id: `legacy-${Date.now()}`,
          name: legacy.title || 'Documentação.md',
          content: legacy.content,
          enabled: true,
          updatedAt: legacy.updatedAt || Date.now(),
        }
        return {
          files: [file],
          activeFileId: file.id,
          useInAudit: typeof legacy.useInAudit === 'boolean' ? legacy.useInAudit : true,
          useInPrompt: typeof legacy.useInPrompt === 'boolean' ? legacy.useInPrompt : true,
          updatedAt: Date.now(),
        }
      }
    }

    return EMPTY_OBSIDIAN_STATE
  } catch {
    return EMPTY_OBSIDIAN_STATE
  }
}

export function writeStoredObsidianVault(state: ObsidianDocState): void {
  try {
    localStorage.setItem(OBSIDIAN_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full or quota exceeded */
  }
}

export function clearStoredObsidianVault(): void {
  try {
    localStorage.removeItem(OBSIDIAN_STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

// Backwards-compatibility aliases
export const EMPTY_OBSIDIAN_DOC: ObsidianDoc = {
  title: '',
  content: '',
  updatedAt: Date.now(),
  useInAudit: true,
  useInPrompt: true,
}

export const SAMPLE_OBSIDIAN_DOC: ObsidianDoc = {
  title: SAMPLE_OBSIDIAN_FILES[0].name,
  content: SAMPLE_OBSIDIAN_FILES[0].content,
  updatedAt: Date.now(),
  useInAudit: true,
  useInPrompt: true,
}

export function readStoredObsidianDoc(): ObsidianDoc {
  const vault = readStoredObsidianVault()
  return {
    title: getActiveObsidianTitle(vault),
    content: getActiveObsidianMarkdown(vault),
    updatedAt: vault.updatedAt,
    useInAudit: vault.useInAudit,
    useInPrompt: vault.useInPrompt,
  }
}

export function writeStoredObsidianDoc(doc: ObsidianDoc): void {
  const vault = readStoredObsidianVault()
  if (vault.files.length === 0 && doc.content.trim()) {
    const file: ObsidianFile = {
      id: `doc-${Date.now()}`,
      name: doc.title || 'Documentação.md',
      content: doc.content,
      enabled: true,
      updatedAt: Date.now(),
    }
    vault.files = [file]
    vault.activeFileId = file.id
  }
  vault.useInAudit = doc.useInAudit
  vault.useInPrompt = doc.useInPrompt
  vault.updatedAt = Date.now()
  writeStoredObsidianVault(vault)
}
