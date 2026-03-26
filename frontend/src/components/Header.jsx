import { Sun, Moon, BarChart2 } from 'lucide-react'

const s = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    height: '58px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg2)',
    position: 'sticky',
    top: 0,
    zIndex: 200,
    backdropFilter: 'blur(12px)',
  },
  left: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: {
    fontFamily: 'var(--font-display)',
    fontSize: '17px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    color: 'var(--text)',
  },
  logoAccent: { color: 'var(--accent)' },
  badge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    letterSpacing: '0.15em',
    color: 'var(--text2)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    padding: '2px 7px',
    borderRadius: '2px',
    textTransform: 'uppercase',
  },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  clock: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text3)',
    letterSpacing: '0.06em',
  },
  themeBtn: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text2)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.2s, color 0.2s',
  },
}

export function Header({ theme, onToggleTheme, clock }) {
  return (
    <header style={s.header}>
      <div style={s.left}>
        <BarChart2 size={18} color="var(--accent)" />
        <span style={s.logo}>
          SIGNAL<span style={s.logoAccent}>.</span>
        </span>
        <span style={s.badge}>Beta</span>
      </div>

      <div style={s.right}>
        <span style={s.clock}>{clock}</span>
        <button
          style={s.themeBtn}
          onClick={onToggleTheme}
          title="Toggle theme"
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  )
}
