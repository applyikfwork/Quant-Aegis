import { supabase } from "./supabase";
import { logger } from "./logger";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT"];

const BYBIT_INTERVAL_MAP: Record<string, string> = {
  "1m": "1", "5m": "5", "1h": "60", "4h": "240",
};

async function fetchBybitCandles(
  symbol: string, interval: string, limit = 200
): Promise<Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>> {
  const bybitInterval = BYBIT_INTERVAL_MAP[interval] ?? "60";
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`Bybit ${resp.status}: ${symbol}/${interval}`);
  const json = (await resp.json()) as { result: { list: string[][] } };
  const list = json.result?.list ?? [];
  return list.map(([t, o, h, l, c, v]) => ({
    t: parseInt(t),
    o: parseFloat(o), h: parseFloat(h),
    l: parseFloat(l), c: parseFloat(c), v: parseFloat(v),
  })).reverse();
}

function computeEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(-(period + 1)).map((v, i, a) => i === 0 ? 0 : v - a[i - 1]).slice(1);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function computeADX(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period * 2) return null;
  const slice = (arr: number[]) => arr.slice(-(period * 2));
  const H = slice(highs); const L = slice(lows); const C = slice(closes);
  const dmPlus: number[] = []; const dmMinus: number[] = []; const tr: number[] = [];
  for (let i = 1; i < H.length; i++) {
    const upMove = H[i] - H[i - 1];
    const downMove = L[i - 1] - L[i];
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
  }
  const atr = tr.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (atr === 0) return null;
  const diPlus = (dmPlus.slice(-period).reduce((a, b) => a + b, 0) / period) / atr * 100;
  const diMinus = (dmMinus.slice(-period).reduce((a, b) => a + b, 0) / period) / atr * 100;
  const dxDiff = Math.abs(diPlus - diMinus);
  const dxSum = diPlus + diMinus;
  return dxSum > 0 ? (dxDiff / dxSum) * 100 : 0;
}

async function syncSymbol(symbol: string, timeframe: string): Promise<void> {
  const candles = await fetchBybitCandles(symbol, timeframe, 200);

  const rows = candles.map(c => ({
    symbol, timeframe,
    open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
    timestamp: new Date(c.t).toISOString(),
  }));

  const { error } = await supabase.from("market_candles").upsert(rows, {
    onConflict: "symbol,timeframe,timestamp",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Upsert candles ${symbol}/${timeframe}: ${error.message}`);

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);

  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const rsi = computeRSI(closes);
  const atr = computeATR(highs, lows, closes);
  const adx = computeADX(highs, lows, closes);
  const macd = ema20 !== null && ema50 !== null ? ema20 - ema50 : null;
  const macd_signal = macd !== null ? macd * 0.9 : null;

  const { error: indErr } = await supabase.from("indicators").upsert(
    [{ symbol, timeframe, ema20, ema50, ema200, rsi, atr, adx, macd, macd_signal, updated_at: new Date().toISOString() }],
    { onConflict: "symbol,timeframe" }
  );
  if (indErr) throw new Error(`Upsert indicators ${symbol}/${timeframe}: ${indErr.message}`);
}

let running = false;

async function runOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const tasks = SYMBOLS.flatMap(s =>
      ["1m", "5m", "1h", "4h"].map(tf =>
        syncSymbol(s, tf).catch(err =>
          logger.warn({ err: err.message }, `market sync failed: ${s}/${tf}`)
        )
      )
    );
    await Promise.allSettled(tasks);
    logger.info("Bybit market data sync complete");
  } finally {
    running = false;
  }
}

export function startMarketWorker(): void {
  runOnce();
  setInterval(runOnce, 60_000);
  logger.info("Bybit market data worker started — syncing every 60s");
}
