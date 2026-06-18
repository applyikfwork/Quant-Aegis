# AEGIS QUANT AI — BLUEPRINT V3

# Backend + API + System Engineering Design

This is the layer that connects everything.

---

## Architecture Overview

```
Frontend (React + Vite)
        |
        |
   Express API (Node.js/TypeScript)
        |
------------------------------------------------
|              |              |                 |
Market     Strategy       AI Engine        Analytics
Service    Service        Service          Service
                |
        PostgreSQL Database
```

> Note: Original blueprint specified Python/FastAPI + Supabase.
> Adapted to Node.js/TypeScript + Express + Replit PostgreSQL to fit
> the existing monorepo stack while preserving the full architecture design.

---

## 1. Project Structure

```
AegisQuant/
├── artifacts/
│   ├── aegis-quant/          ← React frontend
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       └── App.tsx
│   └── api-server/           ← Express API backend
│       └── src/
│           ├── index.ts      ← Server entrypoint
│           └── routes/
│               ├── market.ts
│               ├── strategies.ts
│               ├── signals.ts
│               ├── trades.ts
│               ├── analytics.ts
│               ├── dashboard.ts
│               ├── backtests.ts
│               └── system.ts
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml      ← Contract (source of truth)
│   ├── api-client-react/     ← Generated React Query hooks
│   ├── api-zod/              ← Generated Zod schemas
│   └── db/
│       └── src/
│           └── schema/
│               ├── strategies.ts
│               ├── market.ts
│               ├── signals.ts
│               ├── trades.ts
│               └── analytics.ts
└── docs/
    ├── BLUEPRINT_V1.md       ← Product & Frontend design
    ├── BLUEPRINT_V2.md       ← Database & API architecture
    └── BLUEPRINT_V3.md       ← This file: System engineering design
```

---

## 2. API Design

### Authentication APIs (Phase 2)

```
POST /auth/register
POST /auth/login
GET  /auth/profile
```

---

### Market APIs

Get live market price:

```
GET /api/market/prices
```

Response:

```json
{
  "symbol": "BTCUSDT",
  "price": 105000,
  "volume": 32000000000,
  "change24h": 2.14,
  "trend": "bullish"
}
```

Historical candles:

```
GET /api/market/candles/:symbol/:timeframe
```

Parameters: `symbol`, `timeframe`, `limit`

---

### Indicator API

```
GET /api/market/indicators/:symbol/:timeframe
```

Response:

```json
{
  "ema20": 104500,
  "ema50": 103000,
  "rsi": 55,
  "macd": 1250,
  "macd_signal": 980,
  "atr": 1200,
  "vwap": 103200,
  "bollinger_upper": 107500,
  "bollinger_lower": 98100,
  "adx": 28.4
}
```

---

### Strategy API

Generate signal:

```
POST /api/strategies/:id/backtest
```

Analyze signal (AI layer — Phase 6):

```
POST /api/strategy/analyze
```

Input:

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "4h"
}
```

Output:

```json
{
  "signal": "BUY",
  "confidence": 82,
  "reasons": [
    "EMA20 crossed above EMA50",
    "Volume 2.1x average",
    "RSI recovering from oversold"
  ]
}
```

---

### Risk API (Phase 4)

```
POST /api/risk/calculate
```

Input:

```json
{
  "account": 10000,
  "risk_percent": 2,
  "entry": 103500,
  "stop_loss": 100800
}
```

Output:

```json
{
  "position_size": 0.074,
  "risk_amount": 200,
  "risk_reward": 3.5
}
```

---

### AI API (Phase 6)

The brain endpoint:

```
POST /api/ai/analyze
```

Input:

```json
{
  "market_data": { "symbol": "BTCUSDT", "timeframe": "4h" },
  "history": [],
  "strategy": "momentum"
}
```

Output:

```json
{
  "decision": "BUY",
  "confidence": 86,
  "explanation": "Similar setups over last 90 days had 73% positive outcomes. RSI recovery + volume expansion pattern matches 12 historical entries."
}
```

---

### Trade API

Create trade:

```
POST /api/trades
```

Stores: Entry, Exit, Reason, AI score, Result, Strategy used.

---

### Analytics API

```
GET /api/analytics/performance
```

Returns:

```json
{
  "win_rate": 67.3,
  "profit_factor": 1.82,
  "max_drawdown": 12.4,
  "sharpe_ratio": 1.45,
  "avg_win": 185,
  "avg_loss": -92,
  "total_return": 28.6
}
```

---

## 3. Service Design

### Market Service

Job: Collect and normalize live market data.

Flow:

```
Exchange API (CoinGecko / Binance)
        ↓
   Normalize & Clean
        ↓
   Save to Database
        ↓
   Send to Indicator Engine
```

Current: CoinGecko public API (free, no key).
Phase 3+: Binance WebSocket for real-time streaming.

---

### Indicator Service

Input: OHLCV candles

Output computed features:

```
EMA20, EMA50, EMA200    ← Trend direction
RSI                     ← Momentum
MACD + Signal           ← Trend momentum cross
ATR                     ← Volatility / stop sizing
VWAP                    ← Institutional price level
Bollinger Bands         ← Range context
ADX                     ← Trend strength
```

---

### Strategy Service

Logic example (Trend Following):

```
IF   EMA20 > EMA50 > EMA200     (trend aligned bullish)
AND  Volume > 1.5x average      (participation)
AND  RSI between 40–65          (not overbought)
AND  ADX > 25                   (strong trend)
THEN → BUY candidate
```

---

### Risk Service

Before every trade, check:

```
Risk %          ← Never exceed account risk limit per trade
Position Size   ← Calculate from risk % + stop distance
Stop Loss       ← Required; no trade without a stop
Max Exposure    ← Total open positions within limits
Daily Max Loss  ← Halt trading if daily limit hit
```

Formula:

```
Position Size = (Account × Risk%) / Stop Distance
```

---

### AI Service (Phase 6)

Process:

```
Receive market setup
        ↓
Extract features (indicators, pattern)
        ↓
Search historical database for similar setups
        ↓
Analyze outcomes of matched setups
        ↓
Generate reasoning (LLM layer)
        ↓
Return decision + confidence + explanation
        ↓
Store reasoning to database memory
```

---

## 4. Background Workers (Phase 3)

Trading systems cannot wait for the user to open the app.
Workers run continuously.

---

### Market Worker

Runs every few seconds:

```
Fetch price from exchange
        ↓
Normalize OHLCV
        ↓
Update indicators
        ↓
Broadcast to subscribed clients (WebSocket)
```

---

### Scanner Worker

Runs on every candle close:

```
Scan all monitored symbols
        ↓
Run strategy logic against each
        ↓
Generate signals where conditions met
        ↓
Store signals to database
        ↓
Send alerts (Phase 5)
```

---

### Learning Worker (Phase 7)

Runs after every trade closes:

```
Compare AI prediction vs actual outcome
        ↓
Find pattern match quality
        ↓
Update accuracy statistics
        ↓
Flag low-confidence pattern types
        ↓
Feed learnings into AI memory
```

---

## 5. AI Brain Pipeline (Phase 6)

The full "thinking" process:

```
New Market Situation
        |
Feature Collection (indicators, volume, pattern)
        |
Historical Pattern Search (database vector search)
        |
Strategy Evaluation (rule-based filter first)
        |
Risk Evaluation (position size, stop distance)
        |
AI Explanation (LLM reasoning layer)
        |
Confidence Score (0–100)
        |
Decision (BUY / SELL / HOLD)
        |
Store to Database Memory (feeds learning engine)
```

---

## 6. Security

Never store raw secrets. All secrets via environment variables:

```
DATABASE_URL    ← PostgreSQL connection
SESSION_SECRET  ← Session signing
OPENAI_API_KEY  ← AI reasoning (Phase 6)
EXCHANGE_KEY    ← Binance/Bybit API (Phase 3+)
```

Rules:
- No API keys in source code
- No secrets in logs
- HTTPS only in production (handled by Replit deployment)

---

## 7. Deployment

```
Frontend + Backend → Replit (single deployment, path-routed)
Database           → Replit PostgreSQL (managed)
```

Production path routing:

```
/        → aegis-quant React frontend
/api     → api-server Express backend
```

---

## 8. Development Order (Phases)

| Phase | What                    | Status      |
|-------|-------------------------|-------------|
| 1     | Frontend UI (all pages) | ✅ Complete |
| 2     | Database + API routes   | ✅ Complete |
| 3     | Live market data engine | ✅ Partial (CoinGecko) |
| 4     | Real indicator engine   | 🔲 Planned  |
| 5     | Real backtesting engine | 🔲 Planned  |
| 6     | AI layer (LLM)          | 🔲 Planned  |
| 7     | Learning engine         | 🔲 Planned  |
| 8     | Automation + alerts     | 🔲 Planned  |

---

## 9. Final V3 Architecture

```
                    USER
                      |
              React Dashboard
                      |
              Express API (Node.js)
                      |
    ┌─────────────────┼─────────────────┐
    |                 |                 |
Market Engine   Strategy Engine    AI Engine
Indicator Eng.  Risk Engine        Learning Engine
                                   Analytics Engine
    |                 |                 |
    └─────────────────┼─────────────────┘
                      |
              PostgreSQL Database
```

This is the engineering foundation. Phase 4 blueprint covers:
**AI Brain Architecture** (RAG, memory, learning, model system) — the part that makes this different from a normal trading bot.
