# Adaptive AI Trend Fusion Engine
## Strategy 001 — Multi-Timeframe Trend Following + Momentum + Risk Adaptive

---

## Purpose

Captures large market movements in strong trending conditions.

**Works best in:** Strong trends, momentum markets, post-consolidation breakouts  
**Avoids:** Sideways markets, ranging conditions, low volatility environments

---

## Architecture — 5 Layers

```
Layer 1: Market Regime Detection  (EMA structure)
    +
Layer 2: Trend Confirmation       (EMA 50 / EMA 200 alignment)
    +
Layer 3: Momentum Confirmation    (RSI 14)
    +
Layer 4: Volume Confirmation      (Volume vs Moving Average)
    +
Layer 5: AI Confidence Filter     (AEGIS AI Center)
    =
Entry Decision
```

---

## Score System

Every condition contributes points. Trade only when total ≥ threshold.

| Layer     | Indicator        | Points | Condition                          |
|-----------|-----------------|--------|-------------------------------------|
| Trend     | EMA 50 / 200    | 30     | EMA50 > EMA200 (bullish) or <  (bearish) |
| Momentum  | RSI 14          | 25     | RSI > 55 (bull) / RSI < 45 (bear) |
| MACD      | MACD (12,26,9)  | 20     | MACD crossover confirmation        |
| Volume    | Volume MA (20)  | 15     | Current volume ≥ average × 1.0x    |
| AI        | AI Confidence   | 10     | AI confidence ≥ 65%                |
| **Total** |                 | **100**| **Trade if score ≥ 70**            |

---

## Entry Rules

### LONG Entry (All required)
1. EMA 50 > EMA 200 (bullish golden cross zone)
2. RSI > 55 (bullish momentum confirmed)
3. MACD line crosses above signal line
4. Current volume > average volume
5. AI confidence ≥ 65%

### SHORT Entry (All required)
1. EMA 50 < EMA 200 (bearish death cross zone)
2. RSI < 45 (bearish momentum confirmed)
3. MACD line crosses below signal line
4. Current volume > average volume
5. AI confidence ≥ 65%

---

## Exit Rules

| Trigger       | Condition                             |
|--------------|---------------------------------------|
| Take Profit  | Entry ± (ATR × 2.0 × RR 3.0)         |
| Stop Loss    | Entry ∓ (ATR × 2.0)                   |
| Trend Exit   | EMA 50/200 crossover in opposite dir  |

**Risk:Reward = 1:3 minimum**

---

## Risk Management

- Risk per trade: **1%** of account balance
- Maximum open positions: **5**
- Maximum drawdown: **15%** (strategy pauses)
- Daily loss limit: **3%**
- Stop loss: ATR-based dynamic (no fixed %)

---

## Module Connections

| Module        | Data Required                   | Data Sent                    |
|--------------|---------------------------------|------------------------------|
| AI Center    | Market sentiment, confidence %  | Signal confidence score      |
| Risk Center  | Account balance, drawdown       | Position size, risk amount   |
| Analytics    | —                               | Every signal, P&L, drawdown  |
| Portfolio    | Open positions count            | New position details         |
| Paper Trading| —                               | Entry/exit signals           |

---

## Performance Expectations

- Estimated win rate: **52%**
- Estimated risk:reward: **1:3**
- Estimated Sharpe ratio: **1.4**
- Best timeframe: **4H**
- Best assets: BTC, ETH, SOL (high liquidity trending assets)

---

## Version History

| Version | Date       | Changes                    |
|---------|-----------|----------------------------|
| 1.0.0   | 2026-06-19 | Initial release            |

---

*Part of AEGIS QUANT AI Strategy Engine*
