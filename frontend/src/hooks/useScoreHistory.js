import { useCallback } from 'react'

const KEY = 'signal-score-history'
const MAX_POINTS = 30 // keep last 30 data points per ticker

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} }
  catch { return {} }
}

function saveAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function useScoreHistory() {
  const recordResults = useCallback((results) => {
    const all = loadAll()
    const now = new Date().toISOString()

    results.forEach(r => {
      if (r.error || !r.ticker) return
      if (!all[r.ticker]) all[r.ticker] = []
      all[r.ticker].push({
        ts: now,
        score: r.score,
        signal: r.signal,
        technicals:  r.breakdown?.technicals,
        trend:       r.breakdown?.trend,
        sr:          r.breakdown?.support_resistance,
        analyst:     r.breakdown?.analyst,
        sentiment:   r.breakdown?.sentiment,
      })
      // keep only last MAX_POINTS
      if (all[r.ticker].length > MAX_POINTS)
        all[r.ticker] = all[r.ticker].slice(-MAX_POINTS)
    })

    saveAll(all)
  }, [])

  const getHistory = useCallback((ticker) => {
    const all = loadAll()
    return (all[ticker] || []).map(p => ({
      ...p,
      label: new Date(p.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time:  new Date(p.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }))
  }, [])

  const clearHistory = useCallback((ticker) => {
    const all = loadAll()
    if (ticker) delete all[ticker]
    else Object.keys(all).forEach(k => delete all[k])
    saveAll(all)
  }, [])

  return { recordResults, getHistory, clearHistory }
}
