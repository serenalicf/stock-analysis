import { scoreColor, DIM_LABELS } from '../utils'

const DIM_KEYS = ['technicals', 'trend', 'support_resistance', 'analyst', 'sentiment']
const WEIGHTS  = { technicals: 40, trend: 20, support_resistance: 15, analyst: 15, sentiment: 10 }

export function DimBars({ breakdown }) {
  if (!breakdown) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '20px' }}>
      {DIM_KEYS.map(key => {
        const val   = breakdown[key] ?? 50
        const color = scoreColor(val)
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--label-sm)',   /* 11px — was 9px */
              letterSpacing: '0.08em',
              color: 'var(--text2)',          /* stronger — was text3 */
              width: '92px',
              flexShrink: 0,
              textTransform: 'uppercase',
            }}>
              {DIM_LABELS[key]}
            </span>

            <div style={{
              flex: 1, height: '4px',
              background: 'var(--border)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${val}%`,
                background: color,
                borderRadius: '2px',
                transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>

            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',     /* 13px — was 10px */
              color: 'var(--text)',
              width: '28px',
              textAlign: 'right',
              flexShrink: 0,
              fontWeight: 600,
            }}>
              {Math.round(val)}
            </span>

            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--label-xs)',
              color: 'var(--text3)',
              width: '30px',
              flexShrink: 0,
            }}>
              {WEIGHTS[key]}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
