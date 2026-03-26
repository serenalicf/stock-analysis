import { useState, useEffect, useCallback } from 'react'
import { Header }       from './components/Header'
import { SearchBar }    from './components/SearchBar'
import { WatchlistBar } from './components/WatchlistBar'
import { TickerGrid }   from './components/TickerGrid'
import { ComparePanel } from './components/ComparePanel'
import { useTheme }        from './hooks/useTheme'
import { useWatchlist }    from './hooks/useWatchlist'
import { useScoreHistory } from './hooks/useScoreHistory'
import { analyzeTickers }  from './api/analyze'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { watchlist, add: addToWatchlist, remove: removeFromWatchlist } = useWatchlist()
  const { recordResults, getHistory } = useScoreHistory()

  // Persistent map: ticker → result object
  // New searches MERGE into this map; existing cards stay
  const [resultsMap, setResultsMap] = useState({})  // { AAPL: {...}, META: {...} }
  const [tickerOrder, setTickerOrder] = useState([]) // preserve insertion order

  const [loading, setLoading]   = useState(false)
  const [status,  setStatus]    = useState('')
  const [clock,   setClock]     = useState('')

  const [compareLeft,  setCompareLeft]  = useState(null)
  const [compareRight, setCompareRight] = useState(null)
  const [compareOpen,  setCompareOpen]  = useState(false)

  // Clock
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString('en-US', { hour12: false }) + ' EST'
    )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Analyze ──────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (tickers) => {
    if (!tickers.length) return
    const unique = [...new Set(tickers.map(t => t.toUpperCase().trim()))].filter(Boolean).slice(0, 20)
    setLoading(true)
    setStatus(`Fetching ${unique.join(', ')} …`)

    try {
      const data = await analyzeTickers(unique)
      recordResults(data)

      // Merge new results into map; new tickers go to the front
      setResultsMap(prev => {
        const next = { ...prev }
        data.forEach(r => { next[r.ticker] = r })
        return next
      })
      setTickerOrder(prev => {
        const existing = new Set(prev)
        const newOnes  = unique.filter(t => !existing.has(t))
        return [...newOnes, ...prev]  // new cards appear at top-left
      })

      const ok  = data.filter(r => !r.error).length
      const err = data.length - ok
      setStatus(`✓ ${ok} ticker${ok !== 1 ? 's' : ''} analyzed${err ? ` · ${err} failed` : ''} · ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setStatus(`✗ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [recordResults])

  // ── Close a single ticker card ────────────────────────────────────────────
  const handleCloseCard = useCallback((ticker) => {
    setResultsMap(prev => {
      const next = { ...prev }
      delete next[ticker]
      return next
    })
    setTickerOrder(prev => prev.filter(t => t !== ticker))
  }, [])

  // ── Close all cards ───────────────────────────────────────────────────────
  const handleCloseAll = useCallback(() => {
    setResultsMap({})
    setTickerOrder([])
    setStatus('')
  }, [])

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const handleWatchlistToggle = useCallback((ticker) => {
    if (watchlist.includes(ticker)) removeFromWatchlist(ticker)
    else addToWatchlist(ticker)
  }, [watchlist, addToWatchlist, removeFromWatchlist])

  // ── Compare ───────────────────────────────────────────────────────────────
  const handleCompare = useCallback((ticker) => {
    const result = resultsMap[ticker]
    if (!result) return
    setCompareOpen(true)
    if (!compareLeft) {
      setCompareLeft(result)
    } else if (!compareRight && compareLeft.ticker !== ticker) {
      setCompareRight(result)
    } else {
      setCompareLeft(result)
      setCompareRight(compareLeft)
    }
  }, [resultsMap, compareLeft, compareRight])

  const handleClearCompare = useCallback(() => {
    setCompareLeft(null)
    setCompareRight(null)
  }, [])

  // Build ordered results array
  const results = tickerOrder.map(t => resultsMap[t]).filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header theme={theme} onToggleTheme={toggleTheme} clock={clock} />

      <WatchlistBar
        watchlist={watchlist}
        onRemove={removeFromWatchlist}
        onAnalyze={handleAnalyze}
      />

      <SearchBar onAnalyze={handleAnalyze} loading={loading} />

      <TickerGrid
        results={results}
        loading={loading}
        status={status}
        watchlist={watchlist}
        onWatchlistToggle={handleWatchlistToggle}
        onCompare={handleCompare}
        onCloseCard={handleCloseCard}
        onCloseAll={handleCloseAll}
        getHistory={getHistory}
      />

      {compareOpen && (
        <>
          <div
            onClick={() => setCompareOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                     zIndex: 499, animation: 'fadeIn 0.2s ease' }}
          />
          <ComparePanel
            left={compareLeft}
            right={compareRight}
            onClear={handleClearCompare}
            onClose={() => setCompareOpen(false)}
          />
        </>
      )}
    </div>
  )
}
