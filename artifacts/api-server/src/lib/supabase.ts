import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-key";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running in offline mode. Database calls will return empty data.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function setupTables(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS strategies (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      description TEXT, rules_json TEXT, active BOOLEAN NOT NULL DEFAULT true,
      win_rate REAL, total_trades INTEGER DEFAULT 0, profit_factor REAL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY, symbol TEXT NOT NULL, strategy_id INTEGER REFERENCES strategies(id),
      side TEXT NOT NULL, entry_price REAL NOT NULL, exit_price REAL, quantity REAL NOT NULL,
      stop_loss REAL, take_profit REAL, profit_loss REAL, profit_percent REAL,
      status TEXT NOT NULL DEFAULT 'open', ai_confidence REAL, timeframe TEXT,
      entry_time TIMESTAMPTZ NOT NULL DEFAULT now(), exit_time TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS trade_reasons (
      id SERIAL PRIMARY KEY, trade_id INTEGER NOT NULL REFERENCES trades(id),
      reason_type TEXT NOT NULL, reason_text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY, symbol TEXT NOT NULL, strategy_id INTEGER REFERENCES strategies(id),
      signal_type TEXT NOT NULL, confidence REAL NOT NULL, reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS market_candles (
      id SERIAL PRIMARY KEY, symbol TEXT NOT NULL, timeframe TEXT NOT NULL,
      open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
      volume REAL NOT NULL, timestamp TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(symbol, timeframe, timestamp)
    );
    CREATE TABLE IF NOT EXISTS indicators (
      id SERIAL PRIMARY KEY, candle_id INTEGER, symbol TEXT NOT NULL, timeframe TEXT NOT NULL,
      ema20 REAL, ema50 REAL, ema200 REAL, rsi REAL, macd REAL, macd_signal REAL,
      atr REAL, vwap REAL, bollinger_upper REAL, bollinger_lower REAL, adx REAL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(symbol, timeframe)
    );
    CREATE TABLE IF NOT EXISTS backtests (
      id SERIAL PRIMARY KEY, strategy_id INTEGER NOT NULL REFERENCES strategies(id),
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, symbol TEXT, timeframe TEXT,
      total_trades INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0, win_rate REAL NOT NULL DEFAULT 0,
      profit_factor REAL NOT NULL DEFAULT 0, drawdown REAL NOT NULL DEFAULT 0,
      sharpe_ratio REAL, total_return REAL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id SERIAL PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT NOT NULL, symbol TEXT, value REAL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY, service TEXT NOT NULL, event TEXT NOT NULL,
      message TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'info',
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_decisions (
      id SERIAL PRIMARY KEY, signal_id INTEGER, symbol TEXT NOT NULL,
      decision TEXT NOT NULL, confidence INTEGER NOT NULL DEFAULT 0,
      reasoning JSONB NOT NULL DEFAULT '{}', agent_votes JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id SERIAL PRIMARY KEY, decision_id INTEGER, trade_id INTEGER,
      prediction TEXT NOT NULL, actual_result TEXT, correct BOOLEAN, lesson TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_memory (
      id SERIAL PRIMARY KEY, symbol TEXT NOT NULL, timeframe TEXT NOT NULL,
      market_condition JSONB NOT NULL DEFAULT '{}', features JSONB NOT NULL DEFAULT '{}',
      outcome TEXT, outcome_pct REAL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS strategy_versions (
      id SERIAL PRIMARY KEY, strategy_id INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      entry_rules JSONB NOT NULL DEFAULT '{}', exit_rules JSONB NOT NULL DEFAULT '{}',
      parameters JSONB, change_reason TEXT, performance_before JSONB, performance_after JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS experiments (
      id SERIAL PRIMARY KEY, strategy_id INTEGER, hypothesis TEXT NOT NULL,
      change_made JSONB, test_period TEXT, backtest_result JSONB,
      verdict TEXT NOT NULL DEFAULT 'pending', notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS paper_trades (
      id SERIAL PRIMARY KEY, signal_id INTEGER, strategy_id INTEGER,
      symbol TEXT NOT NULL, side TEXT NOT NULL, entry_price REAL NOT NULL,
      exit_price REAL, quantity REAL NOT NULL, stop_loss REAL, take_profit REAL,
      profit_loss REAL, profit_percent REAL, status TEXT NOT NULL DEFAULT 'open',
      entry_time TIMESTAMPTZ NOT NULL DEFAULT now(), exit_time TIMESTAMPTZ
    );

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='trades') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE trades;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='signals') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE signals;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activity_events') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='market_candles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE market_candles;
      END IF;
    END $$;
  `;

  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    console.warn("Table setup via mgmt API failed:", resp.status, text.substring(0, 200));
    console.warn("Tables may need to be created manually in Supabase SQL editor");
  } else {
    console.log("Supabase tables ready");
  }
}
