import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_STORAGE_JSON = 8 * 1024

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function parseStorageParam(raw: string | null): Record<string, string> {
  if (!raw?.trim()) return {}
  if (raw.length > MAX_STORAGE_JSON) {
    throw new HttpError(400, '"storage" JSON is too large')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpError(400, '"storage" must be valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, '"storage" must be a JSON object')
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 256) continue
    out[key] = String(value)
  }
  return out
}

function assertAllowedTargetUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new HttpError(400, 'Invalid "url" parameter')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only http(s) targets are allowed')
  }
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
    throw new HttpError(400, 'Loopback targets must be loaded directly, not through the live proxy')
  }
  return parsed
}

function buildProxyUrl(target: URL): string {
  const params = new URLSearchParams()
  params.set('url', target.toString())
  return `/api/live-proxy?${params.toString()}`
}

function resolveRelativeUrl(pageUrl: URL, raw: string): URL | null {
  const trimmed = raw.trim()
  if (
    trimmed === '' ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:')
  ) {
    return null
  }
  try {
    return new URL(trimmed, pageUrl)
  } catch {
    return null
  }
}

function shouldRewriteToProxy(resolved: URL, pageOrigin: string): boolean {
  return resolved.origin === pageOrigin
}

function rewriteHtmlForProxy(html: string, pageUrl: URL, storage: Record<string, string>): string {
  const injectSnippet = buildStorageInjectScript(storage)
  const withStorage =
    injectSnippet.length > 0
      ? html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${injectSnippet}`)
      : html

  const attrPattern = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  return withStorage.replace(attrPattern, (full, attr: string, dq?: string, sq?: string, bare?: string) => {
    const value = dq ?? sq ?? bare ?? ''
    const resolved = resolveRelativeUrl(pageUrl, value)
    if (!resolved || !shouldRewriteToProxy(resolved, pageUrl.origin)) {
      return full
    }
    const proxied = buildProxyUrl(resolved)
    const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : '"'
    return `${attr}=${quote}${proxied}${quote}`
  })
}

function buildStorageInjectScript(storage: Record<string, string>): string {
  if (Object.keys(storage).length === 0) return ''
  const payload = JSON.stringify(storage).replace(/</g, '\\u003c')
  return `<script id="pixel-audit-live-storage">(function(){try{var d=${payload};for(var k in d){if(Object.prototype.hasOwnProperty.call(d,k))localStorage.setItem(k,String(d[k]));}}catch(e){}})();</script>`
}

async function fetchUpstream(target: URL, req: IncomingMessage): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: req.headers.accept?.toString() ?? '*/*',
    'Accept-Language': req.headers['accept-language']?.toString() ?? 'en',
    'User-Agent':
      req.headers['user-agent']?.toString() ??
      'Mozilla/5.0 (compatible; PixelAudit2Prompt/1.0; +live-proxy)',
  }
  if (req.headers.cookie) headers.Cookie = req.headers.cookie.toString()

  const response = await fetch(target.toString(), {
    method: 'GET',
    headers,
    redirect: 'follow',
  })
  return response
}

export async function handleLiveProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    sendText(res, 405, 'Use GET /api/live-proxy')
    return
  }

  try {
    const requestUrl = new URL(req.url ?? '/', 'http://pixel-audit.local')
    const targetRaw = requestUrl.searchParams.get('url')
    if (!targetRaw?.trim()) {
      throw new HttpError(400, 'Query parameter "url" is required')
    }

    const target = assertAllowedTargetUrl(targetRaw.trim())
    const storage = parseStorageParam(requestUrl.searchParams.get('storage'))

    const upstream = await fetchUpstream(target, req)
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'

    res.statusCode = upstream.status
    res.setHeader('Cache-Control', 'no-store')

    const passHeaders = ['content-type', 'content-length', 'etag', 'last-modified']
    for (const name of passHeaders) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    const isHtml = contentType.includes('text/html')
    if (!isHtml) {
      const buffer = Buffer.from(await upstream.arrayBuffer())
      res.end(buffer)
      return
    }

    let html = await upstream.text()
    if (upstream.ok) {
      html = rewriteHtmlForProxy(html, target, storage)
    }
    const out = Buffer.from(html, 'utf8')
    res.setHeader('Content-Type', contentType.includes('charset') ? contentType : 'text/html; charset=utf-8')
    res.setHeader('Content-Length', String(out.length))
    res.end(out)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Live proxy error'
    console.error(`[pixel-audit] live-proxy failed: ${message}`)
    sendText(res, status, message)
  }
}
