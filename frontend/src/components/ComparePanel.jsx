import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import { ScoreRing } from './ScoreRing'
import { DimBars } from './DimBars'
import { signalMeta, scoreColor, DIM_LABELS } from '../utils'

const DIM_KEYS = ['technicals', 'trend', 'support_resistance', 'analyst', 'sentiment']

function CompareCol({ result }) {
  if (!result) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.1em', textAlign: 'center' }}>
          Click <strong style={{ color: 'var(--accent)' }}>⇄</strong> on any card<br />to compare here
        </div>
      </div>
    )
  }

  const { ticker, score, signal, breakdown, analyst, support_resistance: sr, indicators } = result
  const sm = signalMeta(signal)
  const price = indicators?.price || sr?.current_price || 0

  return (
    <div style={{ flex: 1, padding: '0 20px', borderRight: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800 }}>{ticker}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>${price > 0 ? price.toFixed(2) : '—'}</div>
          <div style={{
            display: 'inline-block',
            marginTop: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '3px 9px',
            background: sm.bg,
            color: sm.text,
            border: `1px solid ${sm.border}`,
            borderRadius: '3px',
            textTransform: 'uppercase',
          }}>{signal}</div>
        </div>
        <ScoreRing score={score} size={72} />
      </div>

      <DimBars breakdown={breakdown} />

      {/* Analyst */}
      {analyst?.total > 0 && (
        <>
          <div style={subHead}>Analyst</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginBottom: '12px' }}>
            <span style={{ color: 'var(--green)' }}>{analyst.bullish_pct}% bull</span>
            {' · '}
            <span style={{ color: 'var(--red)' }}>{analyst.bearish_pct}% bear</span>
            {analyst.target_mean && (
              <> · Target <strong style={{ color: 'var(--text)' }}>${analyst.target_mean.toFixed(2)}</strong></>
            )}
          </div>
        </>
      )}

      {/* S/R */}
      {(sr?.nearest_support || sr?.nearest_resistance) && (
        <>
          <div style={subHead}>S/R</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginBottom: '12px' }}>
            <span style={{ color: 'var(--green)' }}>${sr.nearest_support?.toFixed(2)}</span>
            {' ↔ '}
            <span style={{ color: 'var(--accent)' }}>${price.toFixed(2)}</span>
            {' ↔ '}
            <span style={{ color: 'var(--red)' }}>${sr.nearest_resistance?.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  )
}

const subHead = {
  fontFamily: 'var(--font-mono)',
  fontSize: '9px',
  letterSpacing: '0.18em',
  color: 'var(--text3)',
  textTransform: 'uppercase',
  marginBottom: '6px',
}

function WinnerBadge({ left, right }) {
  if (!left || !right) return null
  const DIM_KEYS_CMP = ['technicals', 'trend', 'support_resistance', 'analyst', 'sentiment']
  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
      <div style={{ ...subHead, textAlign: 'center', marginBottom: '10px' }}>Head to Head</div>
      {DIM_KEYS_CMP.map(k => {
        const lv = left.breakdown?.[k] ?? 50
        const rv = right.breakdown?.[k] ?? 50
        const winner = lv > rv ? 'left' : rv > lv ? 'right' : 'tie'
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: winner === 'left' ? 'var(--accent)' : 'var(--text)', width: '28px', textAlign: 'right' }}>{Math.round(lv)}</span>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{DIM_LABELS[k]}</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: winner === 'right' ? 'var(--accent)' : 'var(--text)', width: '28px' }}>{Math.round(rv)}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: left.score > right.score ? 'var(--accent)' : 'var(--text2)' }}>
          {left.score > right.score ? '◀ WINNER' : ''}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: right.score > left.score ? 'var(--accent)' : 'var(--text2)' }}>
          {right.score > left.score ? 'WINNER ▶' : left.score === right.score ? 'TIE' : ''}
        </span>
      </div>
    </div>
  )
}

export function ComparePanel({ left, right, onClear, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      right: 0, top: 0, bottom: 0,
      width: 'min(760px, 95vw)',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border2)',
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.3s ease',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em', color: 'var(--text2)', textTransform: 'uppercase' }}>
          Compare
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClear}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.1em' }}
          >
            CLEAR
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Cols */}
      <div style={{ display: 'flex', flex: 1, overflow: 'auto', padding: '20px 0' }}>
        <CompareCol result={left} />
        <CompareCol result={right} />
      </div>

      {/* Head to head */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
        <WinnerBadge left={left} right={right} />
      </div>
    </div>
  )
}
