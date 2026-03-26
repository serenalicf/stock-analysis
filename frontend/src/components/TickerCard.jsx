import { useState } from 'react'
import {
  Bookmark, BookmarkCheck, GitCompare,
  ChevronDown, ChevronUp, TrendingUp, AlertTriangle, X,
} from 'lucide-react'
import { ScoreRing }         from './ScoreRing'
import { DimBars }           from './DimBars'
import { ScoreHistoryChart } from './ScoreHistoryChart'
import { signalMeta, scoreColor } from '../utils'

/* ── Micro-components ─────────────────────────────────────────────────────── */

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--label-base)',
      letterSpacing: '0.13em',
      fontWeight: 600,
      color: 'var(--text3)',
      textTransform: 'uppercase',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    }}>
      {icon}{children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '8px 6px',
      textAlign: 'center',
      flex: 1,
      minWidth: '46px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        fontWeight: 700,
        color: color || 'var(--text)',
        lineHeight: 1.2,
      }}>{value ?? '—'}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--label-xs)',
        color: 'var(--text3)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginTop: '3px',
      }}>{label}</div>
    </div>
  )
}

function FetchWarning({ errors }) {
  if (!errors || Object.keys(errors).length === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '7px',
      background: 'rgba(255,140,64,0.07)',
      border: '1px solid rgba(255,140,64,0.25)',
      borderRadius: 'var(--radius)',
      padding: '9px 11px', marginBottom: '12px',
    }}>
      <AlertTriangle size={12} color="var(--orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--orange)', lineHeight: 1.6 }}>
        <strong>{Object.keys(errors).length} indicator{Object.keys(errors).length > 1 ? 's' : ''} missing</strong>
        {' — Twelve Data rate limit. Wait 60 s and re-analyze.'}
      </div>
    </div>
  )
}

function IndicatorDetail({ indicators }) {
  if (!indicators?.timeframes) return null
  const tfs  = ['daily', 'weekly', 'monthly']
  const rows = [
    { key: 'rsi',         label: 'RSI 14' },
    { key: 'macd',        label: 'MACD' },
    { key: 'macd_signal', label: 'Signal' },
    { key: 'macd_hist',   label: 'Hist' },
    { key: 'adx',         label: 'ADX 14' },
    { key: 'bb_upper',    label: 'BB Upper' },
    { key: 'bb_mid',      label: 'BB Mid' },
    { key: 'bb_lower',    label: 'BB Lower' },
    { key: 'ema20',       label: 'EMA 20' },
    { key: 'ema50',       label: 'EMA 50' },
    { key: 'ema200',      label: 'EMA 200' },
  ]
  const thS = {
    textAlign: 'left', padding: '5px 8px',
    color: 'var(--text3)', fontSize: 'var(--label-sm)',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600, background: 'var(--surface2)',
  }
  const tdBase = {
    padding: '5px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    borderBottom: '1px solid var(--border)',
  }
  return (
    <div style={{ marginTop: '10px', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thS}>Indicator</th>
            {tfs.map(tf => <th key={tf} style={{ ...thS, textAlign: 'right' }}>{tf[0].toUpperCase() + tf.slice(1)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label }) => (
            <tr key={key}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ ...tdBase, color: 'var(--text2)', fontWeight: 500 }}>{label}</td>
              {tfs.map(tf => {
                const v = indicators.timeframes[tf]?.[key]
                return <td key={tf} style={{ ...tdBase, textAlign: 'right', color: v != null ? 'var(--text)' : 'var(--text3)' }}>
                  {v != null ? v.toFixed(2) : '—'}
                </td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main card ────────────────────────────────────────────────────────────── */

export function TickerCard({ result, index, inWatchlist, onWatchlistToggle, onCompare, onClose, history }) {
  const [expanded, setExpanded] = useState(false)
  const {
    ticker, score, signal, breakdown,
    analyst, sentiment, support_resistance: sr,
    indicators, error,
  } = result

  const sm    = signalMeta(signal)
  const price = indicators?.price || sr?.current_price || 0
  const col   = scoreColor(score)
  const hasErrors = indicators?.fetch_errors && Object.keys(indicators.fetch_errors).length > 0

  // Rich card background: subtle radial wash from top using score color
  const cardBg = `radial-gradient(ellipse 80% 120px at 50% -20px, ${col}14 0%, transparent 70%), var(--surface)`

  if (error) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--red)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px', position: 'relative',
        animation: `fadeUp 0.38s ease ${index * 50}ms both`,
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                      background: 'var(--red)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />
        {/* Close button on error card too */}
        <button onClick={() => onClose(ticker)} style={closeBtn}>
          <X size={12} />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '6px', paddingRight: '24px' }}>{ticker}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--red)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} /> {error}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: cardBg,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        position: 'relative',
        animation: `fadeUp 0.38s cubic-bezier(0.16,1,0.3,1) ${index * 50}ms both`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Score-colored top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: col, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />

      {/* Close button (top-right) */}
      <button
        onClick={() => onClose(ticker)}
        style={closeBtn}
        title={`Close ${ticker}`}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.color = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent';    e.currentTarget.style.color = 'var(--text3)' }}
      >
        <X size={12} />
      </button>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingRight: '8px' }}>
        <div>
          {/* Ticker + action icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1 }}>
              {ticker}
            </span>
            <button
              onClick={() => onWatchlistToggle(ticker)}
              title={inWatchlist ? 'Remove from watchlist' : 'Save to watchlist'}
              style={{ ...iconBtn, color: inWatchlist ? 'var(--accent)' : 'var(--text3)' }}
            >
              {inWatchlist ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>
            <button
              onClick={() => onCompare(ticker)}
              title="Compare"
              style={iconBtn}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
            >
              <GitCompare size={13} />
            </button>
          </div>

          {/* Price */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.02em' }}>
            ${price > 0 ? price.toFixed(2) : '—'}
          </div>

          {/* Signal badge */}
          <div style={{
            display: 'inline-block', marginTop: '8px',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--label-base)',
            fontWeight: 700, letterSpacing: '0.12em',
            padding: '3px 10px',
            background: sm.bg, color: sm.text,
            border: `1px solid ${sm.border}`,
            borderRadius: 'var(--radius)',
            textTransform: 'uppercase',
          }}>{signal}</div>
        </div>

        <ScoreRing score={score} size={88} />
      </div>

      {hasErrors && <FetchWarning errors={indicators.fetch_errors} />}

      <DimBars breakdown={breakdown} />

      {/* Score history */}
      <SectionTitle icon={<TrendingUp size={11} />}>Score History</SectionTitle>
      <ScoreHistoryChart history={history} ticker={ticker} />

      <Divider />

      {/* Support / Resistance */}
      <SectionTitle>Support · Resistance</SectionTitle>
      {(sr?.nearest_support != null || sr?.nearest_resistance != null) ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--green)' }}>
                ${sr.nearest_support?.toFixed(2) ?? '—'}
              </div>
              <div style={srLabel}>Support</div>
              {sr.dist_to_support != null && <div style={srDist}>−{sr.dist_to_support}% away</div>}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--accent)' }}>
                ${price?.toFixed(2)}
              </div>
              <div style={srLabel}>Current</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--red)' }}>
                ${sr.nearest_resistance?.toFixed(2) ?? '—'}
              </div>
              <div style={srLabel}>Resistance</div>
              {sr.dist_to_resistance != null && <div style={srDist}>+{sr.dist_to_resistance}% away</div>}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--text3)', lineHeight: 1.6 }}>
            52W: <span style={{ color: 'var(--text2)' }}>${sr.low_52w}</span> ↔ <span style={{ color: 'var(--text2)' }}>${sr.high_52w}</span>
            &nbsp;·&nbsp; {Math.abs(sr.pct_from_52w_high)}% from 52W high
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>
          {sr?.error ? `⚠ ${sr.error}` : 'No S/R data'}
        </div>
      )}

      <Divider />

      {/* Analyst ratings */}
      <SectionTitle>Analyst Ratings</SectionTitle>
      {analyst?.total > 0 ? (
        <>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <Stat label="Str Buy"  value={analyst.strong_buy}  color="var(--green)" />
            <Stat label="Buy"      value={analyst.buy}         color="var(--green)" />
            <Stat label="Hold"     value={analyst.hold}        color="var(--yellow)" />
            <Stat label="Sell"     value={analyst.sell}        color="var(--orange)" />
            <Stat label="Str Sell" value={analyst.strong_sell} color="var(--red)" />
          </div>
          {analyst.target_mean && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text2)', display: 'flex', gap: '12px', flexWrap: 'wrap', lineHeight: 1.8 }}>
              <span>Target <strong style={{ color: 'var(--text)', fontSize: 'var(--text-base)' }}>${analyst.target_mean?.toFixed(2)}</strong></span>
              {price > 0 && (
                <span style={{ color: analyst.target_mean > price ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {analyst.target_mean > price ? '▲' : '▼'} {Math.abs((analyst.target_mean - price) / price * 100).toFixed(1)}% upside
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>No analyst data</div>
      )}

      <Divider />

      {/* News sentiment */}
      <SectionTitle>News Sentiment</SectionTitle>
      {sentiment?.recent_count > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--green)', fontWeight: 600 }}>
              ▲ {(sentiment.bullish_pct * 100).toFixed(0)}% Bullish
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--text3)' }}>
              {sentiment.recent_count} articles
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--red)', fontWeight: 600 }}>
              {(sentiment.bearish_pct * 100).toFixed(0)}% Bearish ▼
            </span>
          </div>
          <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${sentiment.bullish_pct * 100}%`, background: 'var(--green)', transition: 'width 0.8s ease' }} />
            <div style={{ width: `${(sentiment.neutral_pct ?? 0) * 100}%`, background: 'var(--border2)' }} />
            <div style={{ flex: 1, background: 'var(--red)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)', color: 'var(--text3)', marginTop: '6px' }}>
            Score: <span style={{
              color: (sentiment.sentiment_score ?? 0) > 0.1 ? 'var(--green)'
                   : (sentiment.sentiment_score ?? 0) < -0.1 ? 'var(--red)' : 'var(--yellow)',
              fontWeight: 600,
            }}>
              {(sentiment.sentiment_score ?? 0) > 0.1 ? '▲ Positive' : (sentiment.sentiment_score ?? 0) < -0.1 ? '▼ Negative' : '— Neutral'}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>
          No news in the last 30 days
        </div>
      )}

      {/* Raw indicators toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          marginTop: '14px', width: '100%',
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text3)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--label-base)',
          letterSpacing: '0.08em', padding: '7px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '5px', transition: 'border-color 0.15s, color 0.15s',
          textTransform: 'uppercase',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.color = 'var(--text3)' }}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide Indicators' : 'Show Raw Indicators'}
      </button>

      {expanded && <IndicatorDetail indicators={indicators} />}
    </div>
  )
}

/* ── Shared micro-styles ──────────────────────────────────────────────────── */

const closeBtn = {
  position: 'absolute', top: '12px', right: '12px',
  background: 'transparent',
  border: 'none', borderRadius: 'var(--radius)',
  color: 'var(--text3)',
  cursor: 'pointer', padding: '3px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s',
  zIndex: 1,
}

const iconBtn = {
  background: 'none', border: 'none',
  cursor: 'pointer', padding: '2px',
  display: 'flex', alignItems: 'center',
  color: 'var(--text3)',
  transition: 'color 0.15s',
}

const srLabel = {
  fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)',
  color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginTop: '2px',
}

const srDist = {
  fontFamily: 'var(--font-mono)', fontSize: 'var(--label-sm)',
  color: 'var(--text3)', marginTop: '1px',
}
