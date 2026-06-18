# AEGIS QUANT AI

A professional AI-powered quantitative trading research platform for tracking crypto strategies, signals, trades, and performance analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/aegis-quant run dev` — run the frontend (port 23855)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Recharts, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Market Data: CoinGecko public API (no key required for basic endpoints)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions
  - `strategies.ts` — strategies table
  - `market.ts` — market_candles, indicators tables
  - `signals.ts` — signals table
  - `trades.ts` — trades, trade_reasons tables
  - `analytics.ts` — backtests, activity_events, system_logs tables
- `artifacts/api-server/src/routes/` — Express route handlers
  - `market.ts` — /market/prices, /market/candles/:s/:tf, /market/indicators/:s/:tf
  - `strategies.ts` — /strategies CRUD + /strategies/:id/backtest
  - `signals.ts` — /signals CRUD
  - `trades.ts` — /trades CRUD + /trades/:id/reasons
  - `analytics.ts` — /analytics/performance, /analytics/daily, /analytics/strategy-comparison
  - `dashboard.ts` — /dashboard/summary, /dashboard/recent-activity
  - `backtests.ts` — /backtests CRUD (simulated backtest results)
  - `system.ts` — /system/status, /system/logs
- `artifacts/aegis-quant/src/` — React frontend
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas (do not edit)

## Architecture decisions

- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` gates all codegen; never hand-write types the generator produces
- Market candle timeframes are path params (`/market/candles/:symbol/:timeframe`) to avoid Orval `QueryParams` type collision with the Zod barrel exports
- Backtest execution is simulated server-side (random but plausible stats) — Phase 4 will add real walk-forward testing
- CoinGecko public API used for live prices; fallback mock data returned if rate-limited (60 req/min free tier)
- Activity events are recorded on every trade open/close, signal generation, backtest completion, and strategy creation — feeds the dashboard activity feed

## Product

**Phase 1 complete:**
- Dashboard — live prices (CoinGecko), 7-day P&L chart, key metrics, recent activity feed
- Market Data — live price grid for 8 crypto pairs with 24h stats
- Strategy Library — full CRUD with win rate, profit factor, active toggle
- Signals Feed — BUY/SELL/HOLD signals with confidence scores and reasons
- Trade Journal — full trade lifecycle (open/close), P&L calculation, trade reasons
- Analytics — cumulative P&L curve, daily bar chart, drawdown, sharpe, strategy comparison
- Backtesting — run backtests against strategies (simulated), view historical results
- System Monitor — service health indicators, uptime, recent system logs

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching frontend or backend code
- Query params on endpoints create `<OperationId>QueryParams` Zod schemas that can collide with TypeScript types in the barrel export. Path params are safe. Put new query params in `components/schemas` or use path params to avoid TS2308 errors.
- Never import hooks from relative paths — always `@workspace/api-client-react`
- The `pnpm run push` command uses Drizzle Kit push (not migrate) — safe for dev, Replit publish handles prod migrations automatically

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Blueprint v2 database architecture is fully implemented in `lib/db/src/schema/`
- Blueprint v3 (FastAPI backend) was adapted to Node.js/Express to fit the Replit monorepo stack

## Blueprint Documentation

Full design docs live in `docs/`:

| File | What it covers |
|------|----------------|
| `docs/BLUEPRINT_V1.md` | Product vision, all 8 pages, frontend design, UI principles |
| `docs/BLUEPRINT_V2.md` | Database schema (all 9 tables), API routes (all 30+ endpoints), OpenAPI contract, architecture decisions |
| `docs/BLUEPRINT_V3.md` | System engineering design, service breakdown (Market/Indicator/Strategy/Risk/AI/Learning), background workers, AI brain pipeline, security, deployment, full phase roadmap |
| `docs/BLUEPRINT_V4.md` | AI Brain Architecture — memory system, market reasoning engine, multi-agent design (5 agents), learning engine, strategy versioning, ML layer, vector memory, safety rules, 8-step implementation order |
| `docs/BLUEPRINT_V5.md` | Trading Engine + Strategy Research Lab — backtesting engine, walk-forward testing, paper trader, optimizer, multi-strategy consensus, risk/portfolio manager, execution engine, experiment system, performance metrics |

Next blueprint to write: **V6 — Dashboard + User Interface + Monitoring System**.
