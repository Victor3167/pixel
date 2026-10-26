import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chromium, errors, type Browser } from 'playwright'
import { defineConfig, type Plugin } from 'vite'
import { handleLiveProxy } from './server/liveProxy.ts'
import type {
  CaptureRequest,
  CaptureResponse,
  DOMElementNode,
} from './src/types/audit.ts'

/* ========================================================================== */
/*  Zero-config Playwright middleware  ->  POST /api/capture                  */
/* ========================================================================== */

const SCROLLBAR_CSS =
  '::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }'

const MAX_DOM_NODES = 2500
const MAX_BODY_BYTES = 64 * 1024

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/* ---------------------------- Browser singleton --------------------------- */

let browserPromise: Promise<Browser> | null = null

/**
 * Returns one long-lived headless Chromium. Subsequent captures only pay for a
 * fresh BrowserContext (≈ a few ms) instead of a full browser launch.
 */
function resolveChromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN
  }
  const candidatePaths = [
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ]
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = resolveChromiumPath()
    const launching = chromium
      .launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--force-color-profile=srgb',
          '--hide-scrollbars',
        ],
      })
      .then((browser) => {
        browser.on('disconnected', () => {
          if (browserPromise === launching) browserPromise = null
        })
        return browser
      })
      .catch((error: unknown) => {
        if (browserPromise === launching) browserPromise = null
        throw error
      })
    browserPromise = launching
  }
  return browserPromise
}

async function closeBrowser(): Promise<void> {
  const current = browserPromise
  browserPromise = null
  if (!current) return
  try {
    await (await current).close()
  } catch {
    /* already closed */
  }
}

/* ------------------------------ Request utils ----------------------------- */

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

function validateRequest(input: unknown): CaptureRequest {
  if (typeof input !== 'object' || input === null) {
    throw new HttpError(400, 'Body must be a JSON object')
  }
  const body = input as Record<string, unknown>

  if (typeof body.url !== 'string' || body.url.trim() === '') {
    throw new HttpError(400, '"url" is required')
  }
  let parsed: URL
  try {
    parsed = new URL(body.url.trim())
  } catch {
    throw new HttpError(400, `"${body.url}" is not a valid URL`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only http(s) URLs can be captured')
  }

  const rawW = Number(body.width)
  const width = Number.isInteger(rawW) && rawW >= 1 && rawW <= 8192 ? rawW : 1280
  const rawH = Number(body.height)
  const height = Number.isInteger(rawH) && rawH >= 1 && rawH <= 8192 ? rawH : 800
  const rawDsf = Number(body.deviceScaleFactor)
  const deviceScaleFactor = Number.isFinite(rawDsf) && rawDsf >= 0.25 && rawDsf <= 4 ? rawDsf : 1

  const waitForMs = body.waitForMs === undefined ? 0 : Number(body.waitForMs)
  if (!Number.isFinite(waitForMs) || waitForMs < 0 || waitForMs > 30_000) {
    throw new HttpError(400, '"waitForMs" must be between 0 and 30000')
  }

  const rawScrollY = body.scrollY === undefined ? 0 : Number(body.scrollY)
  if (!Number.isFinite(rawScrollY) || rawScrollY < 0 || rawScrollY > 500_000) {
    throw new HttpError(400, '"scrollY" must be between 0 and 500000')
  }

  return {
    url: parsed.toString(),
    width,
    height,
    deviceScaleFactor,
    selector: typeof body.selector === 'string' ? body.selector.trim() : '',
    waitForMs,
    hideScrollbars: body.hideScrollbars !== false,
    localStorage:
      typeof body.localStorage === 'object' && body.localStorage !== null
        ? (body.localStorage as Record<string, string>)
        : undefined,
    scrollY: Math.round(rawScrollY),
  }
}

/* --------------------------- DOM telemetry (page) -------------------------- */

interface TelemetryOptions {
  max: number
  /** true: coordinates are relative to the viewport, false: to the root box. */
  viewport: boolean
}

/**
 * Runs INSIDE the page. Must be fully self-contained (no outer references).
 * Walks the visible subtree of `root` and returns element metadata with rects
 * relative to the captured region.
 */
const extractDomTelemetry = (root: Element, opts: TelemetryOptions): DOMElementNode[] => {
  const SKIP = new Set([
    'SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'BR', 'WBR', 'BASE',
  ])
  const round = (n: number) => Math.round(n * 100) / 100

  const rootRect = root.getBoundingClientRect()
  const originX = opts.viewport ? 0 : rootRect.left
  const originY = opts.viewport ? 0 : rootRect.top
  const regionW = opts.viewport ? window.innerWidth : rootRect.width
  const regionH = opts.viewport ? window.innerHeight : rootRect.height

  const candidates: Element[] = [root, ...Array.from(root.querySelectorAll('*'))]
  const result: DOMElementNode[] = []

  for (const el of candidates) {
    if (result.length >= opts.max) break
    if (SKIP.has(el.tagName)) continue

    const cs = window.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue

    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue

    const x = r.left - originX
    const y = r.top - originY
    if (x + r.width <= 0 || y + r.height <= 0 || x >= regionW || y >= regionH) continue

    let depth = 0
    for (let p: Element | null = el; p && p !== root; p = p.parentElement) depth++

    let ownText = ''
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) ownText += child.textContent ?? ''
    }
    const textSnippet = ownText.replace(/\s+/g, ' ').trim().slice(0, 40)

    const sides = ['Top', 'Right', 'Bottom', 'Left']
    const boxSides = (prefix: 'padding' | 'margin') =>
      cs.getPropertyValue(prefix) ||
      sides.map((s) => cs.getPropertyValue(`${prefix}-${s.toLowerCase()}`)).join(' ')
    const borderValue = (() => {
      if (cs.border) return cs.border
      const perSide = sides.map((s) => {
        const style = cs.getPropertyValue(`border-${s.toLowerCase()}-style`)
        const width = cs.getPropertyValue(`border-${s.toLowerCase()}-width`)
        const color = cs.getPropertyValue(`border-${s.toLowerCase()}-color`)
        return `${width} ${style} ${color}`
      })
      return perSide.every((v) => v === perSide[0])
        ? perSide[0]
        : sides.map((s, i) => `${s.toLowerCase()}: ${perSide[i]}`).join('; ')
    })()
    const radiusValue =
      cs.borderRadius ||
      ['top-left', 'top-right', 'bottom-right', 'bottom-left']
        .map((c) => cs.getPropertyValue(`border-${c}-radius`))
        .join(' ')

    result.push({
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      className: (el.getAttribute('class') ?? '').trim(),
      textSnippet,
      rect: { x: round(x), y: round(y), width: round(r.width), height: round(r.height) },
      depth,
      computedStyles: {
        display: cs.display,
        position: cs.position,
        width: cs.width,
        height: cs.height,
        padding: boxSides('padding'),
        margin: boxSides('margin'),
        gap: cs.gap,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderRadius: radiusValue,
        border: borderValue,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
      },
    })
  }
  return result
}

/* ------------------------------- Capture core ----------------------------- */

function readPngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

async function capture(request: CaptureRequest): Promise<CaptureResponse> {
  const startedAt = Date.now()
  const warnings: string[] = []
  const browser = await getBrowser()

  // One isolated context per request: no cookies / cache bleed between captures.
  const context = await browser.newContext({
    viewport: { width: request.width, height: request.height },
    deviceScaleFactor: request.deviceScaleFactor,
    reducedMotion: 'reduce',
  })

  try {
    const page = await context.newPage()

    // Auto-inject prototype authentication or custom localStorage items
    const storageToInject: Record<string, string> = {
      ...(request.url.includes('lojasilvasalesdesign.bisws.com.br') ? { 'loja-base-proto-auth': 'true' } : {}),
      ...(request.localStorage || {}),
    }
    if (Object.keys(storageToInject).length > 0) {
      await page.addInitScript((items) => {
        try {
          for (const [k, v] of Object.entries(items)) {
            window.localStorage.setItem(k, String(v))
          }
        } catch {
          /* ignore */
        }
      }, storageToInject)
    }

    try {
      await page.goto(request.url, { waitUntil: 'networkidle', timeout: 20_000 })
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        warnings.push('Page never reached "networkidle" within 20s; captured the current state.')
      } else {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
        const hint = /ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT|ERR_ADDRESS_UNREACHABLE/.test(message)
          ? ' — o servidor não alcança essa URL. Se a página B roda no seu computador, inicie-a escutando na rede (ex: `--host 0.0.0.0`) e libere a porta no firewall.'
          : ''
        throw new HttpError(502, `Could not open ${request.url}: ${message}${hint}`)
      }
    }

    if (request.hideScrollbars !== false) {
      await page.addStyleTag({ content: SCROLLBAR_CSS })
    }

    // Guarantee web fonts are fully rendered before measuring / shooting.
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    if (request.waitForMs && request.waitForMs > 0) {
      await page.waitForTimeout(request.waitForMs)
    }

    const scrollY = request.scrollY ?? 0
    if (scrollY > 0) {
      await page.evaluate((y) => {
        window.scrollTo(0, y)
      }, scrollY)
      await page.waitForTimeout(120)
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
    }

    const selector = request.selector?.trim() ?? ''
    let png: Buffer
    let domMap: DOMElementNode[]
    let boundingBox: CaptureResponse['boundingBox'] = null

    if (selector !== '') {
      const locator = page.locator(selector).first()
      try {
        await locator.waitFor({ state: 'visible', timeout: 5_000 })
      } catch {
        throw new HttpError(422, `Selector "${selector}" was not found or is not visible`)
      }
      boundingBox = await locator.boundingBox()
      domMap = await locator.evaluate(extractDomTelemetry, { max: MAX_DOM_NODES, viewport: false })
      png = await locator.screenshot({ animations: 'disabled', type: 'png', caret: 'hide' })
    } else {
      domMap = await page
        .locator('body')
        .evaluate(extractDomTelemetry, { max: MAX_DOM_NODES, viewport: true })
      png = await page.screenshot({
        fullPage: false,
        animations: 'disabled',
        type: 'png',
        caret: 'hide',
      })
    }

    const size = readPngSize(png)
    const dsf = request.deviceScaleFactor
    return {
      imageBase64: `data:image/png;base64,${png.toString('base64')}`,
      domMap,
      capturedWidth: Math.round((size.width / dsf) * 100) / 100,
      capturedHeight: Math.round((size.height / dsf) * 100) / 100,
      imageWidth: size.width,
      imageHeight: size.height,
      deviceScaleFactor: dsf,
      boundingBox,
      durationMs: Date.now() - startedAt,
      warnings,
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

function normalizeIp(ip: string | undefined): string {
  return (ip ?? '').trim().replace(/^::ffff:/, '')
}

function isLoopbackIp(ip: string): boolean {
  return ip === '' || ip === '::1' || ip === 'localhost' || ip.startsWith('127.')
}

/** IP of the browser that is using the app (honours reverse proxies such as Coolify/Traefik). */
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]
  return normalizeIp(first) || normalizeIp(req.socket.remoteAddress)
}

/**
 * When the app runs on a remote server (Coolify), "localhost" in the capture URL
 * would point to the server container itself. Map it to the machine of the user
 * that is operating the app (or to CAPTURE_LOCALHOST_HOST when configured).
 */
function resolveCaptureUrl(rawUrl: string, req: IncomingMessage): string {
  const parsed = new URL(rawUrl)
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return rawUrl

  const override = process.env.CAPTURE_LOCALHOST_HOST?.trim()
  const target = override || getClientIp(req)
  if (!target || isLoopbackIp(target)) return rawUrl

  parsed.hostname = target
  return parsed.toString()
}

async function handleCapture(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Use POST /api/capture' })
    return
  }
  try {
    const payload = validateRequest(await readJsonBody(req))
    const requestedUrl = payload.url
    payload.url = resolveCaptureUrl(payload.url, req)
    if (payload.url !== requestedUrl) {
      console.log(`[pixel-audit] loopback target remapped: ${requestedUrl} -> ${payload.url}`)
    }
    const result = await capture(payload)
    console.log(
      `[pixel-audit] ${payload.url} ${payload.width}x${payload.height}@${payload.deviceScaleFactor}x` +
      `${payload.selector ? ` ${payload.selector}` : ''} -> ${result.durationMs}ms, ${result.domMap.length} nodes`,
    )
    sendJson(res, 200, result)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    let message = error instanceof Error ? error.message.split('\n')[0] : 'Unknown capture error'
    if (/Executable doesn't exist|browserType\.launch/.test(message)) {
      message = 'Chromium is not installed. Run: pnpm exec playwright install chromium'
    }
    console.error(`[pixel-audit] capture failed: ${message}`)
    sendJson(res, status, { error: message })
  }
}

function pixelAuditCapture(): Plugin {
  return {
    name: 'pixel-audit:capture',
    configureServer(server) {
      server.middlewares.use('/api/live-proxy', (req, res) => {
        void handleLiveProxy(req, res)
      })
      server.middlewares.use('/api/capture', (req, res) => {
        void handleCapture(req, res)
      })
      // Warm the singleton so the first capture is as fast as the rest.
      getBrowser().catch((error: unknown) => {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
        console.warn(`[pixel-audit] Could not pre-launch Chromium: ${message}`)
      })
      server.httpServer?.once('close', () => void closeBrowser())
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/live-proxy', (req, res) => {
        void handleLiveProxy(req, res)
      })
      server.middlewares.use('/api/capture', (req, res) => {
        void handleCapture(req, res)
      })
      server.httpServer.once('close', () => void closeBrowser())
    },
  }
}

const anythingLlmTarget =
  process.env.ANYTHINGLLM_URL ||
  process.env.VITE_ANYTHINGLLM_URL ||
  process.env.VITE_ANYTHINGLLM_BASE_URL ||
  'http://127.0.0.1:3001/api/v1'

const proxyConfig = {
  '/api/anythingllm': {
    target: anythingLlmTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/anythingllm/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pixelAuditCapture()],
  server: {
    proxy: proxyConfig,
  },
  preview: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    allowedHosts: true,
    proxy: proxyConfig,
  },
})
