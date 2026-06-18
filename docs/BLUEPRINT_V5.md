# AEGIS QUANT AI — BLUEPRINT V5

# TRADING ENGINE + BACKTESTING + STRATEGY RESEARCH LAB

This is the part that turns the platform from a data system into a **quant research machine**.

The purpose:

> Create, test, validate, compare, and improve trading strategies using data before risking real money.

---

## 1. Trading Engine Overview

```
                TRADING ENGINE

Market Data
      ↓
Feature Engine
      ↓
Strategy Engine
      ↓
Signal Engine
      ↓
Risk Engine
      ↓
Execution Engine
      ↓
Trade Database
      ↓
Analytics + Learning
```

---

## 2. Strategy Research Lab

Do not create one strategy. Create a strategy ecosystem.

```
Strategies

├── Trend Following      ← EMA alignment + ADX strength
├── Momentum             ← RSI breakout + volume surge
├── Breakout             ← range break + volume confirmation
├── Mean Reversion       ← RSI extremes + Bollinger Band touch
├── Volatility           ← ATR expansion plays
├── Market Making        ← (Phase 6 — requires exchange API)
└── AI Generated Ideas   ← (Phase 7 — LLM proposes variants)
```

---

## 3. Strategy Structure

Every strategy is fully defined as a data object — no hardcoded logic:

```json
{
  "name": "Momentum V1",
  "timeframe": "15m",
  "entry_rules": [
    "EMA20 > EMA50",
    "Volume increasing",
    "RSI between 40–65"
  ],
  "exit_rules": [
    "Stop loss hit",
    "Take profit hit",
    "Trend change (EMA cross down)"
  ],
  "risk_percent": 2,
  "version": 1
}
```

---

## 4. Strategy Engine

The engine receives the current market state and runs rules:

```
Current Market + Indicators + Patterns + Context
        ↓
Check entry_rules one by one:

  EMA20 > EMA50         ✓
  RSI = 55              ✓
  Volume rising         ✓
  Trend bullish         ✓

Result: BUY candidate → create signal
```

---

## 5. Signal Engine

Never trade directly. Always create a signal first.

Signal record:

```
signals table:

  id
  symbol
  strategy_id
  direction       BUY | SELL | HOLD
  confidence      0–100
  reasons         []
  status          pending | executed | expired
  created_at
```

Example signal:

```
BTCUSDT — BUY — Confidence 82%

Reasons:
  - Trend aligned (EMA20 > EMA50 > EMA200)
  - Volume confirmed (2.1x average)
  - RSI healthy (55, not overbought)
```

---

## 6. Multi-Strategy Engine

Professional systems compare strategies before committing.

Example — BTC 4h:

```
Strategy A (Momentum):    BUY  — Confidence 80%
Strategy B (Breakout):    HOLD — Confidence 45%
Strategy C (Trend):       BUY  — Confidence 76%

Agreement: 2/3
Final signal: BUY — Combined confidence: 78%
```

Rule: require minimum N strategies to agree before executing.

---

## 7. Risk Engine

This protects the account. Every trade must pass risk checks before execution.

Checks performed:

```
Account Risk %          ← Never exceed per-trade limit
Position Size           ← Calculated from risk + stop distance
Stop Loss               ← Required; no trade without a stop
Maximum Exposure        ← Total open positions within portfolio limit
Daily Loss Limit        ← Halt trading if daily drawdown threshold hit
Correlation Check       ← Avoid stacking highly correlated positions
```

### Position Sizing Formula

```
Risk Amount   = Account × Risk%
               = $10,000 × 1%
               = $100

Position Size = Risk Amount / Stop Distance
               = $100 / $500
               = 0.2 BTC
```

---

## 8. Portfolio Manager

Tracks all open positions together.

Monitors:

```
Open positions (count, symbols, sides)
Correlation between positions
Total portfolio exposure %
Risk concentration per asset
```

Example of what to AVOID:

```
BTC long + ETH long + SOL long
```

All three move together — this is 3x the intended risk, not three independent bets.

Rule: maximum correlation-adjusted exposure defined per account tier.

---

## 9. Execution Engine

Responsible for placing real orders (Phase 5+ with exchange integration).

Flow:

```
Signal approved
        ↓
Risk Engine approval
        ↓
Order Creation (type, size, price, stop, TP)
        ↓
Exchange API call
        ↓
Confirmation received
        ↓
Record to database
```

Core functions:

```
place_order(symbol, side, size, order_type, price?)
cancel_order(order_id)
modify_stop(trade_id, new_stop)
close_position(trade_id, exit_price)
```

---

## 10. Order State Machine

Every order tracks state:

```
Pending → Filled → (Open position)
Pending → Partial → Filled
Pending → Cancelled
Open → Closed (stop hit | TP hit | manual close)
```

---

## 11. Backtesting Engine

The research simulator.

It answers:

> "If I used this strategy on historical data, what would have happened?"

Input:

```
Symbol:    BTCUSDT
Period:    2020-01-01 to 2026-01-01
Candles:   15 minute
Strategy:  Momentum V1
```

Output:

```
Total trades:     4,200
Win rate:         58%
Profit factor:    1.80
Max drawdown:     12%
Sharpe ratio:     1.45
Total return:     +34.2%
```

---

## 12. Backtest Flow

```
Load Historical Candles
        ↓
Replay Market candle by candle
        ↓
Run Strategy Rules at each candle close
        ↓
Generate simulated trades
        ↓
Apply risk rules (position size, stop loss)
        ↓
Calculate P&L per trade
        ↓
Aggregate results into report
```

---

## 13. Walk-Forward Testing

Critical. Do not test on all data at once — this overfits.

Correct method:

```
2019–2024   → Training data (find strategy parameters)
2025        → Test data (validate on unseen data)
```

Rule: the strategy must work on data it was NOT trained on.

Walk-forward windows:

```
Window 1:  Train 2019–2021  |  Test 2022
Window 2:  Train 2020–2022  |  Test 2023
Window 3:  Train 2021–2023  |  Test 2024
Window 4:  Train 2022–2024  |  Test 2025
```

---

## 14. Paper Trading Engine

Before risking real money:

```
Live Market Data (real)
        ↓
Fake order execution (simulated fills)
        ↓
Real P&L tracking (virtual account)
        ↓
Compare paper results to backtest
```

Purpose: confirm strategy works in live market before going live.

---

## 15. Strategy Optimizer

Find better parameters by testing combinations.

Example — test EMA lengths:

```
EMA Fast:   [5, 10, 20, 50]
EMA Slow:   [20, 50, 100, 200]
RSI range:  [30-60, 40-65, 45-70]
```

Run backtest for every combination. Find the best risk-adjusted configuration.

### Overfitting Warning

BAD:
```
Parameters tuned perfectly on historical data
→ Likely to fail live
```

GOOD:
```
Parameters that work reasonably across many different periods
→ Robust and likely to continue working
```

Rule: prefer robustness over maximum historical return.

---

## 16. Strategy Version Control

Never delete or overwrite strategy rules.

```
Momentum V1  (original)
        ↓
Momentum V2  (added volume filter — drawdown improved 3%)
        ↓
Momentum V3  (added ADX filter — win rate improved 4%)
```

`strategy_versions` table stores:

```
strategy_id
version
entry_rules      jsonb
exit_rules       jsonb
parameters       jsonb
change_reason    text
performance_before  jsonb
performance_after   jsonb
created_at
```

Rule: always compare performance before/after a change using the same test period.

---

## 17. Trade Simulator

For learning and testing position sizing.

Tracks:

```
Starting Balance:   $10,000
After 1,000 trades: $12,750

Equity curve (chart)
Drawdown curve
Win/loss streak
Monthly P&L breakdown
```

---

## 18. Performance Metrics

### Win Rate

```
win_rate = wins / total_trades
```

### Profit Factor

```
profit_factor = gross_profit / gross_loss
```

Target: > 1.5 minimum, > 2.0 excellent.

### Expectancy

Average expected profit per trade:

```
expectancy = (win_rate × avg_win) - (loss_rate × avg_loss)
```

Must be positive for any strategy to be viable.

### Maximum Drawdown

Largest peak-to-trough decline. Target: < 20%.

### Sharpe Ratio

Risk-adjusted return:

```
sharpe = (avg_return - risk_free_rate) / std_deviation
```

Target: > 1.0.

### Calmar Ratio

```
calmar = annualized_return / max_drawdown
```

---

## 19. Strategy AI Researcher (Phase 7)

AI assists in strategy research:

Example prompt to AI:

```
Analyze the Momentum V2 backtest results.
Find weaknesses in the current entry rules.
Suggest experiments to improve drawdown.
```

AI output:

```
Problem:   Strategy loses during sideways (ranging) markets.
Cause:     EMA crossovers generate false signals when ADX < 20.
Suggestion: Add filter — only enter when ADX > 22.
Test this as Momentum V3 on BTC 2022–2024.
```

---

## 20. Strategy Experiment System

Every improvement idea is recorded as an experiment:

```
experiments table:

  id
  strategy_id
  hypothesis         "Adding ATR filter will reduce false entries"
  change_made        jsonb
  test_period        "2022-2024"
  backtest_result    jsonb
  verdict            "Approved" | "Rejected" | "Pending"
  notes
  created_at
```

Example:

```
Experiment #101

Hypothesis:  Add ATR filter to reduce entries during low-volatility periods
Change:      Entry only when ATR > 14-period average ATR
Test:        BTC 5 years
Result:      Drawdown improved 3.2%, win rate +2.1%, trade count -18%
Verdict:     Approved → becomes Momentum V3
```

---

## 21. Complete Trading Loop

```
Market Data
        ↓
Indicator Calculation
        ↓
Strategy Rules Check
        ↓
Signal Generation
        ↓
Multi-Strategy Agreement
        ↓
Risk Approval
        ↓
Execution (paper or live)
        ↓
Trade Recorded
        ↓
Result + P&L
        ↓
Analytics Update
        ↓
Learning Engine
        ↓
Strategy Improvement
```

---

## 22. Database Tables for V5

### experiments

```
id, strategy_id, hypothesis, change_made (jsonb),
test_period, backtest_result (jsonb), verdict, notes, created_at
```

### paper_trades

```
id, signal_id, strategy_id, symbol, side, entry_price,
exit_price, quantity, stop_loss, take_profit, profit_loss,
profit_percent, status, entry_time, exit_time
```

### optimizer_runs

```
id, strategy_id, parameter_grid (jsonb), best_parameters (jsonb),
all_results (jsonb), test_period, created_at
```

---

## 23. Final V5 Structure

```
Trading Intelligence

├── Strategy Lab          ← strategy definitions, rules, parameters
├── Signal Engine         ← signal generation and scoring
├── Multi-Strategy Engine ← consensus across strategies
├── Risk Manager          ← position sizing, exposure checks
├── Portfolio Manager     ← correlation, total exposure
├── Execution Engine      ← order placement, state tracking
├── Paper Trader          ← live simulation before real money
├── Backtester            ← historical simulation engine
├── Walk-Forward Tester   ← robustness validation
├── Optimizer             ← parameter grid search
├── Performance Analyzer  ← metrics, equity curve, reporting
└── Experiment System     ← hypothesis tracking, versioning
```

---

## Implementation Order

| Step | What to build | Phase |
|------|---------------|-------|
| 1 | Real indicator calculation engine (EMA, RSI, MACD, ATR, ADX, VWAP) | Phase 4 |
| 2 | Real backtesting engine (candle replay, not simulated) | Phase 5 |
| 3 | Walk-forward test runner | Phase 5 |
| 4 | Paper trading engine | Phase 5 |
| 5 | Strategy optimizer (grid search) | Phase 6 |
| 6 | `experiments` and `strategy_versions` tables + UI | Phase 6 |
| 7 | Exchange API integration (Binance/Bybit) | Phase 7 |
| 8 | AI strategy researcher (LLM) | Phase 7 |

---

## Status

Phase 5: **PLANNED** — real backtesting engine is the highest-priority next milestone.

Current state: backtests are simulated (synthetic results). Real candle-replay backtesting is next.

Next blueprint: **V6 — Dashboard + User Interface + Monitoring System**
