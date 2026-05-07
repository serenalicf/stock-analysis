/**
 * analyze.js
 * ==========
 * Smart API layer with two strategies:
 *
 *   analyzeStream(tickers, callbacks)
 *     Uses /analyze/stream (SSE). Calls onPartial() as each section arrives
 *     so the UI can render progressively. Calls onComplete() when a ticker's
 *     score is ready. Calls onDone() when all tickers finish.
 *     Use this for first-time / uncached fetches.
 *
 *   analyzeTickers(tickers)
 *     Uses POST /analyze (classic JSON). Returns the full array at once.
 *     Use this when results are already cached (instant response).
 */

const BASE = import.meta.env.VITE_API_URL || ''

// ── Classic batch endpoint ────────────────────────────────────────────────────

export async function analyzeTickers(tickers) {
  const res = await fetch(`${BASE}/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ tickers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }
  return res.json()
}

// ── SSE streaming endpoint ────────────────────────────────────────────────────

/**
 * analyzeStream(tickers, callbacks)
 *
 * callbacks = {
 *   onPartial(ticker, section, data)  — called when a section arrives
 *                                       section = 'sentiment' | 'support_resistance'
 *   onComplete(result)                — called with full AnalysisResult for a ticker
 *   onError(ticker, message)          — called if a ticker fetch fails
 *   onDone()                          — called when all tickers are finished
 * }
 *
 * Returns a cleanup function — call it to abort the stream.
 */
export function analyzeStream(tickers, { onPartial, onComplete, onError, onDone }) {
  const params = new URLSearchParams({ tickers: tickers.join(',') })
  const url    = `${BASE}/analyze/stream?${params}`

  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Stream error ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by double newline
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''   // last incomplete frame stays in buffer

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(':')) continue   // keep-alive

          const eventMatch = frame.match(/^event:\s*(.+)$/m)
          const dataMatch  = frame.match(/^data:\s*(.+)$/m)
          if (!dataMatch) continue

          const eventType = eventMatch?.[1]?.trim() ?? 'message'
          let payload
          try {
            payload = JSON.parse(dataMatch[1])
          } catch {
            continue
          }

          switch (eventType) {
            case 'partial':
              onPartial?.(payload.ticker, payload.section, payload)
              break
            case 'complete':
              onComplete?.(payload)
              break
            case 'error':
              onError?.(payload.ticker, payload.error)
              break
            case 'done':
              onDone?.()
              break
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Stream error:', err)
        onError?.('*', err.message)
        onDone?.()
      }
    }
  })()

  return () => controller.abort()
}

// ── Smart router ──────────────────────────────────────────────────────────────

/**
 * analyzeAuto(tickers, callbacks)
 *
 * Automatically chooses the right strategy:
 *   - All tickers cached → POST /analyze (returns instantly)
 *   - Any ticker uncached → SSE stream (progressive rendering)
 *
 * callbacks are the same as analyzeStream, plus:
 *   onBatch(results)  — called with full array when using the batch path
 */
export async function analyzeAuto(tickers, callbacks) {
  // Check cache status via a lightweight health call isn't practical from
  // the frontend, so always use streaming for real fetches — the server
  // uses its in-memory cache either way and the SSE stream returns
  // immediately for cached tickers.
  return analyzeStream(tickers, callbacks)
}
