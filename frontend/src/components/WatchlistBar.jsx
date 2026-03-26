import { Bookmark, X, Play, Trash2 } from 'lucide-react'

export function WatchlistBar({ watchlist, onRemove, onAnalyze }) {
  const clearAll = () => watchlist.forEach(t => onRemove(t))

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg2)',
      overflowX: 'auto',
      minHeight: '42px',
    }}>
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--label-xs)',
        letterSpacing: '0.15em',
        color: 'var(--text3)',
        textTransform: 'uppercase',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <Bookmark size={10} /> Watchlist
      </span>

      {/* Divider */}
      <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />

      {/* Empty hint */}
      {watchlist.length === 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--label-xs)',
          color: 'var(--text3)', letterSpacing: '0.05em',
        }}>
          Click 🔖 on any card to save
        </span>
      )}

      {/* Ticker chips */}
      {watchlist.map(ticker => (
        <div
          key={ticker}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '3px 6px 3px 9px',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--label-sm)',
            letterSpacing: '0.06em',
            color: 'var(--text)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'border-color 0.15s',
            userSelect: 'none',
          }}
          onClick={() => onAnalyze([ticker])}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          title={`Analyze ${ticker}`}
        >
          {ticker}
          <button
            style={{
              background: 'none', border: 'none',
              color: 'var(--text3)', cursor: 'pointer',
              padding: '1px', display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onClick={e => { e.stopPropagation(); onRemove(ticker) }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
            title={`Remove ${ticker}`}
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {/* Spacer */}
      {watchlist.length > 0 && <div style={{ flex: 1, minWidth: '8px' }} />}

      {/* Run All */}
      {watchlist.length > 1 && (
        <button
          onClick={() => onAnalyze(watchlist)}
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--label-xs)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 9px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            flexShrink: 0, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Play size={9} /> Run All
        </button>
      )}

      {/* Clear All watchlist */}
      {watchlist.length > 0 && (
        <button
          onClick={clearAll}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text3)', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--label-xs)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px',
            transition: 'color 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          title="Clear watchlist"
        >
          <Trash2 size={10} /> Clear
        </button>
      )}
    </div>
  )
}
