"""
Scoring Engine
==============
Weights:
  40%  Technical indicators (RSI / MACD / ADX / BB / EMA) across timeframes
  20%  Trend strength & timeframe alignment
  15%  Support / Resistance positioning
  15%  Analyst ratings & price target
  10%  News + social sentiment
"""

from typing import Tuple


# ── helpers ──────────────────────────────────────────────────────────────────

def clamp(val, lo=0, hi=100):
    return max(lo, min(hi, val))

def safe(val, default=None):
    return val if val is not None else default


# ── 1. Technical indicators (40 pts) ─────────────────────────────────────────

def score_rsi(rsi: float | None) -> float:
    """RSI: oversold → bullish, overbought → bearish. Sweet spot 45–65."""
    if rsi is None:
        return 50
    if rsi < 30:
        return 70        # oversold bounce potential
    if rsi < 45:
        return 55
    if rsi < 65:
        return 70        # healthy bullish momentum
    if rsi < 75:
        return 45        # getting extended
    return 20            # severely overbought

def score_macd(macd: float | None, signal: float | None, hist: float | None) -> float:
    if macd is None or signal is None:
        return 50
    score = 50
    if macd > signal:
        score += 20
    else:
        score -= 20
    if hist is not None:
        if hist > 0:
            score += min(10, hist * 5)
        else:
            score -= min(10, abs(hist) * 5)
    return clamp(score)

def score_adx(adx: float | None) -> float:
    """ADX measures trend strength regardless of direction."""
    if adx is None:
        return 50
    if adx < 20:
        return 40   # weak / choppy
    if adx < 30:
        return 60   # moderate trend
    if adx < 40:
        return 75   # strong trend
    return 85       # very strong trend

def score_bbands(price: float, upper: float | None, lower: float | None,
                 mid: float | None) -> float:
    if None in (upper, lower, mid) or price == 0:
        return 50
    band_width = upper - lower
    if band_width == 0:
        return 50
    pos = (price - lower) / band_width   # 0 = at lower, 1 = at upper
    if pos < 0.2:
        return 75   # near lower band — potential bounce
    if pos < 0.4:
        return 65
    if pos < 0.6:
        return 60   # mid-band — neutral
    if pos < 0.8:
        return 50
    return 35       # near upper band — overextended

def score_ema(price: float, ema20: float | None, ema50: float | None,
              ema200: float | None) -> float:
    if price == 0:
        return 50
    score = 50
    if ema20  and price > ema20:  score += 10
    if ema50  and price > ema50:  score += 15
    if ema200 and price > ema200: score += 20
    # Golden cross bonus
    if ema20 and ema50 and ema20 > ema50:
        score += 5
    return clamp(score)

TF_WEIGHT = {"daily": 0.5, "weekly": 0.35, "monthly": 0.15}

def score_technicals(indicators: dict) -> float:
    price = indicators.get("price", 0)
    total = 0.0
    for tf, w in TF_WEIGHT.items():
        tf_data = indicators.get("timeframes", {}).get(tf, {})
        rsi_s  = score_rsi(tf_data.get("rsi"))
        macd_s = score_macd(tf_data.get("macd"), tf_data.get("macd_signal"), tf_data.get("macd_hist"))
        adx_s  = score_adx(tf_data.get("adx"))
        bb_s   = score_bbands(price, tf_data.get("bb_upper"), tf_data.get("bb_lower"), tf_data.get("bb_mid"))
        ema_s  = score_ema(price, tf_data.get("ema20"), tf_data.get("ema50"), tf_data.get("ema200"))
        tf_score = (rsi_s * 0.25 + macd_s * 0.25 + adx_s * 0.2 + bb_s * 0.15 + ema_s * 0.15)
        total += tf_score * w
    return clamp(total)


# ── 2. Trend alignment (20 pts) ───────────────────────────────────────────────

def score_trend_alignment(indicators: dict) -> float:
    """Reward when daily/weekly/monthly all agree in direction."""
    price = indicators.get("price", 0)
    bullish_tfs = 0
    for tf in ["daily", "weekly", "monthly"]:
        tf_data = indicators.get("timeframes", {}).get(tf, {})
        rsi  = tf_data.get("rsi")
        macd = tf_data.get("macd")
        sig  = tf_data.get("macd_signal")
        ema50 = tf_data.get("ema50")
        votes = 0
        if rsi and rsi > 50:   votes += 1
        if macd and sig and macd > sig: votes += 1
        if ema50 and price > ema50:    votes += 1
        if votes >= 2:
            bullish_tfs += 1

    if bullish_tfs == 3: return 90
    if bullish_tfs == 2: return 65
    if bullish_tfs == 1: return 40
    return 15


# ── 3. Support / Resistance (15 pts) ─────────────────────────────────────────

def score_sr(sr: dict) -> float:
    score = 50
    dist_sup = sr.get("dist_to_support")
    dist_res = sr.get("dist_to_resistance")
    pct_52h  = sr.get("pct_from_52w_high")
    pct_52l  = sr.get("pct_from_52w_low")

    # Close to support → good risk/reward
    if dist_sup is not None:
        if dist_sup < 2:   score += 25
        elif dist_sup < 5: score += 15
        elif dist_sup < 10: score += 5

    # Far from resistance → room to run
    if dist_res is not None:
        if dist_res > 10:  score += 15
        elif dist_res > 5: score += 8
        elif dist_res < 2: score -= 15  # pinned to resistance

    # 52-week range position
    if pct_52l is not None and pct_52h is not None:
        range_pos = pct_52l / (pct_52l + abs(pct_52h) + 0.001)
        score += (range_pos - 0.5) * 10

    return clamp(score)


# ── 4. Analyst ratings (15 pts) ───────────────────────────────────────────────

def score_analyst(analyst: dict, current_price: float) -> float:
    score = 50
    bull_pct = analyst.get("bullish_pct", 50)
    bear_pct = analyst.get("bearish_pct", 0)
    score += (bull_pct - bear_pct) * 0.4

    mean_target = analyst.get("target_mean")
    if mean_target and current_price:
        upside = (mean_target - current_price) / current_price * 100
        if upside > 20:  score += 20
        elif upside > 10: score += 12
        elif upside > 0:  score += 5
        elif upside < -10: score -= 15
        else:              score -= 5

    return clamp(score)


# ── 5. Sentiment (10 pts) ─────────────────────────────────────────────────────

def score_sentiment(sentiment: dict) -> float:
    score = 50

    # bullish_pct / bearish_pct are now 0.0–1.0 decimals from headline analysis
    news_bull = sentiment.get("bullish_pct", 0) or 0
    news_bear = sentiment.get("bearish_pct", 0) or 0
    recent    = sentiment.get("recent_count", 0) or 0

    if recent > 0:
        # Scale: (bull - bear) ranges -1 to +1, multiply to ±30 pts
        score += (news_bull - news_bear) * 30

    # sentiment_score is pre-computed (bull-bear)/total, range -1 to +1
    sent_score = sentiment.get("sentiment_score", 0) or 0
    score += sent_score * 10

    return clamp(score)


# ── Master score ──────────────────────────────────────────────────────────────

WEIGHTS = {
    "technicals":  0.40,
    "trend":       0.20,
    "sr":          0.15,
    "analyst":     0.15,
    "sentiment":   0.10,
}

def signal_label(score: float) -> str:
    if score >= 75: return "STRONG BUY"
    if score >= 60: return "BUY"
    if score >= 45: return "NEUTRAL"
    if score >= 30: return "SELL"
    return "STRONG SELL"

def compute_score(indicators: dict, finnhub: dict, sr: dict) -> Tuple[float, dict, str]:
    price = indicators.get("price") or sr.get("current_price", 0)

    tech_s      = score_technicals(indicators)
    trend_s     = score_trend_alignment(indicators)
    sr_s        = score_sr(sr)
    analyst_s   = score_analyst(finnhub.get("analyst", {}), price)
    sentiment_s = score_sentiment(finnhub.get("sentiment", {}))

    composite = (
        tech_s      * WEIGHTS["technicals"] +
        trend_s     * WEIGHTS["trend"] +
        sr_s        * WEIGHTS["sr"] +
        analyst_s   * WEIGHTS["analyst"] +
        sentiment_s * WEIGHTS["sentiment"]
    )
    composite = clamp(composite)

    breakdown = {
        "technicals":  round(tech_s, 1),
        "trend":       round(trend_s, 1),
        "support_resistance": round(sr_s, 1),
        "analyst":     round(analyst_s, 1),
        "sentiment":   round(sentiment_s, 1),
        "weights":     WEIGHTS,
    }

    return composite, breakdown, signal_label(composite)
