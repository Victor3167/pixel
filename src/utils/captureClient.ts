import type { CaptureErrorResponse, CaptureRequest, CaptureResponse } from '../types/audit'

/** Calls the Vite middleware (`POST /api/capture`) backed by Playwright. */
export async function captureLocalhost(request: CaptureRequest, signal?: AbortSignal): Promise<CaptureResponse> {
  let response: Response
  try {
    response = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Could not reach the capture endpoint. Is `pnpm dev` running?')
  }

  const payload = (await response.json().catch(() => null)) as CaptureResponse | CaptureErrorResponse | null
  if (!response.ok || !payload || 'error' in payload) {
    const message = payload && 'error' in payload ? payload.error : `Capture failed (HTTP ${response.status})`
    throw new Error(message)
  }
  return payload
}
