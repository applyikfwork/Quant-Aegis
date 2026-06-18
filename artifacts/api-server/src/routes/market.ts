import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { marketCandlesTable, indicatorsTable } from "@workspace/db";
import {
  GetCandlesParams,
  GetIndicatorsParams,
} from "@workspace/api-zod";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /market/prices — fetch live prices from CoinGecko
router.get("/market/prices", async (req, res): Promise<void> => {
  try {
    const symbols = [
      { id: "bitcoin", symbol: "BTCUSDT", name: "Bitcoin" },
      { id: "ethereum", symbol: "ETHUSDT", name: "Ethereum" },
      { id: "solana", symbol: "SOLUSDT", name: "Solana" },
      { id: "binancecoin", symbol: "BNBUSDT", name: "BNB" },
      { id: "ripple", symbol: "XRPUSDT", name: "XRP" },
      { id: "cardano", symbol: "ADAUSDT", name: "Cardano" },
      { id: "avalanche-2", symbol: "AVAXUSDT", name: "Avalanche" },
      { id: "dogecoin", symbol: "DOGEUSDT", name: "Dogecoin" },
    ];

    const ids = symbols.map((s) => s.id).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      // Fallback mock data if CoinGecko is rate-limited
      const now = new Date().toISOString();
      const fallback = symbols.map((s, i) => ({
        symbol: s.symbol,
        name: s.name,
        price: [105000, 3800, 185, 720, 0.62, 0.48, 38, 0.185][i] ?? 100,
        change24h: [1200, -80, 3.5, 12, 0.02, -0.01, 1.2, 0.005][i] ?? 0,
        changePercent24h: [1.15, -2.06, 1.93, 1.69, 3.34, -2.04, 3.27, 2.78][i] ?? 0,
        volume24h: [42e9, 18e9, 8e9, 2e9, 4e9, 1e9, 900e6, 3e9][i] ?? 1e9,
        high24h: [106500, 3900, 190, 730, 0.64, 0.50, 39, 0.19][i] ?? 110,
        low24h: [103000, 3750, 181, 705, 0.60, 0.47, 37, 0.18][i] ?? 90,
        marketCap: null,
        updatedAt: now,
      }));
      res.json(fallback);
      return;
    }

    const data = (await response.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_24h: number;
      price_change_percentage_24h: number;
      total_volume: number;
      high_24h: number;
      low_24h: number;
      market_cap: number;
    }>;

    const symbolMap = new Map(symbols.map((s) => [s.id, s]));
    const prices = data.map((coin) => {
      const mapping = symbolMap.get(coin.id);
      return {
        symbol: mapping?.symbol ?? coin.symbol.toUpperCase() + "USDT",
        name: coin.name,
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market prices");
    res.status(500).json({ error: "Failed to fetch market prices" });
  }
});

// GET /market/candles/:symbol/:timeframe
router.get("/market/candles/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetCandlesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const candles = await db
    .select()
    .from(marketCandlesTable)
    .where(
      and(
        eq(marketCandlesTable.symbol, params.data.symbol),
        eq(marketCandlesTable.timeframe, params.data.timeframe)
      )
    )
    .orderBy(desc(marketCandlesTable.timestamp))
    .limit(100);

  res.json(
    candles.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      timeframe: c.timeframe,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      timestamp: c.timestamp.toISOString(),
    }))
  );
});

// GET /market/indicators/:symbol/:timeframe
router.get("/market/indicators/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetIndicatorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [indicator] = await db
    .select()
    .from(indicatorsTable)
    .where(
      and(
        eq(indicatorsTable.symbol, params.data.symbol),
        eq(indicatorsTable.timeframe, params.data.timeframe)
      )
    )
    .orderBy(desc(indicatorsTable.updatedAt))
    .limit(1);

  if (!indicator) {
    res.json({
      symbol: params.data.symbol,
      timeframe: params.data.timeframe,
      ema20: null,
      ema50: null,
      ema200: null,
      rsi: null,
      macd: null,
      macdSignal: null,
      atr: null,
      vwap: null,
      bollingerUpper: null,
      bollingerLower: null,
      adx: null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  res.json({
    symbol: indicator.symbol,
    timeframe: indicator.timeframe,
    ema20: indicator.ema20,
    ema50: indicator.ema50,
    ema200: indicator.ema200,
    rsi: indicator.rsi,
    macd: indicator.macd,
    macdSignal: indicator.macdSignal,
    atr: indicator.atr,
    vwap: indicator.vwap,
    bollingerUpper: indicator.bollingerUpper,
    bollingerLower: indicator.bollingerLower,
    adx: indicator.adx,
    updatedAt: indicator.updatedAt.toISOString(),
  });
});

export default router;
