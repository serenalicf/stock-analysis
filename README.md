# Signal — Stock Trading Signal Analyzer

A multi-dimensional stock analysis dashboard built with **React + Vite** (frontend) and **FastAPI** (backend).

## Data Sources
- **Twelve Data** — RSI, MACD, ADX, Bollinger Bands, EMA across daily / weekly / monthly
- **Finnhub** — Analyst ratings, price targets, news & social sentiment
- **yfinance** — Historical OHLC for support/resistance level detection

## Features
- 0–100 composite score with signal (STRONG BUY → STRONG SELL)
- Dimension breakdown bars (Indicators / Trend / S&R / Analyst / Sentiment)
- Score history chart per ticker (stored in localStorage)
- Side-by-side compare panel with head-to-head breakdown
- Persistent watchlist (localStorage) with one-click "Run All"
- Dark / light mode toggle

---

## Setup

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Add API keys
```bash
cp .env.template .env
# Edit .env — paste your Twelve Data and Finnhub keys
```

### 3. Build the React frontend
```bash
cd frontend
npm install
npm run build   # outputs to ../static/
cd ..
```

### 4. Run the server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Open the app
Visit http://localhost:8000

---

## Development (hot reload)

Run backend and frontend simultaneously in two terminals:

```bash
# Terminal 1 — FastAPI backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Vite dev server (proxies /analyze to :8000)
cd frontend
npm run dev     # opens http://localhost:3000
```

---

## Project Structure

```
trading-signals/
├── main.py                    # FastAPI app + static serving
├── scoring.py                 # Weighted 0–100 scoring engine
├── data/
│   ├── twelve_data.py         # RSI/MACD/ADX/BB/EMA (3 timeframes)
│   ├── finnhub_data.py        # Ratings, targets, news, social sentiment
│   └── yfinance_data.py       # OHLC -> pivot-based S/R levels
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── WatchlistBar.jsx
│   │   │   ├── TickerGrid.jsx
│   │   │   ├── TickerCard.jsx
│   │   │   ├── ScoreRing.jsx
│   │   │   ├── DimBars.jsx
│   │   │   ├── ComparePanel.jsx
│   │   │   └── ScoreHistoryChart.jsx
│   │   ├── hooks/
│   │   │   ├── useTheme.js
│   │   │   ├── useWatchlist.js
│   │   │   └── useScoreHistory.js
│   │   └── api/analyze.js
│   ├── vite.config.js
│   └── package.json
├── static/                    # Built React output
├── requirements.txt
└── .env.template
```

---

## Scoring Breakdown

| Dimension | Weight |
|---|---|
| Technical Indicators | 40% |
| Trend Alignment | 20% |
| Support/Resistance | 15% |
| Analyst Ratings | 15% |
| News + Social Sentiment | 10% |

Score ranges: 75-100 STRONG BUY | 60-74 BUY | 45-59 NEUTRAL | 30-44 SELL | 0-29 STRONG SELL
