const BASE = import.meta.env.VITE_API_URL || ''

export async function analyzeTickers(tickers) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }
  return res.json()
}

export async function healthCheck() {
  const res = await fetch(`${BASE}/health`)
  return res.ok
}
