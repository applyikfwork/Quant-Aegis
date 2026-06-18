import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { GetCandlesParams, GetIndicatorsParams } from "@workspace/api-zod";

const router: IRouter = Router();

const SYMBOLS_MAP = [
  { symbol: "BTCUSDT",  name: "Bitcoin",    category: "crypto" },
  { symbol: "ETHUSDT",  name: "Ethereum",   category: "crypto" },
  { symbol: "SOLUSDT",  name: "Solana",     category: "crypto" },
  { symbol: "BNBUSDT",  name: "BNB",        category: "crypto" },
  { symbol: "XRPUSDT",  name: "XRP",        category: "crypto" },
  { symbol: "ADAUSDT",  name: "Cardano",    category: "crypto" },
  { symbol: "AVAXUSDT", name: "Avalanche",  category: "crypto" },
  { symbol: "DOGEUSDT", name: "Dogecoin",   category: "crypto" },
];

router.get("/market/prices", async (_req, res): Promise<void> => {
  try {
    const symbols = SYMBOLS_MAP.map(s => s.symbol).join(",");
    const url = `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${SYMBOLS_MAP[0].symbol}`;

    // Fetch all tickers in one call
    const allUrl = `https://api.bybit.com/v5/market/tickers?category=spot`;
    const r = await fetch(allUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Bybit tickers ${r.status}`);

    const json = (await r.json()) as {
      result: {
        list: Array<{
          symbol: string;
          lastPrice: string;
          price24hPcnt: string;
          volume24h: string;
          highPrice24h: string;
          lowPrice24h: string;
          prevPrice24h: string;
          turnover24h: string;
        }>;
      };
    };

    const tickerMap = new Map(json.result.list.map(t => [t.symbol, t]));

    const prices = SYMBOLS_MAP.map(({ symbol, name }) => {
      const t = tickerMap.get(symbol);
      const price = t ? parseFloat(t.lastPrice) : 0;
      const prevPrice = t ? parseFloat(t.prevPrice24h) : 0;
      const change24h = price - prevPrice;
      const changePct = t ? parseFloat(t.price24hPcnt) * 100 : 0;
      return {
        symbol, name,
        price,
        change24h: Math.round(change24h * 10000) / 10000,
        changePercent24h: Math.round(changePct * 100) / 100,
        volume24h: t ? parseFloat(t.turnover24h) : 0, // turnover24h = USD volume
        high24h: t ? parseFloat(t.highPrice24h) : 0,
        low24h: t ? parseFloat(t.lowPrice24h) : 0,
        marketCap: null,
        updatedAt: new Date().toISOString(),
      };
    });

    res.json(prices);
  } catch {
    // Fallback: use latest candle close prices from Supabase
    const symbolNames = SYMBOLS_MAP;
    const { data: candles } = await supabase
      .from("market_candles")
      .select("symbol, close, high, low, volume, timestamp")
      .in("symbol", symbolNames.map(s => s.symbol))
      .eq("timeframe", "1m")
      .order("timestamp", { ascending: false })
      .limit(symbolNames.length * 2);

    const latest = new Map<string, { close: number; high: number; low: number; volume: number; timestamp: string }>();
    for (const c of candles ?? []) {
      if (!latest.has(c.symbol)) latest.set(c.symbol, c);
    }

    res.json(symbolNames.map(s => {
      const c = latest.get(s.symbol);
      return {
        symbol: s.symbol, name: s.name,
        price: c?.close ?? 0, change24h: 0, changePercent24h: 0,
        volume24h: c?.volume ?? 0, high24h: c?.high ?? 0, low24h: c?.low ?? 0,
        marketCap: null, updatedAt: c?.timestamp ?? new Date().toISOString(),
      };
    }));
  }
});

router.get("/market/candles/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetCandlesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabase
    .from("market_candles")
    .select("*")
    .eq("symbol", params.data.symbol)
    .eq("timeframe", params.data.timeframe)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(c => ({
    id: c.id, symbol: c.symbol, timeframe: c.timeframe,
    open: c.open, high: c.high, low: c.low, close: c.close,
    volume: c.volume, timestamp: c.timestamp,
  })));
});

router.get("/market/indicators/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetIndicatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data } = await supabase
    .from("indicators")
    .select("*")
    .eq("symbol", params.data.symbol)
    .eq("timeframe", params.data.timeframe)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({
    symbol: params.data.symbol, timeframe: params.data.timeframe,
    ema20: data?.ema20 ?? null, ema50: data?.ema50 ?? null, ema200: data?.ema200 ?? null,
    rsi: data?.rsi ?? null, macd: data?.macd ?? null, macdSignal: data?.macd_signal ?? null,
    atr: data?.atr ?? null, vwap: data?.vwap ?? null,
    bollingerUpper: data?.bollinger_upper ?? null, bollingerLower: data?.bollinger_lower ?? null,
    adx: data?.adx ?? null, updatedAt: data?.updated_at ?? new Date().toISOString(),
  });
});

// Bybit ticker for a single symbol (used by dashboard watchlist etc.)
router.get("/market/ticker/:symbol", async (req, res): Promise<void> => {
  const { symbol } = req.params;
  try {
    const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`, {
      signal: AbortSignal.timeout(5000),
    });
    const json = (await r.json()) as { result: { list: Array<Record<string, string>> } };
    const t = json.result?.list?.[0];
    if (!t) { res.status(404).json({ error: "Symbol not found" }); return; }
    res.json({
      symbol: t.symbol, price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.price24hPcnt) * 100,
      volume24h: parseFloat(t.volume24h),
      high24h: parseFloat(t.highPrice24h),
      low24h: parseFloat(t.lowPrice24h),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
