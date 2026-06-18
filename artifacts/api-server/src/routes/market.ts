import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { GetCandlesParams, GetIndicatorsParams } from "@workspace/api-zod";

const router: IRouter = Router();

const COIN_MAP: Record<string, { id: string; symbol: string; name: string }> = {
  bitcoin:       { id: "bitcoin",       symbol: "BTCUSDT",  name: "Bitcoin"   },
  ethereum:      { id: "ethereum",      symbol: "ETHUSDT",  name: "Ethereum"  },
  solana:        { id: "solana",        symbol: "SOLUSDT",  name: "Solana"    },
  binancecoin:   { id: "binancecoin",   symbol: "BNBUSDT",  name: "BNB"       },
  ripple:        { id: "ripple",        symbol: "XRPUSDT",  name: "XRP"       },
  cardano:       { id: "cardano",       symbol: "ADAUSDT",  name: "Cardano"   },
  "avalanche-2": { id: "avalanche-2",   symbol: "AVAXUSDT", name: "Avalanche" },
  dogecoin:      { id: "dogecoin",      symbol: "DOGEUSDT", name: "Dogecoin"  },
};

router.get("/market/prices", async (_req, res): Promise<void> => {
  try {
    const ids = Object.keys(COIN_MAP).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );

    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);

    const data = (await r.json()) as Array<{
      id: string; current_price: number; price_change_24h: number;
      price_change_percentage_24h: number; total_volume: number;
      high_24h: number; low_24h: number; market_cap: number;
    }>;

    const prices = data.map(coin => {
      const m = COIN_MAP[coin.id];
      return {
        symbol: m?.symbol ?? coin.id.toUpperCase() + "USDT",
        name: m?.name ?? coin.id,
        price: coin.current_price,
        change24h: coin.price_change_24h,
        changePercent24h: coin.price_change_percentage_24h,
        volume24h: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        marketCap: coin.market_cap,
        updatedAt: new Date().toISOString(),
      };
    });

    res.json(prices);
  } catch {
    // Fallback: use latest candle close prices from Supabase
    const symbols = Object.values(COIN_MAP);
    const { data: candles } = await supabase
      .from("market_candles")
      .select("symbol, close, high, low, volume, timestamp")
      .in("symbol", symbols.map(s => s.symbol))
      .eq("timeframe", "1m")
      .order("timestamp", { ascending: false })
      .limit(symbols.length * 2);

    const latest = new Map<string, any>();
    for (const c of candles ?? []) {
      if (!latest.has(c.symbol)) latest.set(c.symbol, c);
    }

    res.json(symbols.map(s => {
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

export default router;
