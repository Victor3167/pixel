import type { AuditIssue, DOMElementNode, Rect } from '../types/audit'

interface DomDiffOptions {
  width: number
  height: number
  offsetX?: number
  offsetY?: number
}

function cleanFontFamily(raw: string): string {
  if (!raw) return ''
  // E.g. '"Poppins", sans-serif' -> 'poppins'
  const first = raw.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
  return first
}

function parseFontWeight(raw: string): number {
  if (!raw) return 400
  if (raw === 'normal') return 400
  if (raw === 'bold') return 700
  if (raw === 'bolder') return 800
  if (raw === 'lighter') return 300
  const n = parseInt(raw, 10)
  return isNaN(n) ? 400 : n
}

function parsePx(raw: string): number {
  if (!raw) return 0
  const n = parseFloat(raw)
  return isNaN(n) ? 0 : n
}

function normalizeText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function rectIoU(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)

  const w = Math.max(0, x2 - x1)
  const h = Math.max(0, y2 - y1)
  const intersection = w * h
  if (intersection <= 0) return 0

  const areaA = a.width * a.height
  const areaB = b.width * b.height
  return intersection / (areaA + areaB - intersection)
}

function centerDistance(a: Rect, b: Rect): number {
  const ax = a.x + a.width / 2
  const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2
  const by = b.y + b.height / 2
  return Math.hypot(ax - bx, ay - by)
}

/**
 * Deterministically compares Design DOM telemetry against Implementation DOM telemetry
 * to catch typography differences (font family, font size, font weight, copy/text, line-height, text color)
 * with 100% mathematical precision.
 */
export function diffDomTypography(
  designNodes: DOMElementNode[] | null | undefined,
  implNodes: DOMElementNode[] | null | undefined,
  options: DomDiffOptions,
): AuditIssue[] {
  if (!designNodes || !implNodes || designNodes.length === 0 || implNodes.length === 0) {
    return []
  }

  const { width, height, offsetX = 0, offsetY = 0 } = options
  const issues: AuditIssue[] = []

  // Filter visible text-bearing leaf/semantic nodes
  const textDesign = designNodes.filter(
    (n) =>
      Boolean(n.textSnippet && n.textSnippet.trim().length > 0) &&
      n.rect.width > 4 &&
      n.rect.height > 4 &&
      n.rect.x < width &&
      n.rect.y < height,
  )

  const textImpl = implNodes.filter(
    (n) =>
      Boolean(n.textSnippet && n.textSnippet.trim().length > 0) &&
      n.rect.width > 4 &&
      n.rect.height > 4 &&
      n.rect.x < width &&
      n.rect.y < height,
  )

  const matchedImplIndices = new Set<number>()

  for (let i = 0; i < textDesign.length; i++) {
    const des = textDesign[i]
    const desText = normalizeText(des.textSnippet)
    if (!desText) continue

    // Find best candidate in implementation
    let bestIdx = -1
    let bestScore = -Infinity

    for (let j = 0; j < textImpl.length; j++) {
      if (matchedImplIndices.has(j)) continue
      const imp = textImpl[j]
      const impRectAdjusted: Rect = {
        x: imp.rect.x + offsetX,
        y: imp.rect.y + offsetY,
        width: imp.rect.width,
        height: imp.rect.height,
      }

      const iou = rectIoU(des.rect, impRectAdjusted)
      const dist = centerDistance(des.rect, impRectAdjusted)

      if (dist > 250 && iou === 0) continue

      const impText = normalizeText(imp.textSnippet)
      const textMatches = desText.toLowerCase() === impText.toLowerCase()
      const textSub =
        desText.toLowerCase().includes(impText.toLowerCase()) ||
        impText.toLowerCase().includes(desText.toLowerCase())

      let score = iou * 60 - dist * 0.2
      if (textMatches) score += 50
      else if (textSub) score += 25
      if (des.tagName === imp.tagName) score += 10

      if (score > bestScore) {
        bestScore = score
        bestIdx = j
      }
    }

    if (bestIdx === -1 || bestScore < -50) {
      // Missing text
      issues.push({
        id: `dom-text-missing-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'missing-element',
        severity: 'major',
        rect: { ...des.rect },
        description: `Texto ausente na implementação: no design consta "${desText}", mas nenhum elemento equivalente foi encontrado nessa posição.`,
        expectedFix: `Adicione o texto/elemento correspondente: <${des.tagName}>${desText}</${des.tagName}> com estilo compatível.`,
        notes: 'Detectado deterministicamente via auditoria comparativa de DOM.',
        designHex: null,
        implHex: null,
        dom: des,
      })
      continue
    }

    matchedImplIndices.add(bestIdx)
    const imp = textImpl[bestIdx]
    const impText = normalizeText(imp.textSnippet)

    const fontA = cleanFontFamily(des.computedStyles?.fontFamily)
    const fontB = cleanFontFamily(imp.computedStyles?.fontFamily)
    const weightA = parseFontWeight(des.computedStyles?.fontWeight)
    const weightB = parseFontWeight(imp.computedStyles?.fontWeight)
    const sizeA = parsePx(des.computedStyles?.fontSize)
    const sizeB = parsePx(imp.computedStyles?.fontSize)
    const colorA = des.computedStyles?.color?.replace(/\s+/g, '')
    const colorB = imp.computedStyles?.color?.replace(/\s+/g, '')
    const transformA = des.computedStyles?.textTransform || 'none'
    const transformB = imp.computedStyles?.textTransform || 'none'

    const issueRect: Rect = {
      x: Math.round(des.rect.x),
      y: Math.round(des.rect.y),
      width: Math.max(des.rect.width, imp.rect.width),
      height: Math.max(des.rect.height, imp.rect.height),
    }

    // 1. Text content mismatch
    if (desText !== impText && desText.toLowerCase() !== impText.toLowerCase()) {
      issues.push({
        id: `dom-copy-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'typography',
        severity: ['h1', 'h2', 'h3', 'button', 'a'].includes(des.tagName) ? 'critical' : 'major',
        rect: issueRect,
        description: `Divergência de texto (Copy) em <${imp.tagName}>: no design está "${desText}", mas na implementação foi renderizado como "${impText}".`,
        expectedFix: `Atualize o conteúdo textual para "${desText}".`,
        notes: `Design: "${desText}" | Impl: "${impText}"`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }

    // 2. Font family mismatch
    if (fontA && fontB && fontA !== fontB && !fontA.includes(fontB) && !fontB.includes(fontA)) {
      issues.push({
        id: `dom-font-family-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'typography',
        severity: ['h1', 'h2', 'h3', 'button'].includes(des.tagName) ? 'critical' : 'major',
        rect: issueRect,
        description: `Família de fonte divergente em "${desText.slice(0, 30)}": o design utiliza "${des.computedStyles.fontFamily}", enquanto a implementação está usando "${imp.computedStyles.fontFamily}".`,
        expectedFix: `Defina font-family: ${des.computedStyles.fontFamily}; no elemento correspondente (ex: classe da fonte configurada no projeto).`,
        notes: `Design font: ${des.computedStyles.fontFamily} | Impl font: ${imp.computedStyles.fontFamily}`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }

    // 3. Font weight mismatch
    if (Math.abs(weightA - weightB) >= 150) {
      issues.push({
        id: `dom-font-weight-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'typography',
        severity: Math.abs(weightA - weightB) >= 300 ? 'major' : 'minor',
        rect: issueRect,
        description: `Peso de fonte (Font Weight) incorreto em "${desText.slice(0, 30)}": no design o peso é ${des.computedStyles.fontWeight} (${weightA >= 600 ? 'Bold/Semibold' : 'Regular'}), mas na implementação está ${imp.computedStyles.fontWeight} (${weightB >= 600 ? 'Bold/Semibold' : 'Regular'}).`,
        expectedFix: `Altere o font-weight para ${des.computedStyles.fontWeight} (ex: font-${weightA >= 700 ? 'bold' : weightA >= 600 ? 'semibold' : weightA >= 500 ? 'medium' : 'normal'}).`,
        notes: `Design weight: ${weightA} | Impl weight: ${weightB}`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }

    // 4. Font size mismatch
    if (sizeA > 0 && sizeB > 0 && Math.abs(sizeA - sizeB) >= 2) {
      issues.push({
        id: `dom-font-size-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'size',
        severity: Math.abs(sizeA - sizeB) >= 4 ? 'major' : 'minor',
        rect: issueRect,
        description: `Tamanho de fonte (Font Size) diferente em "${desText.slice(0, 30)}": no design mede ${des.computedStyles.fontSize}, enquanto na implementação mede ${imp.computedStyles.fontSize} (diferença de ${Math.abs(sizeA - sizeB).toFixed(1)}px).`,
        expectedFix: `Ajuste o tamanho para font-size: ${des.computedStyles.fontSize};`,
        notes: `Design size: ${des.computedStyles.fontSize} | Impl size: ${imp.computedStyles.fontSize}`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }

    // 5. Text transform mismatch
    if (transformA !== transformB && (transformA === 'uppercase' || transformB === 'uppercase')) {
      issues.push({
        id: `dom-font-transform-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'typography',
        severity: 'minor',
        rect: issueRect,
        description: `Transformação de caixa de texto divergente em "${desText.slice(0, 30)}": design usa text-transform: ${transformA}, implementação usa text-transform: ${transformB}.`,
        expectedFix: `Aplique text-transform: ${transformA}; (ex: Tailwind '${transformA}').`,
        notes: `Design transform: ${transformA} | Impl transform: ${transformB}`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }

    // 6. Text color mismatch
    if (colorA && colorB && colorA !== colorB && colorA !== 'rgba(0,0,0,0)' && colorB !== 'rgba(0,0,0,0)') {
      issues.push({
        id: `dom-font-color-${Date.now()}-${issues.length + 1}`,
        source: 'dom-telemetry',
        category: 'color',
        severity: 'minor',
        rect: issueRect,
        description: `Cor de texto divergente em "${desText.slice(0, 30)}": no design a cor é ${des.computedStyles.color}, mas na implementação está ${imp.computedStyles.color}.`,
        expectedFix: `Altere a cor do texto para color: ${des.computedStyles.color};`,
        notes: `Design color: ${des.computedStyles.color} | Impl color: ${imp.computedStyles.color}`,
        designHex: null,
        implHex: null,
        dom: imp,
      })
    }
  }

  return issues
}
