import { useState } from 'react'
import { Search, Loader, X } from 'lucide-react'
import { PRESETS } from '../utils'

export function SearchBar({ onAnalyze, loading }) {
  const [value, setValue] = useState('')

  const submit = () => {
    const tickers = value.split(/[\s,]+/).map(t => t.toUpperCase()).filter(Boolean)
    if (tickers.length) onAnalyze(tickers)
  }

  const applyPreset = (tickerStr) => {
    setValue(tickerStr)
    onAnalyze(tickerStr.split(','))
  }

  const clear = () => setValue('')

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 32px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg2)',
      flexWrap: 'wrap',
    }}>

      {/* Input */}
      <div style={{ position: 'relative', width: '260px', flexShrink: 0 }}>
        <Search
          size={13}
          style={{ position: 'absolute', left: '10px', top: '50%',
                   transform: 'translateY(-50%)', color: 'var(--text3)',
                   pointerEvents: 'none' }}
        />
        <input
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="AAPL, MSFT, NVDA …"
          spellCheck={false}
          autoComplete="off"
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            letterSpacing: '0.05em',
            padding: '7px 28px 7px 30px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {value && (
          <button
            onClick={clear}
            style={{ position: 'absolute', right: '8px', top: '50%',
                     transform: 'translateY(-50%)', background: 'none',
                     border: 'none', color: 'var(--text3)', cursor: 'pointer',
                     padding: 0, display: 'flex' }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Analyze button */}
      <button
        onClick={submit}
        disabled={loading}
        style={{
          background: 'var(--accent)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          padding: '7px 18px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          textTransform: 'uppercase',
          flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.6' : '1' }}
      >
        {loading
          ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          : <Search size={12} />}
        {loading ? 'Loading…' : 'Analyze'}
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

      {/* Inline preset tags */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: 'var(--text3)', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        Presets:
      </span>
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.tickers)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            padding: '3px 9px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text2)',
            cursor: 'pointer',
            background: 'transparent',
            transition: 'border-color 0.15s, color 0.15s',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
