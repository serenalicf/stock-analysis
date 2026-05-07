import { useState, useEffect, useCallback, useRef } from 'react'
import { Header }       from './components/Header'
import { SearchBar }    from './components/SearchBar'
import { WatchlistBar } from './components/WatchlistBar'
import { TickerGrid }   from './components/TickerGrid'
import { ComparePanel } from './components/ComparePanel'
import { useTheme }        from './hooks/useTheme'
import { useWatchlist }    from './hooks/useWatchlist'
import { useScoreHistory } from './hooks/useScoreHistory'
import { analyzeStream }   from './api/analyze'

function makeLoadingResult(ticker) {
  return {
    ticker, score: 0, signal: '…',
    breakdown: {}, indicators: {},
    analyst: {}, sentiment: {}, support_resistance: {},
    fear_greed: null, macro: null, financials: null,
    loading: true,
  }
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { watchlist, add: addToWatchlist, remove: removeFromWatchlist } = useWatchlist()
  const { recordResults, getHistory } = useScoreHistory()

  const [resultsMap,   setResultsMap]   = useState({})
  const [tickerOrder,  setTickerOrder]  = useState([])
  const [loading,      setLoading]      = useState(false)
  const [status,       setStatus]       = useState('')
  const [clock,        setClock]        = useState('')
  const abortRef = useRef(null)

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
  const handleAnalyze = useCallback((tickers) => {
    if (!tickers.length) return
    const unique = [...new Set(tickers.map(t => t.toUpperCase().trim()))].filter(Boolean).slice(0, 20)

    abortRef.current?.()

    setLoading(true)
    setStatus(`Fetching ${unique.join(', ')} …`)

    setTickerOrder(prev => {
      const existing = new Set(prev)
      const newOnes  = unique.filter(t => !existing.has(t))
      return [...newOnes, ...prev]
    })
    setResultsMap(prev => {
      const next = { ...prev }
      unique.forEach(t => { if (!next[t]) next[t] = makeLoadingResult(t) })
      return next
    })

    let completedCount = 0
    const completedResults = []

    const abort = analyzeStream(unique, {

      // Section arrived — patch the card with whatever data came in
      onPartial(ticker, section, data) {
        setResultsMap(prev => {
          const existing = prev[ticker] || makeLoadingResult(ticker)
          let patch = {}
          if (section === 'sentiment') {
            patch = {
              analyst:    data.analyst,
              sentiment:  data.sentiment,
              // ── New fields from finnhub partial ──
              fear_greed: data.fear_greed  ?? existing.fear_greed,
              macro:      data.macro       ?? existing.macro,
              financials: data.financials  ?? existing.financials,
            }
          } else if (section === 'support_resistance') {
            patch = { support_resistance: data.support_resistance }
          }
          return { ...prev, [ticker]: { ...existing, ...patch } }
        })
      },

      onComplete(result) {
        completedCount++
        completedResults.push(result)
        setResultsMap(prev => ({ ...prev, [result.ticker]: { ...result, loading: false } }))
        setStatus(`✓ ${completedCount} / ${unique.length} complete …`)
      },

      onError(ticker, message) {
        if (ticker === '*') {
          setStatus(`✗ Stream error: ${message}`)
          return
        }
        completedCount++
        setResultsMap(prev => ({
          ...prev,
          [ticker]: { ...makeLoadingResult(ticker), loading: false, error: message },
        }))
      },

      onDone() {
        setLoading(false)
        const ok  = completedResults.filter(r => !r.error).length
        const err = unique.length - ok
        setStatus(`✓ ${ok} ticker${ok !== 1 ? 's' : ''} analyzed${err ? ` · ${err} failed` : ''} · ${new Date().toLocaleTimeString()}`)
        if (completedResults.length) recordResults(completedResults)
        abortRef.current = null
      },
    })

    abortRef.current = abort
  }, [recordResults])

  // ── Close cards ───────────────────────────────────────────────────────────
  const handleCloseCard = useCallback((ticker) => {
    setResultsMap(prev => { const n = { ...prev }; delete n[ticker]; return n })
    setTickerOrder(prev => prev.filter(t => t !== ticker))
  }, [])

  const handleCloseAll = useCallback(() => {
    abortRef.current?.()
    abortRef.current = null
    setResultsMap({})
    setTickerOrder([])
    setStatus('')
    setLoading(false)
  }, [])

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const handleWatchlistToggle = useCallback((ticker) => {
    if (watchlist.includes(ticker)) removeFromWatchlist(ticker)
    else addToWatchlist(ticker)
  }, [watchlist, addToWatchlist, removeFromWatchlist])

  // ── Compare ───────────────────────────────────────────────────────────────
  const handleCompare = useCallback((ticker) => {
    const result = resultsMap[ticker]
    if (!result || result.loading) return
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
    setCompareLeft(null); setCompareRight(null)
  }, [])

  const results = tickerOrder.map(t => resultsMap[t]).filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header theme={theme} onToggleTheme={toggleTheme} clock={clock} />
      <WatchlistBar watchlist={watchlist} onRemove={removeFromWatchlist} onAnalyze={handleAnalyze} />
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
          <div onClick={() => setCompareOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 499, animation: 'fadeIn 0.2s ease',
          }} />
          <ComparePanel
            left={compareLeft} right={compareRight}
            onClear={handleClearCompare} onClose={() => setCompareOpen(false)}
          />
        </>
      )}
    </div>
  )
}
