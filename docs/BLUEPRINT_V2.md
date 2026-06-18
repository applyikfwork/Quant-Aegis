# AEGIS QUANT AI — BLUEPRINT V2

# Database & API Architecture

This is the second blueprint: the data model and API contract powering the platform.

---

## Architecture Overview

```
Frontend (React + Vite)
        |
        | HTTP (JSON)
        |
   Express API (Node.js)
        |
        | Drizzle ORM
        |
   PostgreSQL (Replit DB)
```

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Language   | TypeScript (Node.js 24) |
| Framework  | Express 5               |
| ORM        | Drizzle ORM             |
| Database   | PostgreSQL               |
| Validation | Zod v4 + drizzle-zod    |
| API Spec   | OpenAPI 3.1 (YAML)      |
| Codegen    | Orval                   |
| Build      | esbuild (CJS bundle)    |

---

## Database Schema

### strategies

Stores trading strategy definitions.

```
id              serial PRIMARY KEY
name            text NOT NULL
description     text
type            text  (trend_following | mean_reversion | momentum | breakout | scalping)
timeframe       text  (1m | 5m | 15m | 1h | 4h | 1d)
win_rate        numeric
profit_factor   numeric
max_drawdown    numeric
is_active       boolean DEFAULT true
created_at      timestamp
```

---

### market_candles

OHLCV candle data per symbol + timeframe.

```
id          serial PRIMARY KEY
symbol      text NOT NULL
timeframe   text NOT NULL
open_time   timestamp NOT NULL
open        numeric NOT NULL
high        numeric NOT NULL
low         numeric NOT NULL
close       numeric NOT NULL
volume      numeric NOT NULL
```

---

### indicators

Computed technical indicators per symbol + timeframe.

```
id               serial PRIMARY KEY
symbol           text NOT NULL
timeframe        text NOT NULL
ema20            numeric
ema50            numeric
ema200           numeric
rsi              numeric
macd             numeric
macd_signal      numeric
atr              numeric
vwap             numeric
bollinger_upper  numeric
bollinger_lower  numeric
adx              numeric
calculated_at    timestamp
```

---

### signals

AI-generated trade signals.

```
id           serial PRIMARY KEY
symbol       text NOT NULL
strategy_id  integer REFERENCES strategies(id)
signal_type  text  (buy | sell | hold)
confidence   integer  (0–100)
reason       text
status       text  (pending | executed | expired)
created_at   timestamp
```

---

### trades

Trade journal entries.

```
id             serial PRIMARY KEY
symbol         text NOT NULL
strategy_id    integer REFERENCES strategies(id)
side           text  (long | short)
entry_price    numeric NOT NULL
exit_price     numeric
quantity       numeric NOT NULL
stop_loss      numeric
take_profit    numeric
profit_loss    numeric
profit_percent numeric
status         text  (open | closed | cancelled)
ai_confidence  integer
timeframe      text
entry_time     timestamp
exit_time      timestamp
notes          text
```

---

### trade_reasons

Reasons stored per trade (one-to-many).

```
id           serial PRIMARY KEY
trade_id     integer REFERENCES trades(id)
reason_type  text
reason_text  text
created_at   timestamp
```

---

### backtests

Backtest result history.

```
id            serial PRIMARY KEY
strategy_id   integer REFERENCES strategies(id)
start_date    text NOT NULL
end_date      text NOT NULL
symbol        text NOT NULL
timeframe     text NOT NULL
total_trades  integer
wins          integer
losses        integer
win_rate      numeric
profit_factor numeric
drawdown      numeric
sharpe_ratio  numeric
total_return  numeric
created_at    timestamp
```

---

### activity_events

Dashboard activity feed (one row per event).

```
id          serial PRIMARY KEY
type        text  (trade_opened | trade_closed | signal_generated | backtest_complete | strategy_created)
title       text NOT NULL
description text
symbol      text
value       numeric
timestamp   timestamp
```

---

### system_logs

System-level audit log.

```
id        serial PRIMARY KEY
service   text NOT NULL
event     text NOT NULL
message   text NOT NULL
level     text  (info | warn | error)
timestamp timestamp
```

---

## API Routes

All routes under `/api` prefix.

### Market

```
GET  /api/market/prices                    — Live prices for 8 pairs (CoinGecko)
GET  /api/market/candles/:symbol/:timeframe — OHLCV candle history
GET  /api/market/indicators/:symbol/:timeframe — Computed indicators
```

### Strategies

```
GET    /api/strategies           — List all strategies
POST   /api/strategies           — Create strategy
GET    /api/strategies/:id       — Get one strategy
PUT    /api/strategies/:id       — Update strategy
DELETE /api/strategies/:id       — Delete strategy
POST   /api/strategies/:id/backtest — Run backtest (simulated)
```

### Signals

```
GET    /api/signals              — List signals (filter by symbol, strategy, status)
POST   /api/signals              — Create signal
GET    /api/signals/:id          — Get one signal
PUT    /api/signals/:id          — Update signal
DELETE /api/signals/:id          — Delete signal
```

### Trades

```
GET    /api/trades               — List trades (filter by status, symbol)
POST   /api/trades               — Open trade
GET    /api/trades/:id           — Get one trade
PUT    /api/trades/:id           — Update trade (including close)
DELETE /api/trades/:id           — Delete trade
GET    /api/trades/:id/reasons   — Get trade reasons
POST   /api/trades/:id/reasons   — Add trade reason
```

### Analytics

```
GET /api/analytics/performance         — Win rate, profit factor, drawdown, sharpe
GET /api/analytics/daily               — Daily P&L bar chart data
GET /api/analytics/strategy-comparison — Side-by-side strategy stats
```

### Dashboard

```
GET /api/dashboard/summary         — Account balance, today P&L, win rate, health
GET /api/dashboard/recent-activity — Last 10 activity events
```

### Backtests

```
GET    /api/backtests        — List backtest history
POST   /api/backtests        — Create backtest record
GET    /api/backtests/:id    — Get one backtest
DELETE /api/backtests/:id    — Delete backtest
```

### System

```
GET /api/system/status — Service health (api, db, market, signal, indicator, risk)
GET /api/system/logs   — Recent system logs
```

---

## OpenAPI Contract

Source of truth: `lib/api-spec/openapi.yaml`

Codegen command:

```
pnpm --filter @workspace/api-spec run codegen
```

Generates:

- `lib/api-client-react/src/generated/` — React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Zod schemas (do not edit)

Rule: **never hand-write types the generator produces**.

---

## Key Architecture Decisions

1. **OpenAPI-first**: All types flow from the spec. Change spec → run codegen → types update everywhere.

2. **Path params for timeframes**: `/candles/:symbol/:timeframe` avoids Orval naming collision where query params generate `<OperationId>QueryParams` that conflict in the Zod barrel export.

3. **Simulated backtesting**: Backtest results are synthetically generated server-side (realistic random). Phase 4 will add real walk-forward backtesting.

4. **CoinGecko fallback**: Live prices from CoinGecko; hardcoded mock data returned if rate-limited (60 req/min free tier).

5. **Activity events**: Written on every trade open/close, signal creation, backtest completion, strategy creation — feeds dashboard feed without a separate analytics query.

---

## Status

Phase 1 + Phase 2: **COMPLETE**

Full database schema live, all API routes implemented and serving real data.
