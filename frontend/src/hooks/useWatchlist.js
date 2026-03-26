import { useState, useCallback } from 'react'

const KEY = 'signal-watchlist'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(load)

  const save = useCallback((list) => {
    setWatchlist(list)
    localStorage.setItem(KEY, JSON.stringify(list))
  }, [])

  const add = useCallback((ticker) => {
    setWatchlist(prev => {
      if (prev.includes(ticker)) return prev
      const next = [...prev, ticker]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const remove = useCallback((ticker) => {
    setWatchlist(prev => {
      const next = prev.filter(t => t !== ticker)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const has = useCallback((ticker) => watchlist.includes(ticker), [watchlist])

  return { watchlist, add, remove, has, save }
}
