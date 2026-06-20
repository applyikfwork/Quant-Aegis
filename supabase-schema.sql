-- ============================================================
-- AEGIS QUANT AI — Supabase Schema
-- Run this entire script in: Supabase Dashboard → SQL Editor
-- It is safe to run multiple times (all statements are idempotent)
-- ============================================================

-- ── STRATEGIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategies (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  rules_json      TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  win_rate        REAL,
  total_trades    INTEGER DEFAULT 0,
  profit_factor   REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── TRADES (unified: journal + paper via trade_type) ─────────
CREATE TABLE IF NOT EXISTS trades (
  id              SERIAL PRIMARY KEY,
  symbol          TEXT NOT NULL,
  strategy_id     INTEGER REFERENCES strategies(id),
  signal_id       INTEGER,
  decision_id     INTEGER,
  trade_type      TEXT NOT NULL DEFAULT 'journal',   -- 'journal' | 'paper'
  side            TEXT NOT NULL,                      -- 'long' | 'short'
  entry_price     REAL NOT NULL,
  exit_price      REAL,
  quantity        REAL NOT NULL,
  stop_loss       REAL,
  take_profit     REAL,
  profit_loss     REAL,
  profit_percent  REAL,
  status          TEXT NOT NULL DEFAULT 'open',       -- 'open' | 'closed'
  ai_confidence   REAL,
  timeframe       TEXT,
  leverage        REAL DEFAULT 1,
  margin          REAL,
  unrealized_pnl  REAL,
  notes           TEXT,
  entry_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── TRADE REASONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_reasons (
  id          SERIAL PRIMARY KEY,
  trade_id    INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  reason_type TEXT NOT NULL,
  reason_text TEXT NOT NULL
);

-- ── SIGNALS (enriched: entry/sl/tp/agent votes from AI) ──────
CREATE TABLE IF NOT EXISTS signals (
  id              SERIAL PRIMARY KEY,
  symbol          TEXT NOT NULL,
  strategy_id     INTEGER REFERENCES strategies(id),
  decision_id     INTEGER,                            -- links to ai_decisions
  signal_type     TEXT NOT NULL,                      -- 'buy' | 'sell' | 'hold'
  confidence      REAL NOT NULL,
  reason          TEXT,
  entry_price     REAL,
  stop_loss       REAL,
  tp1             REAL,
  tp2             REAL,
  tp3             REAL,
  timeframe       TEXT,
  risk_reward     REAL,
  agent_votes     JSONB,
  market_snapshot JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'active' | 'completed' | 'invalidated'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── MARKET CANDLES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_candles (
  id          SERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  timeframe   TEXT NOT NULL,
  open        REAL NOT NULL,
  high        REAL NOT NULL,
  low         REAL NOT NULL,
  close       REAL NOT NULL,
  volume      REAL NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, timeframe, timestamp)
);

-- ── INDICATORS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indicators (
  id              SERIAL PRIMARY KEY,
  candle_id       INTEGER,
  symbol          TEXT NOT NULL,
  timeframe       TEXT NOT NULL,
  ema20           REAL,
  ema50           REAL,
  ema200          REAL,
  rsi             REAL,
  macd            REAL,
  macd_signal     REAL,
  atr             REAL,
  vwap            REAL,
  bollinger_upper REAL,
  bollinger_lower REAL,
  adx             REAL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, timeframe)
);

-- ── BACKTESTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backtests (
  id            SERIAL PRIMARY KEY,
  strategy_id   INTEGER NOT NULL REFERENCES strategies(id),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  symbol        TEXT,
  timeframe     TEXT,
  total_trades  INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  win_rate      REAL NOT NULL DEFAULT 0,
  profit_factor REAL NOT NULL DEFAULT 0,
  drawdown      REAL NOT NULL DEFAULT 0,
  sharpe_ratio  REAL,
  total_return  REAL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ACTIVITY EVENTS (dashboard feed) ─────────────────────────
CREATE TABLE IF NOT EXISTS activity_events (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  symbol      TEXT,
  value       REAL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── SYSTEM LOGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id        SERIAL PRIMARY KEY,
  service   TEXT NOT NULL,
  event     TEXT NOT NULL,
  message   TEXT NOT NULL,
  level     TEXT NOT NULL DEFAULT 'info',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AI DECISIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_decisions (
  id          SERIAL PRIMARY KEY,
  signal_id   INTEGER,
  symbol      TEXT NOT NULL,
  decision    TEXT NOT NULL,
  confidence  INTEGER NOT NULL DEFAULT 0,
  reasoning   JSONB NOT NULL DEFAULT '{}',
  agent_votes JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AI FEEDBACK (learning loop) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id              SERIAL PRIMARY KEY,
  decision_id     INTEGER,
  trade_id        INTEGER,
  prediction      TEXT NOT NULL,
  actual_result   TEXT,
  correct         BOOLEAN,
  lesson          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AI MEMORY ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_memory (
  id               SERIAL PRIMARY KEY,
  symbol           TEXT NOT NULL,
  timeframe        TEXT NOT NULL,
  market_condition JSONB NOT NULL DEFAULT '{}',
  features         JSONB NOT NULL DEFAULT '{}',
  outcome          TEXT,
  outcome_pct      REAL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── STRATEGY VERSIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategy_versions (
  id                  SERIAL PRIMARY KEY,
  strategy_id         INTEGER NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1,
  entry_rules         JSONB NOT NULL DEFAULT '{}',
  exit_rules          JSONB NOT NULL DEFAULT '{}',
  parameters          JSONB,
  change_reason       TEXT,
  performance_before  JSONB,
  performance_after   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── EXPERIMENTS (Research Lab) ───────────────────────────────
CREATE TABLE IF NOT EXISTS experiments (
  id              SERIAL PRIMARY KEY,
  strategy_id     INTEGER,
  hypothesis      TEXT NOT NULL,
  change_made     JSONB,
  test_period     TEXT,
  backtest_result JSONB,
  verdict         TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PAPER TRADES (legacy — kept for backward compat) ─────────
-- New paper trades now write to the `trades` table with trade_type='paper'
CREATE TABLE IF NOT EXISTS paper_trades (
  id            SERIAL PRIMARY KEY,
  signal_id     INTEGER,
  strategy_id   INTEGER,
  symbol        TEXT NOT NULL,
  side          TEXT NOT NULL,
  entry_price   REAL NOT NULL,
  exit_price    REAL,
  quantity      REAL NOT NULL,
  stop_loss     REAL,
  take_profit   REAL,
  profit_loss   REAL,
  profit_percent REAL,
  status        TEXT NOT NULL DEFAULT 'open',
  trade_ref_id  INTEGER REFERENCES trades(id),
  entry_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time     TIMESTAMPTZ
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'MEDIUM',        -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category     TEXT NOT NULL DEFAULT 'system',        -- 'signal' | 'trade' | 'risk' | 'system' | 'ai'
  status       TEXT NOT NULL DEFAULT 'unread',        -- 'unread' | 'read' | 'dismissed'
  action       TEXT,
  related_id   INTEGER,
  related_type TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── MARKET PRICES (live price cache) ─────────────────────────
CREATE TABLE IF NOT EXISTS market_prices (
  id            SERIAL PRIMARY KEY,
  symbol        TEXT UNIQUE NOT NULL,
  price         REAL NOT NULL,
  change_24h    REAL,
  change_pct_24h REAL,
  volume_24h    REAL,
  high_24h      REAL,
  low_24h       REAL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ADD NEW COLUMNS TO EXISTING TABLES (safe if already exist)
-- ============================================================

ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_type      TEXT DEFAULT 'journal';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS signal_id       INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS decision_id     INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS leverage        REAL DEFAULT 1;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS margin          REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS unrealized_pnl  REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS notes           TEXT;

ALTER TABLE signals ADD COLUMN IF NOT EXISTS decision_id     INTEGER;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS entry_price     REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS stop_loss       REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS tp1             REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS tp2             REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS tp3             REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS timeframe       TEXT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS risk_reward     REAL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS agent_votes     JSONB;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS market_snapshot JSONB;

ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS trade_ref_id INTEGER REFERENCES trades(id);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trades_symbol        ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status        ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_trade_type    ON trades(trade_type);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time    ON trades(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_signal_id     ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_decision_id   ON trades(decision_id);

CREATE INDEX IF NOT EXISTS idx_signals_symbol       ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status       ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_decision_id  ON signals(decision_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_at   ON signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_symbol  ON ai_decisions(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_decision ON ai_feedback(decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_trade    ON ai_feedback(trade_id);

CREATE INDEX IF NOT EXISTS idx_candles_symbol_tf    ON market_candles(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_activity_ts          ON activity_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notif_status         ON notifications(status);

-- ============================================================
-- REALTIME SUBSCRIPTIONS (enable for live dashboard updates)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE signals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'market_candles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE market_candles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================================
-- DONE — All tables, columns, indexes, and realtime subs ready
-- ============================================================
