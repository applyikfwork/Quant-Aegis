# Volatility Breakout Intelligence Engine
## Strategy 002 — ATR + Bollinger + Volume + AI Regime Detection

---

## Purpose

Captures explosive breakout moves when market volatility expands.

**Works best in:** News events, momentum breakouts, post-squeeze expansions, crypto volatility spikes  
**Avoids:** Low volume sessions, fake breakouts without volume confirmation, extreme overextension

---

## Architecture — 4 Layers

```
Layer 1: Band Compression Detection  (Bollinger Width squeeze)
    +
Layer 2: Breakout Confirmation       (Price closes outside bands)
    +
Layer 3: Volume Spike Detection      (Volume vs 20-period MA)
    +
Layer 4: AI Regime Filter            (AEGIS AI Center confidence)
    =
Breakout Entry Decision
```

---

## Score System

| Layer              | Indicator            | Points | Condition                        |
|--------------------|---------------------|--------|----------------------------------|
| Breakout Strength  | Bollinger (20,2)     | 0–30   | Price closes outside upper/lower |
| Volume Spike       | Volume / Volume MA   | 0–25   | Volume ≥ 1.5x average            |
| Volatility (ATR)   | ATR 14               | 0–20   | ATR increasing vs prior period   |
| AI Regime          | AI Confidence        | 0–25   | AI confidence ≥ 75%              |
| **Total**          |                      | **100**| **Trade if score ≥ 75**          |

---

## Entry Rules

### LONG Entry (All required)
1. Price closes **above Bollinger upper band** (20 period, 2 std dev)
2. Volume ≥ **1.5x** the 20-period volume average
3. ATR is **increasing** (volatility expanding)
4. AI confidence ≥ **75%**
5. Wait **1 candle close** after breakout (anti-fake-out filter)

### SHORT Entry (All required)
1. Price closes **below Bollinger lower band**
2. Volume ≥ **1.5x** the 20-period volume average
3. ATR is **increasing**
4. AI confidence ≥ **75%**
5. Wait **1 candle close** after breakout

---

## Dynamic Position Sizing

Unlike fixed-percentage methods, position size is calculated dynamically:

```
Position Size = Risk Amount / (ATR × 1.5)

Where:
  Risk Amount = Account Balance × 1.5%
```

This naturally reduces position size in high-volatility conditions.

---

## Exit Rules

| Trigger        | Condition                        |
|---------------|----------------------------------|
| Take Profit   | Entry ± (ATR × 4.0)              |
| Stop Loss     | Entry ∓ (ATR × 1.5)              |
| Trailing Stop | Activates after ATR × 1.5 profit |
| Trail Distance| ATR × 1.0 from highest point     |

**Risk:Reward = 1:2.67 minimum (ATR×1.5 vs ATR×4.0)**

---

## Pre-Breakout Compression Signal

Bollinger Band squeeze (width below historical average) signals potential breakout. System monitors compression and prepares entry when breakout occurs.

```
Compression: BB Width < Historical Average × 0.03
Breakout: Price closes outside bands + Volume spike
```

---

## Risk Management

- Risk per trade: **1.5%** of account balance
- Maximum open positions: **3**
- Maximum drawdown: **20%** (strategy auto-pauses)
- Daily loss limit: **4%**
- Stop loss: ATR × 1.5 (dynamic, tight)
- Trailing stop: Enabled after 1.5x ATR profit

---

## Module Connections

| Module       | Data Required              | Data Sent                       |
|-------------|----------------------------|---------------------------------|
| AI Center   | Market regime, confidence  | Breakout signal confidence      |
| Risk Center | Account balance, drawdown  | Dynamic position size, ATR risk |
| Analytics   | —                          | Signals, P&L, breakout stats    |
| Research Lab| —                          | Pattern data, failed breakouts  |
| Portfolio   | Open positions count       | New breakout position           |

---

## Performance Expectations

- Estimated win rate: **48%**
- Estimated risk:reward: **1:2.67**
- Estimated Sharpe ratio: **1.6**
- Best timeframe: **1H**
- Best assets: BTC, ETH, SOL (high volatility crypto)

---

## Version History

| Version | Date       | Changes                       |
|---------|-----------|-------------------------------|
| 1.0.0   | 2026-06-19 | Initial release               |

---

*Part of AEGIS QUANT AI Strategy Engine*
