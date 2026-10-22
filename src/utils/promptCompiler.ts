import {
  CATEGORY_LABELS_PT,
  SEVERITY_LABELS_PT,
  type AnythingLlmEnrichment,
  type AuditIssue,
  type DesignScale,
  type Rect,
} from '../types/audit'
import { describeDomNode, selectorHint } from './domMatch'
import { formatNumber } from './geometry'

export interface PromptContext {
  projectName: string
  extraContext: string
  obsidianDoc?: {
    title: string
    content: string
  } | null
  anythingLlmEnrichment?: AnythingLlmEnrichment | null
  designName: string | null
  designSize: { width: number; height: number } | null
  implName: string | null
  implSize: { width: number; height: number } | null
  designScale: DesignScale
  offset: { x: number; y: number }
  captureUrl: string | null
  captureSelector: string | null
  captureViewport: { width: number; height: number; deviceScaleFactor: number } | null
  matchScore: string | null
  mismatchedPixels: number | null
  totalPixels: number | null
  threshold: number
}

function px(value: number): string {
  return `${formatNumber(Math.round(value * 100) / 100)}px`
}

function rectLine(rect: Rect, scale: number): string {
  const css = (n: number) => px(n / scale)
  const base = `x=${px(rect.x)}, y=${px(rect.y)}, ${px(rect.width)} × ${px(rect.height)}`
  return scale === 1
    ? base
    : `${base} (CSS: x=${css(rect.x)}, y=${css(rect.y)}, ${css(rect.width)} × ${css(rect.height)})`
}

function categoryLabel(issue: AuditIssue): string {
  const cat = CATEGORY_LABELS_PT[issue.category] ?? issue.category
  const sev = SEVERITY_LABELS_PT[issue.severity] ?? issue.severity
  return `${cat} · ${sev} · ${issue.source === 'ai' ? 'Detectado por IA' : 'Manual'}`
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Compiles the structured Markdown prompt that is pasted into Cursor /
 * Antigravity IDE to fix the implementation automatically.
 */
export function compilePrompt(context: PromptContext, issues: AuditIssue[]): string {
  const lines: string[] = []
  const title = context.projectName.trim() || 'Front-End'

  lines.push(`# Solicitação de Correção Visual — ${title}`)
  lines.push('')
  lines.push(
    'Você é um engenheiro sênior de software front-end. Uma auditoria de regressão visual pixel-perfect comparou ' +
      'a referência do Design (Figma) contra a implementação ativa. Corrija diretamente na base de código cada uma das divergências listadas abaixo para que a interface fique idêntica ao design.',
  )
  lines.push('')

  lines.push('## Contexto')
  if (context.extraContext.trim()) {
    lines.push(`- **Notas do projeto:** ${oneLine(context.extraContext)}`)
  }
  if (context.designSize) {
    lines.push(
      `- **Referência do Design:** ${context.designName ?? 'design'} — ${context.designSize.width}×${context.designSize.height}px ` +
        `exportado a ${context.designScale}x`,
    )
  }
  if (context.implSize) {
    lines.push(`- **Screenshot da Implementação:** ${context.implName ?? 'implementação'} — ${context.implSize.width}×${context.implSize.height}px`)
  }
  if (context.captureUrl) {
    const target = context.captureSelector ? ` — elemento \`${context.captureSelector}\`` : ' — viewport completo'
    lines.push(`- **Página ativa:** ${context.captureUrl}${target}`)
  }
  if (context.captureViewport) {
    const v = context.captureViewport
    lines.push(`- **Viewport capturado:** ${v.width}×${v.height} CSS px @ ${v.deviceScaleFactor}x`)
  }
  if (context.matchScore !== null) {
    const detail =
      context.mismatchedPixels !== null && context.totalPixels !== null
        ? ` (${context.mismatchedPixels.toLocaleString('pt-BR')} de ${context.totalPixels.toLocaleString('pt-BR')} px divergentes, threshold ${context.threshold.toFixed(2)})`
        : ''
    lines.push(`- **Pontuação de Correspondência:** ${context.matchScore}%${detail}`)
  }
  lines.push(
    `- **Sistema de coordenadas:** origem = topo-esquerda da imagem de Design; valores em pixels da imagem` +
      (context.designScale === 1 ? '.' : `, CSS px = imagem px ÷ ${context.designScale}.`),
  )
  if (context.offset.x !== 0 || context.offset.y !== 0) {
    lines.push(`- **Calibração de alinhamento:** implementação deslocada em (${context.offset.x}px, ${context.offset.y}px) antes da comparação.`)
  }
  lines.push('')

  if (issues.length === 0) {
    lines.push('## Divergências')
    lines.push('')
    lines.push('_Nenhuma divergência registrada ainda. Execute a auditoria visual com IA para listar as correções necessárias._')
    lines.push('')
  } else {
    lines.push(`## Divergências a Corrigir (${issues.length})`)
    lines.push('')
    issues.forEach((issue, index) => {
      lines.push(`### #${index + 1} — ${categoryLabel(issue)}`)
      lines.push(`- **Localização:** ${rectLine(issue.rect, context.designScale)}`)
      if (issue.dom) {
        lines.push(`- **Elemento DOM:** \`${describeDomNode(issue.dom)}\` → seletor sugerido \`${selectorHint(issue.dom)}\``)
        if (issue.dom.textSnippet) lines.push(`- **Texto do elemento:** "${issue.dom.textSnippet}"`)
      } else {
        lines.push('- **Elemento DOM:** _não resolvido automaticamente_')
      }
      if (issue.designHex || issue.implHex) {
        lines.push(`- **Cor amostrada:** design \`${issue.designHex ?? 'n/a'}\` → implementação \`${issue.implHex ?? 'n/a'}\``)
      }
      if (issue.description.trim()) lines.push(`- **Problema:** ${oneLine(issue.description)}`)
      if (issue.expectedFix.trim()) lines.push(`- **Correção esperada:** ${oneLine(issue.expectedFix)}`)
      if (issue.notes.trim()) lines.push(`- **Anotações do desenvolvedor:** ${oneLine(issue.notes)}`)
      if (issue.dom) {
        lines.push('- **CSS Computado atual (implementação):**')
        lines.push('  ```css')
        for (const [property, value] of Object.entries(issue.dom.computedStyles)) {
          if (!value) continue
          const kebab = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
          lines.push(`  ${kebab}: ${value};`)
        }
        lines.push('  ```')
      }
      lines.push('')
    })
  }

  if (context.anythingLlmEnrichment?.guidelines.trim()) {
    const ws = context.anythingLlmEnrichment.workspace || 'obsidian-infra'
    lines.push(`## Diretrizes Oficiais do Obsidian (Recuperadas via AnythingLLM RAG)`)
    lines.push(`> **Base de Conhecimento:** Workspace \`${ws}\` (AnythingLLM)`)
    if (context.anythingLlmEnrichment.sources.length > 0) {
      const uniqueTitles = Array.from(new Set(context.anythingLlmEnrichment.sources.map((s) => s.title))).slice(0, 5)
      lines.push(`> **Notas consultadas:** ${uniqueTitles.join(', ')}`)
    }
    lines.push('')
    lines.push(context.anythingLlmEnrichment.guidelines.trim())
    lines.push('')
  }

  if (context.obsidianDoc?.content.trim()) {
    const docTitle = context.obsidianDoc.title.trim() || 'Documentação do Projeto'
    lines.push(`## Especificação & Regras do Projeto (Obsidian: ${docTitle})`)
    lines.push('')
    lines.push(context.obsidianDoc.content.trim())
    lines.push('')
  }

  lines.push('## Instruções de Execução')
  lines.push('1. Localize cada elemento no código-fonte usando a tag, classes e seletores indicados acima (busque no repositório pelas classes CSS).')
  lines.push('2. Aplique a correção esperada para cada item numerado, priorizando os tokens de design do projeto / classes utilitárias em vez de valores hard-coded.')
  lines.push('3. Mantenha as alterações mínimas e com escopo preciso: não altere comportamentos ou refatore código não relacionado.')
  lines.push('4. Alinhe com precisão milimétrica: espaçamentos, tipografia (font-size, font-weight, line-height), cores e border-radius exatos.')
  lines.push('5. Ao concluir, confirme os arquivos alterados por número de issue (#1, #2, …) para validação.')
  if (context.anythingLlmEnrichment?.guidelines.trim()) {
    lines.push('6. Respeite com prioridade absoluta as diretrizes, tokens e padrões do Obsidian recuperados pelo AnythingLLM na seção "Diretrizes Oficiais do Obsidian".')
  }
  if (context.obsidianDoc?.content.trim()) {
    lines.push('7. Respeite com prioridade absoluta todas as convenções, regras de negócio e tokens descritos na seção "Especificação & Regras do Projeto (Obsidian)".')
  }

  return lines.join('\n')
}
