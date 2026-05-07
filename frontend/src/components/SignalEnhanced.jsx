/**
 * SignalEnhanced.jsx
 * ==================
 * Drop-in replacement / enhancement layer for the Signal stock analyzer.
 * Adds: OBV, VWAP, Fibonacci retracements, Fear & Greed gauge,
 *       sentiment divergence alert, ATR-based stop/target, VaR,
 *       macro calendar, PE/EPS fundamentals panel, and backtesting stub.
 *
 * Usage: import these components into App.jsx / TickerCard.jsx as needed.
 *
 * New components exported:
 *   <FibRetracementPanel sr={sr} />
 *   <FearGreedGauge value={0–100} />
 *   <SentimentDivergenceAlert priceChange={%} sentimentShift={-1..1} />
 *   <ATRRiskPanel atr={n} price={n} signal="BUY|SELL|NEUTRAL" />
 *   <VaRPanel price={n} volatility={%} position={$} />
 *   <MacroCalendar events={[]} />
 *   <FundamentalsBar pe={n} eps={n} beta={n} revenueGrowth={%} />
 *   <OBVChart obv={[]} />
 *   <BacktestPanel ticker={str} history={[]} />
 *
 * New scoring additions (pure functions):
 *   score_obv_trend(obvData) → 0-100
 *   score_vwap_position(price, vwap) → 0-100
 *   score_fibonacci(price, fibLevels) → 0-100
 *
 * Backend additions needed (see comments in each section):
 *   twelve_data.py  → _obv(), _vwap() helpers + export in _compute_tf()
 *   yfinance_data.py → fib levels added to _compute_sr_from_bars()
 *   finnhub_data.py → fear/greed proxy from VIX + put/call ratio
 *   scoring.py       → new dimension weights (see UPDATED_WEIGHTS below)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { scoreColor, signalMeta } from './utils'

// ─────────────────────────────────────────────────────────────────────────────
// 1. FIBONACCI RETRACEMENT PANEL
// Backend: add to yfinance_data.py _compute_sr_from_bars()
//   def _fib_levels(high, low, current):
//       diff = high - low
//       return {
//           "fib_0":    round(high, 2),
//           "fib_236":  round(high - 0.236 * diff, 2),
//           "fib_382":  round(high - 0.382 * diff, 2),
//           "fib_500":  round(high - 0.500 * diff, 2),
//           "fib_618":  round(high - 0.618 * diff, 2),
//           "fib_786":  round(high - 0.786 * diff, 2),
//           "fib_100":  round(low, 2),
//       }
// ─────────────────────────────────────────────────────────────────────────────

export function FibRetracementPanel({ sr }) {
  if (!sr?.high_52w || !sr?.low_52w || !sr?.current_price) return null

  const high = sr.high_52w
  const low  = sr.low_52w
  const diff = high - low
  const cur  = sr.current_price

  const levels = [
    { pct: 0,     label: '0%',    price: high },
    { pct: 0.236, label: '23.6%', price: high - 0.236 * diff },
    { pct: 0.382, label: '38.2%', price: high - 0.382 * diff },
    { pct: 0.5,   label: '50%',   price: high - 0.5   * diff },
    { pct: 0.618, label: '61.8%', price: high - 0.618 * diff },
    { pct: 0.786, label: '78.6%', price: high - 0.786 * diff },
    { pct: 1,     label: '100%',  price: low  },
  ]

  // Find the nearest level below and above current price
  const below = levels.filter(l => l.price <= cur)
  const above = levels.filter(l => l.price >  cur)
  const nearestSupport    = below.length ? below[below.length - 1] : null
  const nearestResistance = above.length ? above[0] : null

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Fibonacci Retracements</div>
      <div style={{ position: 'relative', height: '160px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', padding: '0 60px 0 10px' }}>
        {levels.map(lvl => {
          const yPct = ((high - lvl.price) / diff) * 100
          const isNearSup = nearestSupport?.label === lvl.label
          const isNearRes = nearestResistance?.label === lvl.label
          const lineColor = isNearSup ? 'var(--green)' : isNearRes ? 'var(--red)' : 'var(--border2)'
          return (
            <div key={lvl.label} style={{ position: 'absolute', left: 0, right: 0, top: `${yPct}%`, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: '1px', background: lineColor, opacity: isNearSup || isNearRes ? 1 : 0.5 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: lineColor, padding: '0 4px', whiteSpace: 'nowrap' }}>
                {lvl.label} ${lvl.price.toFixed(2)}
              </span>
            </div>
          )
        })}
        {/* Current price marker */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: `${((high - cur) / diff) * 100}%`,
          display: 'flex', alignItems: 'center', zIndex: 2,
        }}>
          <div style={{ flex: 1, height: '2px', background: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', padding: '0 4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            NOW ${cur.toFixed(2)}
          </span>
        </div>
      </div>
      {(nearestSupport || nearestResistance) && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '6px', display: 'flex', gap: '16px' }}>
          {nearestSupport && <span>Fib support: <strong style={{ color: 'var(--green)' }}>{nearestSupport.label} (${nearestSupport.price.toFixed(2)})</strong></span>}
          {nearestResistance && <span>Fib resistance: <strong style={{ color: 'var(--red)' }}>{nearestResistance.label} (${nearestResistance.price.toFixed(2)})</strong></span>}
        </div>
      )}
    </div>
  )
}

// Scoring function — add to scoring.py
// def score_fibonacci(price, sr):
//   high, low = sr.get("high_52w"), sr.get("low_52w")
//   if not high or not low: return 50
//   diff = high - low
//   fib_levels = [high - r * diff for r in (0.236, 0.382, 0.5, 0.618, 0.786)]
//   # Reward price sitting just above a key fib level (bounce zone)
//   for lvl in fib_levels:
//     pct_above = (price - lvl) / lvl * 100
//     if 0 <= pct_above < 1.5: return 80   # at fib support
//     if pct_above < 0 and abs(pct_above) < 1.5: return 30  # just broken through
//   return 50


// ─────────────────────────────────────────────────────────────────────────────
// 2. FEAR & GREED GAUGE
// Backend: add to finnhub_data.py (or a new market_data.py)
//   Proxy from: VIX level, SPY 20d momentum, put/call ratio (CBOE)
//   Free sources: stooq.com/q/l/?s=^vix (CSV), CBOE free data
//   Compute:  fear_greed = clamp(100 - (vix - 12) * 3.5 + spy_mom * 20 + (0.5 - pc_ratio) * 40, 0, 100)
// ─────────────────────────────────────────────────────────────────────────────

export function FearGreedGauge({ value = 50, vix = null, pcRatio = null }) {
  const label =
    value >= 80 ? 'Extreme Greed' :
    value >= 60 ? 'Greed' :
    value >= 40 ? 'Neutral' :
    value >= 20 ? 'Fear' : 'Extreme Fear'

  const color =
    value >= 80 ? 'var(--green)' :
    value >= 60 ? '#5cdda0' :
    value >= 40 ? 'var(--yellow)' :
    value >= 20 ? 'var(--orange)' : 'var(--red)'

  // SVG arc gauge
  const r = 60, cx = 90, cy = 80
  const arcStart = -180, arcEnd = 0
  const angle = arcStart + (value / 100) * 180
  const rad = (deg) => (deg * Math.PI) / 180
  const nx = cx + r * Math.cos(rad(angle))
  const ny = cy + r * Math.sin(rad(angle))

  const arc = (deg1, deg2, col) => {
    const x1 = cx + r * Math.cos(rad(deg1))
    const y1 = cy + r * Math.sin(rad(deg1))
    const x2 = cx + r * Math.cos(rad(deg2))
    const y2 = cy + r * Math.sin(rad(deg2))
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Fear &amp; Greed Index</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <svg width="180" height="95" viewBox="0 0 180 95">
          {/* Background arc segments */}
          {[
            { d: arc(-180, -144), col: '#ff3d5a33' },
            { d: arc(-144, -108), col: '#ff8c4033' },
            { d: arc(-108, -72),  col: '#ffd06033' },
            { d: arc(-72, -36),   col: '#5cdda033' },
            { d: arc(-36, 0),     col: '#00e88733' },
          ].map((seg, i) => (
            <path key={i} d={seg.d} fill="none" stroke={seg.col} strokeWidth="12" />
          ))}
          {/* Filled arc */}
          <path
            d={arc(-180, Math.min(angle, 0))}
            fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          />
          {/* Needle */}
          <line
            x1={cx} y1={cy}
            x2={nx} y2={ny}
            stroke={color} strokeWidth="2.5" strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="4" fill={color} />
          {/* Labels */}
          <text x="18"  y="88" fill="var(--red)"   fontSize="8" fontFamily="monospace">Fear</text>
          <text x="150" y="88" fill="var(--green)" fontSize="8" fontFamily="monospace">Greed</text>
          {/* Value */}
          <text x={cx} y={cy - 14} textAnchor="middle" fill={color} fontSize="22" fontFamily="monospace" fontWeight="700">{value}</text>
          <text x={cx} y={cy - 2}  textAnchor="middle" fill={color} fontSize="8"  fontFamily="monospace">{label}</text>
        </svg>
        <div style={{ flex: 1 }}>
          {vix != null && (
            <div style={metaRow}><span style={metaLabel}>VIX</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: vix > 25 ? 'var(--red)' : 'var(--text2)' }}>{vix.toFixed(1)}</span></div>
          )}
          {pcRatio != null && (
            <div style={metaRow}><span style={metaLabel}>Put/Call</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: pcRatio > 1 ? 'var(--red)' : 'var(--green)' }}>{pcRatio.toFixed(2)}</span></div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '8px', lineHeight: 1.6 }}>
            Composite of VIX level, SPY momentum &amp; put/call ratio
          </div>
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. SENTIMENT DIVERGENCE ALERT
// Backend: track price_change_7d and sentiment_shift_7d in finnhub_data.py
//   price_change = (current - close_7d_ago) / close_7d_ago * 100
//   sentiment_shift = new_sentiment_score - old_sentiment_score
// ─────────────────────────────────────────────────────────────────────────────

export function SentimentDivergenceAlert({ priceChange = -5.2, sentimentShift = 0.35 }) {
  const isDivergent = priceChange < -2 && sentimentShift > 0.15
  const isWorrying  = priceChange > 2  && sentimentShift < -0.15

  if (!isDivergent && !isWorrying) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      background: isDivergent ? 'var(--green-dim)' : 'var(--red-dim)',
      border: `1px solid ${isDivergent ? 'var(--green)' : 'var(--red)'}`,
      borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '12px',
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{isDivergent ? '⚡' : '⚠'}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: isDivergent ? 'var(--green)' : 'var(--red)', letterSpacing: '0.1em', marginBottom: '3px' }}>
          {isDivergent ? 'BULLISH DIVERGENCE DETECTED' : 'BEARISH DIVERGENCE DETECTED'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', lineHeight: 1.6 }}>
          {isDivergent
            ? `Price fell ${Math.abs(priceChange).toFixed(1)}% while social sentiment shifted +${(sentimentShift * 100).toFixed(0)}pts bullish — potential accumulation signal.`
            : `Price rose ${priceChange.toFixed(1)}% but sentiment dropped ${Math.abs(sentimentShift * 100).toFixed(0)}pts — potential distribution signal.`
          }
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. ATR-BASED RISK PANEL (Stop Loss / Take Profit)
// Backend: add to twelve_data.py _compute_tf()
//   def _atr14(hi, lo, cl, p=14): ... (already has _adx which computes TR)
//   Export: "atr14": round(float(atr_daily[-1]), 4)
// ─────────────────────────────────────────────────────────────────────────────

export function ATRRiskPanel({ atr, price, signal = 'NEUTRAL' }) {
  if (!atr || !price) return null

  const isBull = signal === 'STRONG BUY' || signal === 'BUY'
  const isBear = signal === 'STRONG SELL' || signal === 'SELL'

  // Conservative: 1.5× ATR stop, 2× ATR target  (risk:reward 1:1.33)
  // Aggressive:   2× ATR stop,   3× ATR target
  const stops = {
    conservative: { stop: price - 1.5 * atr, target: price + 2.0 * atr },
    aggressive:   { stop: price - 2.0 * atr, target: price + 3.0 * atr },
  }

  const rrConservative = ((stops.conservative.target - price) / (price - stops.conservative.stop)).toFixed(1)

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>ATR Risk Management</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '10px' }}>
        ATR-14: <strong style={{ color: 'var(--text2)' }}>${atr.toFixed(2)}</strong>
        {' '}&middot;{' '}
        ATR%: <strong style={{ color: atr / price > 0.03 ? 'var(--orange)' : 'var(--text2)' }}>{(atr / price * 100).toFixed(1)}%</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {Object.entries(stops).map(([mode, levels]) => (
          <div key={mode} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>{mode}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>Stop</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', fontWeight: 700 }}>${levels.stop.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)' }}>Target</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}>${levels.target.toFixed(2)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '4px' }}>
              R:R 1:{((levels.target - price) / (price - levels.stop)).toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      {isBull && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--green)', marginTop: '8px' }}>
          ▲ Long setup — conservative R:R {rrConservative}:1 above minimum 1.5:1
        </div>
      )}
      {isBear && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red)', marginTop: '8px' }}>
          ▼ Short setup — reverse levels for short entry
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. VALUE AT RISK (VaR) PANEL
// Parametric VaR: assumes normal distribution of daily returns
// 1-day 95% VaR = position × daily_vol × 1.645
// Backend: add daily return std to twelve_data.py (from close prices)
// ─────────────────────────────────────────────────────────────────────────────

export function VaRPanel({ price = 150, dailyVol = 0.018, position = 10000 }) {
  const shares = Math.floor(position / price)
  const posValue = shares * price

  // Parametric VaR (assumes normal)
  const var95_1d  = posValue * dailyVol * 1.645
  const var99_1d  = posValue * dailyVol * 2.326
  const var95_10d = var95_1d * Math.sqrt(10)

  // CVaR (Expected Shortfall) — approx 1.25× VaR95 for normal
  const cvar95 = var95_1d * 1.25

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Value at Risk</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '10px' }}>
        Position: <strong style={{ color: 'var(--text2)' }}>{shares} shares · ${posValue.toLocaleString()}</strong>
        {' '}&middot;{' '}
        Daily Vol: <strong style={{ color: dailyVol > 0.025 ? 'var(--orange)' : 'var(--text2)' }}>{(dailyVol * 100).toFixed(2)}%</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          { label: '1-Day VaR 95%', value: var95_1d,  color: 'var(--yellow)' },
          { label: '1-Day VaR 99%', value: var99_1d,  color: 'var(--orange)' },
          { label: '10-Day VaR 95%',value: var95_10d, color: 'var(--red)' },
          { label: 'CVaR (ES) 95%', value: cvar95,    color: 'var(--red)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: m.color, fontWeight: 700 }}>-${m.value.toFixed(0)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>
              ({(m.value / posValue * 100).toFixed(1)}% of position)
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '8px', lineHeight: 1.6 }}>
        Parametric method · assumes normal distribution · inputs: position size + historical daily volatility
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. MACRO CALENDAR
// Backend: new macro_calendar.py
//   Free source: https://finnhub.io/api/v1/calendar/economic (free tier)
//   Filter: CPI, NFP, FOMC, PPI, GDP, Retail Sales
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_EVENTS = [
  { date: '2025-07-11', name: 'CPI (Jun)',        impact: 'high',   forecast: '3.1%', prev: '3.3%' },
  { date: '2025-07-05', name: 'NFP (Jun)',         impact: 'high',   forecast: '185K', prev: '272K' },
  { date: '2025-07-31', name: 'FOMC Decision',     impact: 'high',   forecast: 'Hold', prev: 'Hold' },
  { date: '2025-07-15', name: 'Retail Sales (Jun)',impact: 'medium', forecast: '0.3%', prev: '-0.1%' },
  { date: '2025-07-26', name: 'GDP Q2 Advance',    impact: 'high',   forecast: '2.1%', prev: '1.4%' },
  { date: '2025-07-10', name: 'PPI (Jun)',         impact: 'medium', forecast: '2.3%', prev: '2.2%' },
]

export function MacroCalendar({ events = SAMPLE_EVENTS }) {
  const impactColor = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--text3)' }
  const today = new Date()

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Macro Calendar</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sorted.map((ev, i) => {
          const d = new Date(ev.date)
          const isPast = d < today
          const daysAway = Math.round((d - today) / 86400000)
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${impactColor[ev.impact]}`,
              borderRadius: 'var(--radius)', padding: '8px 10px',
              opacity: isPast ? 0.5 : 1,
            }}>
              <div style={{ width: '44px', flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', fontWeight: 700 }}>
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {!isPast && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: daysAway <= 3 ? 'var(--red)' : 'var(--text3)' }}>
                    {daysAway === 0 ? 'TODAY' : `${daysAway}d`}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', fontWeight: 600 }}>{ev.name}</div>
                {ev.forecast && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>
                    Forecast: <span style={{ color: 'var(--text2)' }}>{ev.forecast}</span>
                    {' '}&middot;{' '}
                    Prev: <span style={{ color: 'var(--text2)' }}>{ev.prev}</span>
                  </div>
                )}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em',
                color: impactColor[ev.impact],
                border: `1px solid ${impactColor[ev.impact]}`,
                borderRadius: '2px', padding: '2px 5px', textTransform: 'uppercase', flexShrink: 0,
              }}>
                {ev.impact}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '8px' }}>
        Source: Finnhub /calendar/economic (free tier)
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. FUNDAMENTALS BAR
// Backend: already in finnhub_data.py (financials dict)
//   pe_ttm, eps_ttm, revenue_growth, beta already fetched from /stock/basic-financials
// ─────────────────────────────────────────────────────────────────────────────

export function FundamentalsBar({ pe, eps, beta, revenueGrowth, marketCap }) {
  const metrics = [
    { label: 'P/E (TTM)',  value: pe    != null ? pe.toFixed(1)    : '—', color: pe > 30 ? 'var(--orange)' : pe > 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'EPS (TTM)',  value: eps   != null ? `$${eps.toFixed(2)}` : '—', color: eps > 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Beta',       value: beta  != null ? beta.toFixed(2)  : '—', color: beta > 1.5 ? 'var(--orange)' : 'var(--text2)' },
    { label: 'Rev Growth', value: revenueGrowth != null ? `${(revenueGrowth * 100).toFixed(1)}%` : '—', color: revenueGrowth > 0 ? 'var(--green)' : 'var(--red)' },
  ]

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Fundamentals</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: m.color, lineHeight: 1.2 }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '3px' }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 8. OBV MINI-CHART
// Backend: add to twelve_data.py _compute_tf()
//   def _obv(c, v):  (close array, volume array, oldest→newest)
//     obv = [0]
//     for i in range(1, len(c)):
//       if c[i] > c[i-1]: obv.append(obv[-1] + v[i])
//       elif c[i] < c[i-1]: obv.append(obv[-1] - v[i])
//       else: obv.append(obv[-1])
//     return obv   → return last 30 for chart, slope for scoring
// ─────────────────────────────────────────────────────────────────────────────

export function OBVChart({ obvData = [], price = 0 }) {
  if (!obvData || obvData.length < 2) return null

  const W = 280, H = 60
  const min = Math.min(...obvData)
  const max = Math.max(...obvData)
  const range = max - min || 1
  const pts = obvData.map((v, i) => {
    const x = (i / (obvData.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const obvTrend = obvData[obvData.length - 1] > obvData[0] ? 'rising' : 'falling'
  const trendColor = obvTrend === 'rising' ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={sectionHead}>On-Balance Volume (OBV)</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: trendColor, letterSpacing: '0.1em' }}>
          {obvTrend === 'rising' ? '▲ ACCUMULATION' : '▼ DISTRIBUTION'}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: '60px', display: 'block' }}>
        <polyline
          points={pts}
          fill="none"
          stroke={trendColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Fill area */}
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill={obvTrend === 'rising' ? 'var(--green-dim)' : 'var(--red-dim)'}
        />
      </svg>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '4px' }}>
        OBV leading price — {obvTrend === 'rising' ? 'volume supports upside' : 'volume warns of weakness'}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 9. BACKTEST STUB PANEL
// Backend: new backtest.py endpoint POST /backtest
//   Strategy: when score ≥ threshold → long; when score ≤ (100-threshold) → flat
//   Use historical OHLCV from yfinance, replay scoring on each bar
// ─────────────────────────────────────────────────────────────────────────────

export function BacktestPanel({ ticker = 'AAPL', sampleResults = null }) {
  const results = sampleResults || {
    ticker,
    strategy:     'Signal Score ≥ 65 = Long',
    period:       '2020–2024',
    totalReturn:  142.3,
    buyHold:      98.7,
    sharpe:       1.42,
    maxDrawdown:  -18.2,
    winRate:      61.4,
    totalTrades:  48,
    avgHoldDays:  12.3,
  }

  const outperformance = results.totalReturn - results.buyHold

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={sectionHead}>Strategy Backtest</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span>Strategy: <strong style={{ color: 'var(--text2)' }}>{results.strategy}</strong></span>
        <span>Period: <strong style={{ color: 'var(--text2)' }}>{results.period}</strong></span>
        <span>Trades: <strong style={{ color: 'var(--text2)' }}>{results.totalTrades}</strong></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'Strategy Return', value: `+${results.totalReturn}%`, color: 'var(--green)' },
          { label: 'Buy & Hold',      value: `+${results.buyHold}%`,     color: 'var(--text2)' },
          { label: 'Sharpe Ratio',    value: results.sharpe.toFixed(2),  color: results.sharpe > 1 ? 'var(--green)' : 'var(--orange)' },
          { label: 'Max Drawdown',    value: `${results.maxDrawdown}%`,  color: 'var(--red)' },
          { label: 'Win Rate',        value: `${results.winRate}%`,      color: results.winRate > 55 ? 'var(--green)' : 'var(--orange)' },
          { label: 'Avg Hold',        value: `${results.avgHoldDays}d`,  color: 'var(--text2)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{
        background: outperformance > 0 ? 'var(--green-dim)' : 'var(--red-dim)',
        border: `1px solid ${outperformance > 0 ? 'var(--green)' : 'var(--red)'}`,
        borderRadius: 'var(--radius)', padding: '8px 12px',
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: outperformance > 0 ? 'var(--green)' : 'var(--red)',
      }}>
        {outperformance > 0 ? '▲' : '▼'} {Math.abs(outperformance).toFixed(1)}% vs buy & hold over {results.period}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '8px' }}>
        Past performance ≠ future results · Simulated with no slippage/fees
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// UPDATED SCORING WEIGHTS (drop into scoring.py)
// ─────────────────────────────────────────────────────────────────────────────
export const UPDATED_WEIGHTS = {
  technicals:  0.30,  // was 0.40 — reduced to make room for new dims
  trend:       0.15,  // was 0.20
  sr:          0.12,  // was 0.15
  fibonacci:   0.05,  // NEW
  obv_vwap:    0.08,  // NEW — OBV trend + VWAP position
  analyst:     0.15,  // unchanged
  sentiment:   0.10,  // unchanged
  fear_greed:  0.05,  // NEW — market-wide context
  // total = 1.00
}

/*
 * Python equivalents to add to scoring.py:
 *
 * def score_obv_trend(obv_series: list) -> float:
 *     if len(obv_series) < 10: return 50
 *     slope = (obv_series[-1] - obv_series[-10]) / (abs(obv_series[-1]) + 1)
 *     return clamp(50 + slope * 1000)
 *
 * def score_vwap(price: float, vwap: float | None) -> float:
 *     if not vwap: return 50
 *     pct = (price - vwap) / vwap * 100
 *     if pct > 2:  return 70
 *     if pct > 0:  return 60
 *     if pct > -2: return 45
 *     return 30
 *
 * def score_fibonacci(price: float, sr: dict) -> float:
 *     high, low = sr.get("high_52w"), sr.get("low_52w")
 *     if not high or not low: return 50
 *     diff = high - low
 *     for r in (0.236, 0.382, 0.5, 0.618, 0.786):
 *         lvl = high - r * diff
 *         pct = abs(price - lvl) / lvl * 100
 *         if pct < 1.5: return 80 if price >= lvl else 30
 *     return 50
 *
 * def score_fear_greed(fg_value: float | None) -> float:
 *     if fg_value is None: return 50
 *     # Contrarian: extreme fear = buy, extreme greed = cautious
 *     if fg_value < 20: return 80
 *     if fg_value < 35: return 65
 *     if fg_value > 80: return 30
 *     if fg_value > 65: return 40
 *     return 55
 */


// ─────────────────────────────────────────────────────────────────────────────
// SHARED MICRO-STYLES
// ─────────────────────────────────────────────────────────────────────────────

const sectionHead = {
  fontFamily: 'var(--font-mono)',
  fontSize: '9px',
  letterSpacing: '0.18em',
  color: 'var(--text3)',
  textTransform: 'uppercase',
  marginBottom: '10px',
  fontWeight: 600,
}

const metaRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  borderBottom: '1px solid var(--border)',
}

const metaLabel = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  color: 'var(--text3)',
  letterSpacing: '0.08em',
}


// ─────────────────────────────────────────────────────────────────────────────
// DEMO PAGE — shows all new panels with sample data
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_OBV = [
  100000, 98000, 102000, 115000, 112000, 120000, 118000,
  125000, 130000, 128000, 135000, 140000, 138000, 145000,
  143000, 150000, 155000, 152000, 160000, 165000,
]

export default function EnhancedDemo() {
  const [fearGreed, setFearGreed] = useState(38)
  const [position, setPosition]   = useState(10000)
  const [ticker, setTicker]       = useState('NVDA')

  const sampleSR = {
    current_price: 137.50,
    high_52w: 180.00,
    low_52w:   60.00,
    nearest_support: 120.00,
    nearest_resistance: 155.00,
    dist_to_support: 12.7,
    dist_to_resistance: 12.7,
    pct_from_52w_high: -23.6,
    pct_from_52w_low: 129.2,
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.02em' }}>
          SIGNAL<span style={{ color: 'var(--accent)' }}>.</span> Enhanced
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '4px', letterSpacing: '0.08em' }}>
          New feature showcase — {ticker} · $137.50
        </div>
      </div>

      {/* Interactive controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>Fear/Greed Index:</span>
          <input type="range" min="0" max="100" value={fearGreed} onChange={e => setFearGreed(+e.target.value)} style={{ width: '100px' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', width: '28px' }}>{fearGreed}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>Position ($):</span>
          <input type="range" min="1000" max="50000" step="1000" value={position} onChange={e => setPosition(+e.target.value)} style={{ width: '100px' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', width: '56px' }}>${position.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: '24px', alignItems: 'start' }}>

        {/* Column 1 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            Technical Enhancements
          </div>
          <FibRetracementPanel sr={sampleSR} />
          <OBVChart obvData={SAMPLE_OBV} price={sampleSR.current_price} />
          <FundamentalsBar pe={28.4} eps={4.82} beta={1.72} revenueGrowth={0.214} />
        </div>

        {/* Column 2 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            Market Sentiment &amp; Macro
          </div>
          <FearGreedGauge value={fearGreed} vix={fearGreed < 40 ? 22.4 : 14.1} pcRatio={fearGreed < 40 ? 1.12 : 0.74} />
          <SentimentDivergenceAlert priceChange={-4.8} sentimentShift={0.38} />
          <MacroCalendar />
        </div>

        {/* Column 3 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            Risk Management
          </div>
          <ATRRiskPanel atr={3.42} price={sampleSR.current_price} signal="BUY" />
          <VaRPanel price={sampleSR.current_price} dailyVol={0.022} position={position} />
          <BacktestPanel ticker={ticker} />
        </div>

      </div>

      {/* Updated weights preview */}
      <div style={{ marginTop: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px' }}>
          Updated Scoring Weights (scoring.py)
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(UPDATED_WEIGHTS).map(([k, w]) => (
            <div key={k} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '90px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{Math.round(w * 100)}%</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
