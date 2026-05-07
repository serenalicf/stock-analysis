export function scoreColor(score, theme = 'dark') {
  if (score >= 75) return 'var(--green)'
  if (score >= 60) return theme === 'dark' ? '#5cdda0' : '#007a48'
  if (score >= 45) return 'var(--yellow)'
  if (score >= 30) return 'var(--orange)'
  return 'var(--red)'
}

export function signalMeta(signal) {
  const map = {
    'STRONG BUY':  { bg: 'var(--green-dim)',  text: 'var(--green)',  border: 'var(--green)' },
    'BUY':         { bg: 'var(--green-dim)',  text: 'var(--green)',  border: 'var(--green)' },
    'NEUTRAL':     { bg: 'var(--yellow-dim)', text: 'var(--yellow)', border: 'var(--yellow)' },
    'SELL':        { bg: 'var(--red-dim)',    text: 'var(--orange)', border: 'var(--orange)' },
    'STRONG SELL': { bg: 'var(--red-dim)',    text: 'var(--red)',    border: 'var(--red)' },
  }
  return map[signal] || { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent)' }
}

// Updated dimension labels — matches new scoring.py WEIGHTS keys
export const DIM_LABELS = {
  technicals:          'Indicators',
  trend:               'Trend Align',
  support_resistance:  'Support/Res',
  obv_vwap:            'OBV/VWAP',    // NEW
  fibonacci:           'Fibonacci',   // NEW
  analyst:             'Analyst',
  sentiment:           'Sentiment',
  fear_greed:          'Fear/Greed',  // NEW
}

export const PRESETS = [
  { label: 'MAG-5',     tickers: 'AAPL,MSFT,GOOGL,AMZN,NVDA' },
  { label: 'ETFs',      tickers: 'SPY,QQQ,IWM,DIA,GLD' },
  { label: 'Momentum',  tickers: 'TSLA,PLTR,COIN,MSTR,RBLX' },
  { label: 'Banks',     tickers: 'JPM,BAC,GS,MS,WFC' },
]
