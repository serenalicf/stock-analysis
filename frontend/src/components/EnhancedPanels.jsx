/**
 * EnhancedPanels.jsx
 * ==================
 * New UI panels added to each TickerCard.
 * Place this file in the same directory as TickerCard.jsx (project root / frontend/src/).
 *
 * Exported components (used in TickerCard.jsx):
 *   <FibRetracementPanel sr={sr} />
 *   <FearGreedGauge fearGreed={finnhub.fear_greed} />
 *   <SentimentDivergenceAlert sentiment={sentiment} indicators={indicators} />
 *   <ATRRiskPanel indicators={indicators} signal={signal} />
 *   <VaRPanel price={price} indicators={indicators} positionSize={positionSize} />
 *   <MacroCalendar events={finnhub.macro} />
 *   <FundamentalsBar financials={finnhub.financials} />
 *   <OBVSparkline indicators={indicators} />
 */

// ── Shared micro-styles ───────────────────────────────────────────────────────

const sHead = {
  fontFamily:    'var(--font-mono)',
  fontSize:      '9px',
  letterSpacing: '0.18em',
  color:         'var(--text3)',
  textTransform: 'uppercase',
  marginBottom:  '10px',
  fontWeight:    600,
}

const statBox = {
  background:   'var(--bg)',
  border:       '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding:      '8px 10px',
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. FIBONACCI RETRACEMENT PANEL
// Uses sr.high_52w + sr.low_52w already returned by yfinance_data.py
// ─────────────────────────────────────────────────────────────────────────────

export function FibRetracementPanel({ sr }) {
  if (!sr?.high_52w || !sr?.low_52w || !sr?.current_price) return null

  const high = sr.high_52w
  const low  = sr.low_52w
  const diff = high - low
  const cur  = sr.current_price

  const levels = [
    { ratio: 0,     label: '0%',    price: high },
    { ratio: 0.236, label: '23.6%', price: high - 0.236 * diff },
    { ratio: 0.382, label: '38.2%', price: high - 0.382 * diff },
    { ratio: 0.5,   label: '50%',   price: high - 0.500 * diff },
    { ratio: 0.618, label: '61.8%', price: high - 0.618 * diff },
    { ratio: 0.786, label: '78.6%', price: high - 0.786 * diff },
    { ratio: 1,     label: '100%',  price: low  },
  ]

  const below = levels.filter(l => l.price <= cur)
  const above = levels.filter(l => l.price >  cur)
  const nearSup = below.length ? below[below.length - 1] : null
  const nearRes = above.length ? above[0] : null

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>Fibonacci Retracements (52W)</div>
      <div style={{ position: 'relative', height: '140px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', padding: '0 72px 0 8px' }}>
        {levels.map(lvl => {
          const yPct = ((high - lvl.price) / diff) * 100
          const isNS  = nearSup?.label === lvl.label
          const isNR  = nearRes?.label === lvl.label
          const col   = isNS ? 'var(--green)' : isNR ? 'var(--red)' : 'var(--border2)'
          return (
            <div key={lvl.label} style={{ position: 'absolute', left: 0, right: 0, top: `${yPct}%`, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: '1px', background: col, opacity: isNS || isNR ? 1 : 0.45 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: col, padding: '0 4px', whiteSpace: 'nowrap' }}>
                {lvl.label} ${lvl.price.toFixed(2)}
              </span>
            </div>
          )
        })}
        {/* Current price */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${((high - cur) / diff) * 100}%`, display: 'flex', alignItems: 'center', zIndex: 2 }}>
          <div style={{ flex: 1, height: '2px', background: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--accent)', padding: '0 4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            NOW ${cur.toFixed(2)}
          </span>
        </div>
      </div>
      {(nearSup || nearRes) && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '5px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {nearSup && <span>Fib support: <strong style={{ color: 'var(--green)' }}>{nearSup.label} (${nearSup.price.toFixed(2)})</strong></span>}
          {nearRes && <span>Fib resist: <strong style={{ color: 'var(--red)' }}>{nearRes.label} (${nearRes.price.toFixed(2)})</strong></span>}
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. OBV SPARKLINE
// Data: indicators.timeframes.daily.obv_series (array of 30 floats)
// ─────────────────────────────────────────────────────────────────────────────

export function OBVSparkline({ indicators }) {
  const obvData = indicators?.timeframes?.daily?.obv_series
  if (!obvData || obvData.length < 5) return null

  const W = 300, H = 50
  const min = Math.min(...obvData)
  const max = Math.max(...obvData)
  const range = max - min || 1

  const pts = obvData.map((v, i) => {
    const x = (i / (obvData.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const rising = obvData[obvData.length - 1] > obvData[0]
  const col    = rising ? 'var(--green)' : 'var(--red)'
  const label  = rising ? '▲ ACCUMULATION' : '▼ DISTRIBUTION'

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={sHead}>On-Balance Volume (OBV)</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: col, letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: '50px', display: 'block', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={rising ? 'var(--green-dim)' : 'var(--red-dim)'} />
        <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '4px' }}>
        {rising ? 'Volume confirms upside — smart money accumulating' : 'Volume warns of weakness — distribution pattern'}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. FEAR & GREED GAUGE
// Data: finnhub.fear_greed (added to finnhub_data.py)
// ─────────────────────────────────────────────────────────────────────────────

export function FearGreedGauge({ fearGreed }) {
  if (!fearGreed) return null
  const { index: value = 50, label = 'Neutral', raw = {}, components = {} } = fearGreed

  const col =
    value < 20 ? 'var(--red)'    :
    value < 40 ? 'var(--orange)' :
    value < 60 ? 'var(--yellow)' :
    value < 80 ? '#5cdda0'       : 'var(--green)'

  const r = 56, cx = 80, cy = 72
  const rad = d => (d * Math.PI) / 180
  const angle = -180 + (value / 100) * 180
  const nx = cx + r * Math.cos(rad(angle))
  const ny = cy + r * Math.sin(rad(angle))

  const arcPath = (d1, d2) => {
    const x1 = cx + r * Math.cos(rad(d1))
    const y1 = cy + r * Math.sin(rad(d1))
    const x2 = cx + r * Math.cos(rad(d2))
    const y2 = cy + r * Math.sin(rad(d2))
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>Fear &amp; Greed Index</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="160" height="78" viewBox="0 0 160 78" style={{ flexShrink: 0 }}>
          {[[-180,-144,'#ff3d5a33'],[-144,-108,'#ff8c4033'],[-108,-72,'#ffd06033'],[-72,-36,'#5cdda033'],[-36,0,'#00e88733']].map(([d1,d2,c],i) => (
            <path key={i} d={arcPath(d1,d2)} fill="none" stroke={c} strokeWidth="10" />
          ))}
          <path d={arcPath(-180, Math.min(angle, 0))} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="3.5" fill={col} />
          <text x={cx} y={cy-12} textAnchor="middle" fill={col} fontSize="20" fontFamily="monospace" fontWeight="700">{Math.round(value)}</text>
          <text x={cx} y={cy-2}  textAnchor="middle" fill={col} fontSize="7"  fontFamily="monospace">{label}</text>
          <text x="12"  y="76" fill="var(--red)"   fontSize="7" fontFamily="monospace">Fear</text>
          <text x="136" y="76" fill="var(--green)" fontSize="7" fontFamily="monospace">Greed</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {raw.vix != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>VIX</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: raw.vix > 25 ? 'var(--red)' : 'var(--text2)', fontWeight: 600 }}>{raw.vix.toFixed(1)}</span>
            </div>
          )}
          {raw.spy_20d_pct != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>SPY 20d</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: raw.spy_20d_pct > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{raw.spy_20d_pct > 0 ? '+' : ''}{raw.spy_20d_pct.toFixed(1)}%</span>
            </div>
          )}
          {raw.put_call_ratio != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>Put/Call</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: raw.put_call_ratio > 1 ? 'var(--red)' : 'var(--text2)', fontWeight: 600 }}>{raw.put_call_ratio.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. SENTIMENT DIVERGENCE ALERT
// Detects when price direction ≠ sentiment direction (7-day window)
// priceChange7d: from sr (compare current vs recent) — approximated from 52w data
// sentimentScore: finnhub.sentiment.sentiment_score
// ─────────────────────────────────────────────────────────────────────────────

export function SentimentDivergenceAlert({ sentiment, sr }) {
  if (!sentiment || !sr) return null

  // Approximate 7-day price change from distance to support/resistance
  // A rough proxy: if price is near 52W low, it's been falling
  const pct52l = sr.pct_from_52w_low   ?? 0
  const pct52h = sr.pct_from_52w_high  ?? 0
  const sentScore = sentiment.sentiment_score ?? 0

  // Bullish divergence: down >10% from 52w high BUT sentiment is positive
  const bullishDiv = pct52h < -10 && sentScore > 0.15
  // Bearish divergence: near 52w high BUT sentiment is negative
  const bearishDiv = pct52h > -5  && sentScore < -0.15

  if (!bullishDiv && !bearishDiv) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      background: bullishDiv ? 'var(--green-dim)' : 'var(--red-dim)',
      border: `1px solid ${bullishDiv ? 'var(--green)' : 'var(--red)'}`,
      borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '12px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', flexShrink: 0 }}>{bullishDiv ? '⚡' : '⚠'}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: bullishDiv ? 'var(--green)' : 'var(--red)', letterSpacing: '0.1em', marginBottom: '3px' }}>
          {bullishDiv ? 'BULLISH DIVERGENCE' : 'BEARISH DIVERGENCE'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', lineHeight: 1.6 }}>
          {bullishDiv
            ? `Price is ${Math.abs(pct52h).toFixed(1)}% below 52W high but news sentiment is positive (${(sentScore * 100).toFixed(0)}pts) — potential accumulation.`
            : `Price near 52W high but news sentiment is negative (${(sentScore * 100).toFixed(0)}pts) — potential distribution.`
          }
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. ATR RISK MANAGEMENT PANEL
// Data: indicators.timeframes.daily.atr14 (added to twelve_data.py)
// ─────────────────────────────────────────────────────────────────────────────

export function ATRRiskPanel({ indicators, signal }) {
  const atr   = indicators?.timeframes?.daily?.atr14
  const price = indicators?.price
  if (!atr || !price) return null

  const isBull = signal === 'STRONG BUY' || signal === 'BUY'
  const isBear = signal === 'STRONG SELL' || signal === 'SELL'

  const modes = [
    { label: 'Conservative', stopMult: 1.5, tgtMult: 2.0 },
    { label: 'Aggressive',   stopMult: 2.0, tgtMult: 3.0 },
  ]

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>ATR Risk Management</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '8px' }}>
        ATR-14: <strong style={{ color: 'var(--text2)' }}>${atr.toFixed(2)}</strong>
        &nbsp;·&nbsp;
        Volatility: <strong style={{ color: (atr / price) > 0.03 ? 'var(--orange)' : 'var(--text2)' }}>{(atr / price * 100).toFixed(1)}% daily</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {modes.map(({ label, stopMult, tgtMult }) => {
          const stop   = price - stopMult * atr
          const target = price + tgtMult  * atr
          const rr     = ((target - price) / (price - stop)).toFixed(1)
          return (
            <div key={label} style={statBox}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px' }}>{label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>Stop</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', fontWeight: 700 }}>${stop.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)' }}>Target</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}>${target.toFixed(2)}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' }}>R:R 1:{rr}</div>
            </div>
          )
        })}
      </div>
      {isBull && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--green)', marginTop: '6px' }}>▲ BUY signal — use conservative stop for initial entry</div>}
      {isBear && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red)',   marginTop: '6px' }}>▼ SELL signal — stops apply to short positions (reverse levels)</div>}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. VALUE AT RISK PANEL
// Parametric VaR using daily volatility from ATR / price
// ─────────────────────────────────────────────────────────────────────────────

export function VaRPanel({ indicators, positionSize = 10000 }) {
  const atr   = indicators?.timeframes?.daily?.atr14
  const price = indicators?.price
  if (!atr || !price || price === 0) return null

  const dailyVol = atr / price     // ATR/price ≈ daily volatility %
  const shares   = Math.floor(positionSize / price)
  const posVal   = shares * price

  const var95_1d  = posVal * dailyVol * 1.645
  const var99_1d  = posVal * dailyVol * 2.326
  const var95_10d = var95_1d * Math.sqrt(10)
  const cvar95    = var95_1d * 1.25

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>Value at Risk (VaR)</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '8px' }}>
        {shares} shares · ${posVal.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Daily vol {(dailyVol * 100).toFixed(1)}%
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          { label: '1-Day VaR 95%',  v: var95_1d,  col: 'var(--yellow)' },
          { label: '1-Day VaR 99%',  v: var99_1d,  col: 'var(--orange)' },
          { label: '10-Day VaR 95%', v: var95_10d, col: 'var(--red)'    },
          { label: 'CVaR (ES) 95%',  v: cvar95,    col: 'var(--red)'    },
        ].map(m => (
          <div key={m.label} style={statBox}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: m.col }}>-${m.v.toFixed(0)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' }}>({(m.v / posVal * 100).toFixed(1)}%)</div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. MACRO CALENDAR
// Data: finnhub.macro (added in finnhub_data.py /calendar/economic)
// ─────────────────────────────────────────────────────────────────────────────

export function MacroCalendar({ events }) {
  if (!events || events.length === 0) return null

  const today = new Date()
  const impactColor = { high: 'var(--red)', medium: 'var(--yellow)' }

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>Macro Calendar (next 30 days)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {events.slice(0, 6).map((ev, i) => {
          const d        = new Date(ev.date)
          const daysAway = Math.round((d - today) / 86400000)
          const col      = impactColor[ev.impact] || 'var(--text3)'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${col}`,
              borderRadius: 'var(--radius)', padding: '7px 10px',
            }}>
              <div style={{ width: '40px', flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', fontWeight: 700 }}>
                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: daysAway <= 3 ? 'var(--red)' : 'var(--text3)' }}>
                  {daysAway === 0 ? 'TODAY' : daysAway < 0 ? 'PAST' : `${daysAway}d`}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                {(ev.forecast || ev.prev) && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', marginTop: '2px' }}>
                    {ev.forecast && <span>Fcst: <span style={{ color: 'var(--text2)' }}>{ev.forecast}</span></span>}
                    {ev.prev     && <span style={{ marginLeft: '8px' }}>Prev: <span style={{ color: 'var(--text2)' }}>{ev.prev}</span></span>}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: col, border: `1px solid ${col}`, borderRadius: '2px', padding: '1px 5px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                {ev.impact}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 8. FUNDAMENTALS BAR
// Data: finnhub.financials already returned by finnhub_data.py
// pe_ttm, eps_ttm, beta, revenue_growth — just needed a UI home
// ─────────────────────────────────────────────────────────────────────────────

export function FundamentalsBar({ financials }) {
  if (!financials) return null
  const { pe_ttm, eps_ttm, beta, revenue_growth } = financials

  // All four null → nothing to show
  if ([pe_ttm, eps_ttm, beta, revenue_growth].every(v => v == null)) return null

  const metrics = [
    { label: 'P/E TTM',   value: pe_ttm           != null ? pe_ttm.toFixed(1)           : '—', color: pe_ttm > 40 ? 'var(--orange)' : pe_ttm > 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'EPS TTM',   value: eps_ttm           != null ? `$${eps_ttm.toFixed(2)}`    : '—', color: eps_ttm > 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Beta',      value: beta              != null ? beta.toFixed(2)             : '—', color: beta > 1.5 ? 'var(--orange)' : 'var(--text2)' },
    { label: 'Rev Growth',value: revenue_growth    != null ? `${(revenue_growth * 100).toFixed(1)}%` : '—', color: revenue_growth > 0 ? 'var(--green)' : 'var(--red)' },
  ]

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={sHead}>Fundamentals</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ ...statBox, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: m.color, lineHeight: 1.2 }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '3px' }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
