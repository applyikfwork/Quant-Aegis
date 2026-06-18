# AEGIS QUANT AI — BLUEPRINT V1

# Product Vision & Frontend Design

This is the first blueprint: what the platform looks like and what a user experiences.

---

## What It Is

AEGIS QUANT AI is a professional quantitative trading research platform.

It gives traders:

- Live crypto market data
- AI-generated trade signals
- Strategy management
- Trade journal with P&L tracking
- Backtesting engine
- Analytics and performance reporting
- System health monitoring

---

## Target User

A crypto trader or quant researcher who wants:

- Data-driven decisions, not gut feeling
- Clear signal generation with reasoning
- Full audit trail of every trade
- Performance analytics to improve over time

---

## Phase 1 — What Is Built

### Dashboard (Command Center)

Shows:

```
Account Balance
Today's P&L
Win Rate (All Time)
System Health
7-Day P&L Chart
Live Market Prices (8 pairs)
Recent Activity Feed
```

---

### Market Data Page

Live price grid for 8 crypto pairs:

```
BTCUSDT
ETHUSDT
BNBUSDT
XRPUSDT
SOLUSDT
ADAUSDT
AVAXUSDT
DOGEUSDT
```

Each row shows:

```
Symbol
Current Price
24h Change %
24h Volume
```

Data source: CoinGecko public API (no key required).

---

### Strategy Library

Manage trading strategies.

Each strategy stores:

```
Name
Description
Type (Trend Following / Mean Reversion / Momentum / Breakout / Scalping)
Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
Win Rate %
Profit Factor
Max Drawdown %
Active / Inactive toggle
```

Actions: Create, Edit, Delete, Toggle Active.

---

### Signals Feed

AI-generated trade signals.

Each signal shows:

```
Symbol
Signal Type (BUY / SELL / HOLD)
Confidence Score (0–100%)
Reasoning (list of reasons)
Status (pending / executed / expired)
Timestamp
```

---

### Trade Journal

Full trade lifecycle management.

Open a trade:

```
Symbol
Side (Long / Short)
Entry Price
Quantity
Stop Loss
Take Profit
AI Confidence Score
Timeframe
Strategy used
```

Close a trade:

```
Exit Price → auto-calculates P&L and P&L%
```

Trade Reasons:

```
Store why each trade was taken (reason_type + reason_text)
```

---

### Analytics

Performance reporting:

```
Cumulative P&L curve (line chart)
Daily P&L bar chart
Win Rate, Profit Factor, Drawdown (summary cards)
Sharpe Ratio
Strategy comparison table
```

---

### Backtesting

Run historical simulations against any strategy:

```
Strategy
Symbol
Timeframe
Date range
```

Results:

```
Total Trades
Wins / Losses
Win Rate %
Profit Factor
Max Drawdown %
Sharpe Ratio
Total Return %
```

---

### System Monitor

Service health dashboard:

```
API Server status
Market Data Service status
Database status
Signal Engine status
Indicator Engine status
Risk Engine status
Uptime counter
Recent system logs
```

---

## Frontend Stack

```
React + Vite
Tailwind CSS
Recharts (charts)
TanStack Query (data fetching)
Wouter (routing)
```

---

## Design Principles

- Dark professional theme
- Data-dense but readable
- Color coding: green = profit, red = loss, blue = neutral
- Confidence scores shown as % with color intensity
- All data live-fetched from backend API

---

## Status

Phase 1: **COMPLETE**

All 8 pages built and connected to the live backend API.
