import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { scoreColor } from '../utils'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border2)',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
    }}>
      <div style={{ color: 'var(--text2)', marginBottom: '6px', fontSize: '10px' }}>{d.label} {d.time}</div>
      <div style={{ color: scoreColor(d.score), fontWeight: 700, fontSize: '16px' }}>{d.score}</div>
      <div style={{ color: 'var(--text3)', fontSize: '9px', marginTop: '2px' }}>{d.signal}</div>
      {d.technicals != null && (
        <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
          {[['Indicators', d.technicals], ['Trend', d.trend], ['S/R', d.sr], ['Analyst', d.analyst], ['Sentiment', d.sentiment]].map(([l, v]) =>
            v != null ? <div key={l} style={{ color: 'var(--text3)', fontSize: '9px' }}>{l}: <span style={{ color: 'var(--text)' }}>{Math.round(v)}</span></div> : null
          )}
        </div>
      )}
    </div>
  )
}

export function ScoreHistoryChart({ history, ticker }) {
  if (!history || history.length < 2) {
    return (
      <div style={{
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--text3)',
        letterSpacing: '0.08em',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        {history?.length === 1 ? 'Analyze again to build history' : 'No history yet'}
      </div>
    )
  }

  const lastScore = history[history.length - 1]?.score ?? 50
  const color = scoreColor(lastScore)

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
        <XAxis
          dataKey="label"
          tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text3)' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text3)' }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 50, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="var(--border2)" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={1.5}
          dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: color }}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
