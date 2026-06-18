# AEGIS QUANT AI — BLUEPRINT V7

# COMPLETE DEVELOPMENT ROADMAP (0 → PRODUCTION)

This is the master plan. Every phase, every milestone, what to build, what to learn, and how to scale from zero to a production quantitative research platform.

---

## Overview

```
Phase 1  → UI Shell                     ✅ Complete
Phase 2  → Database + API               ✅ Complete
Phase 3  → Live Market Data             ✅ Complete (CoinGecko)
Phase 4  → AI Brain + New UI Pages      ✅ Complete
Phase 5  → Real Backtesting + Research  ✅ Complete
Phase 6  → Risk Engine + Portfolio      ✅ Complete
Phase 7  → Exchange Integration         🔲 Planned
Phase 8  → Machine Learning Layer       🔲 Planned
Phase 9  → Automation + Alerts          🔲 Planned
Phase 10 → Scale + Production           🔲 Planned
```

---

## Phase 1 — UI Shell
**Goal:** Every page exists. Navigation works. Data displays (even if static).

### What to build

```
Dashboard page
Market Data page
Strategy Library page
Signals Feed page
Trade Journal page
Analytics page
Backtesting page
System Monitor page
```

### Stack

```
React + Vite
Tailwind CSS
Wouter (routing)
TanStack Query (data hooks)
Recharts (charts)
```

### Done when

All 8 pages render. Navigation between them works. No broken routes.

---

## Phase 2 — Database + API
**Goal:** Real data stored and served. No more static values.

### What to build

```
PostgreSQL schema (9 tables)
Express API (30+ endpoints)
OpenAPI spec (source of truth)
Codegen (React Query hooks + Zod schemas)
Seed data (strategies, trades, signals, backtests)
```

### Database tables

```
strategies
market_candles
indicators
signals
trades
trade_reasons
backtests
activity_events
system_logs
```

### Done when

All API endpoints return real data from the database. Frontend reads from API (not hardcoded).

---

## Phase 3 — Live Market Data
**Goal:** Real prices. Real volume. Real 24h stats.

### What to build

```
CoinGecko integration (free, no key required)
/api/market/prices endpoint
Fallback mock data if rate-limited
```

### 8 pairs tracked

```
BTCUSDT  ETHUSDT  BNBUSDT  XRPUSDT
SOLUSDT  ADAUSDT  AVAXUSDT  DOGEUSDT
```

### Done when

Dashboard shows live prices refreshed from CoinGecko. Falls back gracefully if rate-limited.

---

## Phase 4 — AI Brain + New UI Pages
**Goal:** AI reasoning engine + new dashboard pages.

### What to build

#### New database tables

```
ai_memory        ← historical pattern storage
ai_decisions     ← every AI decision recorded
ai_feedback      ← post-trade outcome + lesson
strategy_versions ← version history for strategies
```

#### New API endpoints

```
POST /api/ai/analyze              ← AI reasoning with LLM
POST /api/risk/calculate          ← position size calculator
GET  /api/ai/decisions            ← decision history
GET  /api/ai/feedback             ← learning records
GET  /api/strategies/:id/versions ← version history
```

#### New UI pages

```
AI Command Center    ← AI reasoning, agent breakdown, confidence
AI Memory Viewer     ← similar historical setups
Learning Center      ← mistakes, lessons, improvement tracking
Risk Center          ← real-time risk metrics, alerts
Portfolio Center     ← allocation, correlation, exposure
Research Center      ← experiments, backtest comparison
```

#### AI integration

```
Replit AI (OpenAI-compatible API)
LLM explains every decision in plain English
Multi-agent structure: Market, Strategy, Risk, Research, Decision
```

### Done when

AI analyzes any symbol and returns a structured decision with confidence + reasoning. All new pages render and show real data.

---

## Phase 5 — Real Backtesting + Research Engine
**Goal:** Replace simulated backtests with real candle-replay backtesting.

### What to build

#### New database tables

```
experiments      ← strategy improvement experiments
paper_trades     ← paper trading records
optimizer_runs   ← parameter optimization history
```

#### New API endpoints

```
POST /api/backtests/run           ← real candle-replay backtest
POST /api/paper-trades            ← open paper trade
GET  /api/paper-trades            ← list paper trades
POST /api/experiments             ← create experiment
GET  /api/experiments             ← list experiments
```

#### Backtest engine

```
Load historical candles from database
Replay candle by candle
Run strategy rules at each close
Simulate entries/exits with slippage model
Calculate P&L, drawdown, metrics per trade
Generate equity curve
```

#### Walk-forward tester

```
Split dataset into training / testing windows
Run backtest on each window
Report out-of-sample performance
```

### Done when

Running a backtest on BTC/4h for 2 years produces a real equity curve, real trade list, and real metrics — not synthetic random numbers.

---

## Phase 6 — Risk Engine + Portfolio Manager
**Goal:** Professional risk controls on every trade.

### What to build

```
Position size calculator (account % risk model)
Daily loss limit enforcement
Portfolio exposure tracker
Correlation checker
Risk alert system
```

### Risk rules enforced

```
Max per-trade risk:   2% of account (configurable)
Daily loss limit:     5% of account
Max open exposure:    60% of account
Stop loss:            Required on every trade
Correlation limit:    Maximum 3 highly correlated positions
```

### Done when

No trade can be opened without passing all risk checks. System halts new trades when daily limit is hit.

---

## Phase 7 — Exchange Integration
**Goal:** Connect to real exchange. Real order execution. Real P&L.

### Exchanges to support

```
Binance (primary — largest liquidity)
Bybit   (secondary — futures focus)
```

### What to build

```
Exchange API wrapper (Binance REST + WebSocket)
WebSocket real-time price feed
Order placement (market, limit, stop)
Position tracking
Fill confirmation
```

### New endpoints

```
POST /api/exchange/order       ← place order
DELETE /api/exchange/order/:id ← cancel order
GET  /api/exchange/positions   ← open positions
GET  /api/exchange/balance      ← account balance
```

### Security

```
API keys stored as encrypted environment secrets
Never in source code
Never in logs
Read-only keys for monitoring, trading keys for execution
```

### Done when

System places a real order on Binance testnet. Receives fill confirmation. Records trade to database.

---

## Phase 8 — Machine Learning Layer
**Goal:** ML model improves signal quality over time.

### What to build

#### Classification model

```
Input features:
  RSI, EMA alignment, volume ratio, ATR, ADX,
  time of day, day of week, market regime

Output:
  Probability of success (0.0–1.0)
```

#### Models to test (in order)

```
1. Logistic Regression (baseline)
2. Random Forest (good for tabular data)
3. XGBoost (state of the art for tabular)
4. LSTM (sequence model — later phase)
```

#### Training pipeline

```
Collect labeled dataset (trade outcome = win/loss)
Feature engineering
Train/test split (time-based, not random)
Cross-validate with walk-forward windows
Compare to current rule-based system
Deploy only if better Sharpe ratio
```

#### Model versioning

```
Every model version stored
Performance metrics saved
Rollback always possible
```

### Done when

ML model predicts trade success better than rule-based system on out-of-sample data. Integrated into signal confidence score.

---

## Phase 9 — Automation + Alerts
**Goal:** System runs continuously without manual intervention.

### What to build

#### Background workers

```
Market Worker     → every 5s: fetch prices, update indicators
Scanner Worker    → every candle close: scan all symbols, generate signals
Learning Worker   → after every trade close: record outcome, extract lesson
Health Worker     → every 60s: check all services, log status
```

#### Alert system

```
Telegram bot (priority — instant delivery)
Email notifications (daily summary)
Discord webhook (team notifications)
In-app notification center
```

#### Alert triggers

```
New high-confidence signal (> 80%)
Trade opened / closed
Daily loss limit approaching
System service down
AI confidence dropping
Strategy underperforming
```

### Done when

System generates signals and monitors risk 24/7 without any user action. Alerts arrive on Telegram within 30 seconds of trigger.

---

## Phase 10 — Scale + Production
**Goal:** Handle years of market data. Fast queries. 99.9% uptime.

### What to build

#### Database optimization

```
TimescaleDB extension for market_candles (time-series optimization)
Indexes on: symbol+timeframe, created_at, status
Partitioning: candles partitioned by month
Archive strategy: compress candles older than 1 year
```

#### Performance targets

```
Market prices API:     < 50ms response
Indicator calculation: < 100ms per symbol
Backtest (1 year):     < 5 seconds
Signal generation:     < 200ms
```

#### Data scale

```
1 year of 1m candles (BTC):   525,600 rows
8 symbols × 5 timeframes:     ~20M rows/year
Storage estimate:             ~2GB/year compressed
```

#### Reliability

```
Database connection pooling (pgBouncer or Drizzle pool)
API rate limiting (prevent abuse)
Health checks on all services
Automatic restart on crash
Deployment: Replit (current) → VPS for workers Phase 9+
```

---

## Full Technology Stack Summary

| Layer | Technology | Phase |
|-------|-----------|-------|
| Frontend | React + Vite + Tailwind | Phase 1 |
| Routing | Wouter | Phase 1 |
| Charts | Recharts | Phase 1 |
| State management | TanStack Query | Phase 1 |
| API framework | Express 5 (Node.js) | Phase 2 |
| Database ORM | Drizzle ORM | Phase 2 |
| Database | PostgreSQL | Phase 2 |
| Validation | Zod v4 + drizzle-zod | Phase 2 |
| API spec | OpenAPI 3.1 | Phase 2 |
| Codegen | Orval | Phase 2 |
| Market data | CoinGecko API | Phase 3 |
| AI reasoning | Replit AI (OpenAI proxy) | Phase 4 |
| ML models | XGBoost → LSTM | Phase 8 |
| Exchange | Binance REST + WebSocket | Phase 7 |
| Charts (advanced) | TradingView widget | Phase 6+ |
| Alerts | Telegram Bot API | Phase 9 |
| Time-series DB | TimescaleDB extension | Phase 10 |
| Monitoring | Built-in system logs | Phase 2+ |

---

## What to Learn at Each Phase

### Phase 1–2 (Building foundation)
```
TypeScript fundamentals
React hooks (useState, useEffect, useQuery)
REST API design
SQL fundamentals (SELECT, JOIN, INSERT)
OpenAPI spec writing
```

### Phase 3–4 (Market data + AI)
```
WebSocket basics
LLM prompt engineering
How indicators work (EMA, RSI, MACD, ATR, ADX)
JSON structuring for AI context
```

### Phase 5–6 (Backtesting + Risk)
```
Backtesting methodology
Walk-forward validation
Position sizing math
Sharpe ratio, profit factor, expectancy
Overfitting and how to avoid it
```

### Phase 7–8 (Exchange + ML)
```
Exchange API authentication (HMAC signing)
Order types (market, limit, stop)
Feature engineering for ML
Train/test splits for time series
XGBoost and Random Forest basics
```

### Phase 9–10 (Automation + Scale)
```
Background job patterns (workers, queues)
Database indexing and query optimization
TimescaleDB for time-series
Telegram Bot API
System reliability engineering
```

---

## Key Rules

```
1. Always build incrementally — working software at every phase
2. Never go live without paper trading first (minimum 100 trades)
3. Never trade without a stop loss
4. Walk-forward test every strategy before using it live
5. Never put > 2% of account at risk per trade
6. Build the risk engine before the execution engine
7. Version everything: strategies, models, database schema
8. Log everything: every trade, every AI decision, every signal
9. Monitor everything: system health, performance metrics, risk
10. Never commit API keys or secrets to source code
```

---

## Production Checklist

Before going live with real money:

```
✅ Paper traded for minimum 3 months
✅ Walk-forward backtest shows positive results on unseen data
✅ Risk engine enforces all limits (tested by hitting them manually)
✅ All API keys stored as environment secrets
✅ Exchange testnet tested successfully
✅ Monitoring and alerts working
✅ Daily loss limit circuit breaker tested
✅ Database backed up
✅ System health dashboard showing green
✅ At least 100 paper trades reviewed and analyzed
```

---

## Current Implementation Status

| Blueprint | Description | Status |
|-----------|-------------|--------|
| V1 | Frontend — 8 pages | ✅ Complete |
| V2 | Database + 30+ API endpoints | ✅ Complete |
| V3 | System services, market data, partial workers | ✅ Complete |
| V4 | AI Brain — reasoning, memory, learning | ✅ Complete |
| V5 | Trading Engine — backtesting, research | ✅ Complete |
| V6 | UI — AI Center, Portfolio, Risk, Learning, Research | ✅ Complete |
| V7 | This document — complete roadmap | ✅ Documented |

---

## Summary

This is not just a trading bot. It is a **quantitative research platform** — a system that:

1. Observes markets in real time
2. Applies strategy rules to generate signals
3. Uses AI to explain and validate decisions
4. Manages risk on every trade
5. Records and learns from every outcome
6. Continuously improves strategies
7. Scales to handle millions of candles and years of data

The difference between a normal trading bot and AEGIS QUANT AI is the research infrastructure:
- **Memory** — it knows what happened in similar past situations
- **Reasoning** — it explains why, not just what
- **Learning** — it gets better after every trade
- **Safety** — it never trades without risk control
