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
  - `ai.ts` — ai_memory, ai_decisions, ai_feedback, strategy_versions, experiments, paper_trades
- `artifacts/api-server/src/routes/` — Express route handlers
  - `market.ts` — /market/prices, /market/candles/:s/:tf, /market/indicators/:s/:tf
  - `strategies.ts` — /strategies CRUD + /strategies/:id/backtest
  - `signals.ts` — /signals CRUD
  - `trades.ts` — /trades CRUD + /trades/:id/reasons
  - `analytics.ts` — /analytics/performance, /analytics/daily, /analytics/strategy-comparison
  - `dashboard.ts` — /dashboard/summary, /dashboard/recent-activity
  - `backtests.ts` — /backtests CRUD (simulated backtest results)
  - `system.ts` — /system/status, /system/logs
  - `ai.ts` — /ai/analyze, /ai/decisions, /ai/feedback, /strategies/:id/versions, /experiments CRUD, /paper-trades CRUD, /risk/calculate
- `artifacts/aegis-quant/src/` — React frontend
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas (do not edit)

## Architecture decisions

- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` gates all codegen; never hand-write types the generator produces
- Market candle timeframes are path params (`/market/candles/:symbol/:timeframe`) to avoid Orval `QueryParams` type collision with the Zod barrel exports
- Backtest execution is simulated server-side (random but plausible stats) — Phase 4 will add real walk-forward testing
- CoinGecko public API used for live prices; fallback mock data returned if rate-limited (60 req/min free tier)
- Activity events are recorded on every trade open/close, signal generation, backtest completion, and strategy creation — feeds the dashboard activity feed
- AI brain uses rule-based analysis (EMA/RSI/ADX/MACD + historical trade stats) — no external LLM required. 5-agent pipeline: Market Analyst, Strategy Analyst, Risk Analyst, Research Agent, Decision Agent. Decisions + reasoning stored in DB.
- Paper trades track full lifecycle: open with entry price/qty, close with exit price → P&L auto-calculated server-side

## Product

**Phase 1 complete (V1/V2):**
- Dashboard — live prices (CoinGecko), 7-day P&L chart, key metrics, recent activity feed
- Market Data — live price grid for 8 crypto pairs with 24h stats
- Strategy Library — full CRUD with win rate, profit factor, active toggle
- Signals Feed — BUY/SELL/HOLD signals with confidence scores and reasons
- Trade Journal — full trade lifecycle (open/close), P&L calculation, trade reasons
- Analytics — cumulative P&L curve, daily bar chart, drawdown, sharpe, strategy comparison
- Backtesting — run backtests against strategies (simulated), view historical results
- System Monitor — service health indicators, uptime, recent system logs

**Phase 2 complete (V4/V5/V6):**
- AI Center — rule-based 14-agent market analysis (POST /ai/analyze), decision history with full reasoning
- Learning Center — AI feedback loop, decision performance, accuracy tracking
- Portfolio — open positions overview, allocation, risk-adjusted P&L
- Risk Center — position sizing calculator (/risk/calculate), risk rules display, daily P&L limits
- Research Lab — strategy experiments with hypothesis tracking, verdict workflow (pending/approved/rejected)
- Paper Trading — full paper trade lifecycle (open long/short, close with exit price, auto P&L)

**Phase 3 complete (V8):**
- Guidance Center (Module 16) — platform documentation for all 15 modules, interactive AI chat assistant (keyword-based), 13-article knowledge base (TA, risk, AI, platform), 10-item FAQ, 6-step getting started guide; fully client-side, no backend required

## Navigation structure (16 pages)

**Core:** Dashboard, Market Data
**Intelligence:** AI Center, Signals Feed, Learning Center, Notifications
**Trading:** Trade Journal, Paper Trading, Portfolio, Risk Center
**Research:** Strategies, Backtesting, Analytics, Research Lab
**System:** System Monitor
**Help:** Guidance Center

## Vercel + Render deployment

- Frontend → Vercel: `buildCommand` is `pnpm --filter @workspace/aegis-quant run build`, `outputDirectory` is `artifacts/aegis-quant/dist/public`
- Backend → Render: Build `pnpm --filter @workspace/api-server run build`, Start `node artifacts/api-server/dist/index.mjs`; add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BYBIT_API_KEY, BYBIT_API_SECRET as env vars
- **Critical**: In Vercel, add env var `VITE_API_BASE_URL = https://your-render-app.onrender.com/api` so the frontend can reach the Render backend
- Sourcemap warnings in Vercel build log are non-fatal — build succeeds regardless

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching frontend or backend code
- Query params on endpoints create `<OperationId>QueryParams` Zod schemas that can collide with TypeScript types in the barrel export. Path params are safe. Put new query params in `components/schemas` or use path params to avoid TS2308 errors.
- Never import hooks from relative paths — always `@workspace/api-client-react`
- The `pnpm run push` command uses Drizzle Kit push (not migrate) — safe for dev, Replit publish handles prod migrations automatically
- New paths in `openapi.yaml` must be at the top-level `paths:` indentation (2 spaces). If they accidentally land inside `components/schemas:`, codegen will error with "Property /X is not expected to be here". Always check where new path entries are placed after editing.

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
| `docs/BLUEPRINT_V6.md` | Dashboard + UI + Monitoring — all 14 pages, navigation structure, layout system, component patterns, real-time data flows, performance monitoring, mobile responsiveness |
| `docs/BLUEPRINT_V7.md` | Deployment + Production Architecture — containerization, CI/CD, secrets management, autoscaling, observability, disaster recovery, compliance, cost optimization |
