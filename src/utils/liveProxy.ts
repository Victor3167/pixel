/** Default localStorage keys for known reference hosts (mirrors Playwright capture). */
export function defaultReferenceLocalStorage(pageUrl: string): Record<string, string> {
  if (pageUrl.includes('lojasilvasalesdesign.bisws.com.br')) {
    return { 'loja-base-proto-auth': 'true' }
  }
  return {}
}

export function mergeReferenceLocalStorage(
  pageUrl: string,
  fromSettings?: Record<string, string> | null,
): Record<string, string> {
  return {
    ...defaultReferenceLocalStorage(pageUrl),
    ...(fromSettings ?? {}),
  }
}

/** Remote reference pages need the dev proxy so we can inject localStorage before the SPA boots. */
export function shouldUseLiveProxyForReference(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    return true
  } catch {
    return false
  }
}

export function buildLiveProxyFrameUrl(
  absolutePageUrl: string,
  localStorageItems: Record<string, string>,
): string {
  const params = new URLSearchParams()
  params.set('url', absolutePageUrl)
  if (Object.keys(localStorageItems).length > 0) {
    params.set('storage', JSON.stringify(localStorageItems))
  }
  return `/api/live-proxy?${params.toString()}`
}
