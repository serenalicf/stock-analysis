import { TickerCard } from './TickerCard'
import { X, Trash2 } from 'lucide-react'

/* ── Loading skeleton card ── */
function SkeletonCard({ index }) {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%)',
    backgroundSize: '200% 100%',
    animation: `shimmer 1.4s ease ${index * 0.1}s infinite`,
    borderRadius: '3px',
  }
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '22px',
      animation: `fadeUp 0.3s ease ${index * 50}ms both`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ ...shimmer, width: '80px', height: '28px' }} />
          <div style={{ ...shimmer, width: '60px', height: '16px' }} />
          <div style={{ ...shimmer, width: '90px', height: '22px', marginTop: '4px' }} />
        </div>
        <div style={{ ...shimmer, width: '90px', height: '90px', borderRadius: '50%' }} />
      </div>
      {[40, 100, 70, 55, 80].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
          <div style={{ ...shimmer, width: '80px', height: '10px' }} />
          <div style={{ ...shimmer, flex: 1, height: '4px' }} />
          <div style={{ ...shimmer, width: '24px', height: '10px' }} />
        </div>
      ))}
    </div>
  )
}

/* ── Empty state ── */
function EmptyState() {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      textAlign: 'center',
      // Atmospheric dot grid background
      backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      minHeight: '320px',
    }}>
      <div style={{
        width: '64px', height: '64px',
        borderRadius: '50%',
        border: '2px solid var(--border2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: '28px', opacity: 0.4 }}>◈</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-lg)',
        fontWeight: 700,
        color: 'var(--text2)',
        marginBottom: '8px',
      }}>
        No stocks analyzed yet
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--label-sm)',
        color: 'var(--text3)',
        letterSpacing: '0.06em',
        maxWidth: '280px',
        lineHeight: 1.7,
      }}>
        Enter a ticker above — e.g. <span style={{ color: 'var(--accent)' }}>AAPL</span>, <span style={{ color: 'var(--accent)' }}>META</span>, <span style={{ color: 'var(--accent)' }}>NVDA</span> — and press Analyze
      </div>
    </div>
  )
}

/* ── Main grid ── */
export function TickerGrid({
  results, loading, status,
  watchlist, onWatchlistToggle,
  onCompare, onCloseCard, onCloseAll,
  getHistory,
}) {
  const sorted = [...results].sort((a, b) => {
    if (a.error && !b.error) return 1
    if (!a.error && b.error) return -1
    return b.score - a.score
  })

  const hasResults = sorted.length > 0

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px 60px' }}>

      {/* Status + controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        minHeight: '40px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {loading && (
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite',
              flexShrink: 0,
            }} />
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--label-sm)',
            color: status.startsWith('✓') ? 'var(--green)'
                 : status.startsWith('✗') ? 'var(--red)'
                 : 'var(--text3)',
            letterSpacing: '0.05em',
          }}>
            {status || (hasResults
              ? `${sorted.length} ticker${sorted.length !== 1 ? 's' : ''} — search more to add`
              : 'Ready')}
          </span>
          {!loading && results.some(r => r.cached) && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--label-xs)',
              color: 'var(--accent)', letterSpacing: '0.08em',
              background: 'var(--accent-dim)', padding: '2px 7px',
              borderRadius: '3px', border: '1px solid var(--accent-glow)',
            }}>
              ⚡ cached
            </span>
          )}
        </div>

        {/* Close All button — only visible when cards exist */}
        {hasResults && (
          <button
            onClick={onCloseAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text3)',
              padding: '4px 10px', cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
            title="Close all cards"
          >
            <Trash2 size={11} /> Close All
          </button>
        )}
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid',
        // 1 col on mobile, 2 on medium, 3 on wide — fills space properly
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
        gap: '18px',
        alignItems: 'start',   // cards don't stretch to equal height
      }}>
        {/* Loading skeletons */}
        {loading && sorted.length === 0 && (
          [0,1,2].map(i => <SkeletonCard key={i} index={i} />)
        )}

        {/* Empty state */}
        {!loading && sorted.length === 0 && <EmptyState />}

        {/* Real cards */}
        {sorted.map((r, i) => (
          <TickerCard
            key={r.ticker}
            result={r}
            index={i}
            inWatchlist={watchlist.includes(r.ticker)}
            onWatchlistToggle={onWatchlistToggle}
            onCompare={onCompare}
            onClose={onCloseCard}
            history={getHistory(r.ticker)}
          />
        ))}
      </div>
    </div>
  )
}
