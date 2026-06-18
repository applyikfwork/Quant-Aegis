---
name: Bybit API quirks
description: Key gotchas when using Bybit v5 REST API for market data in this project
---

## Volume field
- `volume24h` = base asset quantity (e.g. BTC for BTCUSDT) — NOT in USD
- `turnover24h` = quote asset value (USD) — use this for "$X volume" display

## Klines (candlestick) response
- Endpoint: `GET https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=1&limit=200`
- Response `result.list` is **reverse-chronological** (newest first) — must `.reverse()` before computing indicators
- Array format: `[timestamp_ms, open, high, low, close, volume, turnover]` (all strings)

## Interval map (spot)
| App timeframe | Bybit interval param |
|---|---|
| 1m | "1" |
| 5m | "5" |
| 1h | "60" |
| 4h | "240" |
| 1d | "D" |

## Tickers
- All spot tickers: `GET https://api.bybit.com/v5/market/tickers?category=spot`
- Single ticker: `GET https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT`
- Key fields: `lastPrice`, `prevPrice24h`, `price24hPcnt` (decimal, multiply ×100 for %), `highPrice24h`, `lowPrice24h`, `volume24h` (base), `turnover24h` (USD)

## Credentials stored
- BYBIT_API_KEY and BYBIT_API_SECRET stored as shared env vars (not secrets)
- Public market endpoints (tickers, klines) do NOT require auth
- Account endpoints (balance, positions) require HMAC-SHA256 signed requests

**Why:** Bybit's public REST API is reachable from Replit sandbox (HTTP, no TCP blocking). All market data fetches use public endpoints with no auth needed.
