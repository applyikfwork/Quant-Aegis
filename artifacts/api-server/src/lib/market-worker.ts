import { db } from "@workspace/db";
import { marketCandlesTable, indicatorsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./logger";

const SYMBOLS = [
  { binance: "BTCUSDT", display: "BTCUSDT" },
  { binance: "ETHUSDT", display: "ETHUSDT" },
  { binance: "SOLUSDT", display: "SOLUSDT" },
  { binance: "BNBUSDT", display: "BNBUSDT" },
  { binance: "XRPUSDT", display: "XRPUSDT" },
  { binance: "ADAUSDT", display: "ADAUSDT" },
  { binance: "AVAXUSDT", display: "AVAXUSDT" },
  { binance: "DOGEUSDT", display: "DOGEUSDT" },
];

const TIMEFRAMES: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

async function fetchBinanceCandles(
  symbol: string,
  interval: string,
  limit = 100
): Promise<Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`Binance klines ${resp.status}: ${symbol}/${interval}`);
  const raw = (await resp.json()) as Array<[number, string, string, string, string, string, ...unknown[]]>;
  return raw.map(([t, o, h, l, c, v]) => ({
    t,
    o: parseFloat(o),
    h: parseFloat(h),
    l: parseFloat(l),
    c: parseFloat(c),
    v: parseFloat(v),
  }));
}

function computeEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(-period - 1).map((v, i, a) => (i === 0 ? 0 : v - a[i - 1])).slice(1);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function upsertCandles(symbol: string, timeframe: string): Promise<void> {
  const candles = await fetchBinanceCandles(symbol, timeframe, 200);

  for (const candle of candles) {
    const ts = new Date(candle.t);
    await db
      .insert(marketCandlesTable)
      .values({
        symbol,
        timeframe,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        volume: candle.v,
        timestamp: ts,
      })
      .onConflictDoNothing();
  }

  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);

  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const rsi = computeRSI(closes);
  const atr = computeATR(highs, lows, closes);

  await db
    .insert(indicatorsTable)
    .values({
      symbol,
      timeframe,
      ema20,
      ema50,
      ema200,
      rsi,
      atr,
      macd: ema20 !== null && ema50 !== null ? ema20 - ema50 : null,
    })
    .onConflictDoNothing();
}

let running = false;

async function runOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await Promise.allSettled(
      SYMBOLS.flatMap((s) =>
        ["1m", "5m", "1h"].map((tf) =>
          upsertCandles(s.binance, tf).catch((err) => {
            logger.warn({ err, symbol: s.binance, tf }, "candle fetch failed");
          })
        )
      )
    );
    logger.info("Market data sync complete");
  } finally {
    running = false;
  }
}

export function startMarketWorker(): void {
  runOnce();
  setInterval(runOnce, 60_000);
  logger.info("Market data worker started (60s interval)");
}
