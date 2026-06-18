import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { GetCandlesParams, GetIndicatorsParams } from "@workspace/api-zod";

const router: IRouter = Router();

const SYMBOLS_MAP = [
  { symbol: "BTCUSDT",  name: "Bitcoin",   category: "crypto" },
  { symbol: "ETHUSDT",  name: "Ethereum",  category: "crypto" },
  { symbol: "SOLUSDT",  name: "Solana",    category: "crypto" },
  { symbol: "BNBUSDT",  name: "BNB",       category: "crypto" },
  { symbol: "XRPUSDT",  name: "XRP",       category: "crypto" },
  { symbol: "ADAUSDT",  name: "Cardano",   category: "crypto" },
  { symbol: "AVAXUSDT", name: "Avalanche", category: "crypto" },
  { symbol: "DOGEUSDT", name: "Dogecoin",  category: "crypto" },
];

const BYBIT_INTERVAL: Record<string, string> = {
  "1m":"1","3m":"3","5m":"5","15m":"15","30m":"30",
  "1h":"60","2h":"120","4h":"240","6h":"360","12h":"720","1d":"D","1w":"W","1M":"M",
};

async function bybitFetch(path: string, params?: Record<string,string>): Promise<any> {
  const u = new URL(`https://api.bybit.com${path}`);
  if (params) Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Bybit ${r.status} ${path}`);
  return r.json();
}

// ── Live prices ──────────────────────────────────────────────────────────────
router.get("/market/prices", async (_req, res): Promise<void> => {
  try {
    const json = await bybitFetch("/v5/market/tickers", { category: "spot" });
    const tickerMap = new Map(json.result.list.map((t: any) => [t.symbol, t]));
    const prices = SYMBOLS_MAP.map(({ symbol, name }) => {
      const t: any = tickerMap.get(symbol);
      const price = t ? parseFloat(t.lastPrice) : 0;
      const changePct = t ? parseFloat(t.price24hPcnt) * 100 : 0;
      return {
        symbol, name, price,
        change24h: t ? price - parseFloat(t.prevPrice24h) : 0,
        changePercent24h: Math.round(changePct * 100) / 100,
        volume24h: t ? parseFloat(t.turnover24h) : 0,
        high24h: t ? parseFloat(t.highPrice24h) : 0,
        low24h:  t ? parseFloat(t.lowPrice24h) : 0,
        marketCap: null, updatedAt: new Date().toISOString(),
      };
    });
    res.json(prices);
  } catch {
    const { data: candles } = await supabase
      .from("market_candles").select("symbol,close,high,low,volume,timestamp")
      .in("symbol", SYMBOLS_MAP.map(s => s.symbol)).eq("timeframe","1m")
      .order("timestamp",{ascending:false}).limit(SYMBOLS_MAP.length * 2);
    const latest = new Map<string,any>();
    for (const c of candles ?? []) if (!latest.has(c.symbol)) latest.set(c.symbol,c);
    res.json(SYMBOLS_MAP.map(s => {
      const c = latest.get(s.symbol);
      return { symbol:s.symbol, name:s.name, price:c?.close??0, change24h:0, changePercent24h:0,
        volume24h:c?.volume??0, high24h:c?.high??0, low24h:c?.low??0, marketCap:null, updatedAt:c?.timestamp??new Date().toISOString() };
    }));
  }
});

// ── Klines (direct Bybit, large history) ─────────────────────────────────────
router.get("/market/klines/:symbol/:timeframe", async (req, res): Promise<void> => {
  const { symbol, timeframe } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "200"), 1000);
  const interval = BYBIT_INTERVAL[timeframe] ?? "60";
  try {
    const json = await bybitFetch("/v5/market/kline", { category:"spot", symbol, interval, limit:String(limit) });
    const candles = (json.result?.list ?? []).map((c: string[]) => ({
      timestamp: new Date(parseInt(c[0])).toISOString(),
      open: parseFloat(c[1]), high: parseFloat(c[2]),
      low: parseFloat(c[3]), close: parseFloat(c[4]),
      volume: parseFloat(c[5]), turnover: parseFloat(c[6]),
    })).reverse();
    res.json(candles);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Order book ────────────────────────────────────────────────────────────────
router.get("/market/orderbook/:symbol", async (req, res): Promise<void> => {
  const { symbol } = req.params;
  const limit = parseInt((req.query.limit as string) ?? "25");
  try {
    const json = await bybitFetch("/v5/market/orderbook", { category:"spot", symbol, limit:String(limit) });
    const bids: [string,string][] = json.result?.b ?? [];
    const asks: [string,string][] = json.result?.a ?? [];
    const totalBid = bids.reduce((s, [,qty]) => s + parseFloat(qty), 0);
    const totalAsk = asks.reduce((s, [,qty]) => s + parseFloat(qty), 0);
    res.json({
      symbol,
      bids: bids.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty), total: parseFloat(price)*parseFloat(qty) })),
      asks: asks.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty), total: parseFloat(price)*parseFloat(qty) })),
      spread: asks[0] && bids[0] ? parseFloat(asks[0][0]) - parseFloat(bids[0][0]) : null,
      bidAskRatio: totalBid + totalAsk > 0 ? Math.round((totalBid / (totalBid + totalAsk)) * 10000) / 100 : 50,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Recent trades ─────────────────────────────────────────────────────────────
router.get("/market/trades/:symbol", async (req, res): Promise<void> => {
  const { symbol } = req.params;
  const limit = parseInt((req.query.limit as string) ?? "50");
  try {
    const json = await bybitFetch("/v5/market/recent-trade", { category:"spot", symbol, limit:String(limit) });
    const trades = (json.result?.list ?? []).map((t: any) => ({
      time: new Date(parseInt(t.time)).toISOString(),
      price: parseFloat(t.price), qty: parseFloat(t.size),
      value: parseFloat(t.price) * parseFloat(t.size),
      side: t.side, // Buy or Sell
    }));
    res.json(trades);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Funding rate (linear perpetual) ──────────────────────────────────────────
router.get("/market/funding/:symbol", async (req, res): Promise<void> => {
  const { symbol } = req.params;
  const perpSymbol = symbol.replace("USDT","") + "USDT"; // e.g. BTCUSDT
  try {
    const [fundJson, oiJson] = await Promise.all([
      bybitFetch("/v5/market/funding/history", { category:"linear", symbol:perpSymbol, limit:"1" }),
      bybitFetch("/v5/market/open-interest", { category:"linear", symbol:perpSymbol, intervalTime:"1h", limit:"2" }),
    ]);
    const fund = fundJson.result?.list?.[0];
    const oiList = oiJson.result?.list ?? [];
    const oiCur = oiList[0] ? parseFloat(oiList[0].openInterest) : 0;
    const oiPrev = oiList[1] ? parseFloat(oiList[1].openInterest) : oiCur;
    const oiChange = oiPrev > 0 ? ((oiCur - oiPrev) / oiPrev) * 100 : 0;
    res.json({
      symbol: perpSymbol,
      fundingRate: fund ? parseFloat(fund.fundingRate) * 100 : null,
      fundingTime: fund?.fundingRateTimestamp ? new Date(parseInt(fund.fundingRateTimestamp)).toISOString() : null,
      openInterest: oiCur,
      openInterestChange: Math.round(oiChange * 100) / 100,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Single ticker ─────────────────────────────────────────────────────────────
router.get("/market/ticker/:symbol", async (req, res): Promise<void> => {
  const { symbol } = req.params;
  try {
    const json = await bybitFetch("/v5/market/tickers", { category:"spot", symbol });
    const t: any = json.result?.list?.[0];
    if (!t) { res.status(404).json({ error:"Symbol not found" }); return; }
    res.json({
      symbol: t.symbol, price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.price24hPcnt) * 100,
      high24h: parseFloat(t.highPrice24h), low24h: parseFloat(t.lowPrice24h),
      volume24h: parseFloat(t.turnover24h), prevClose: parseFloat(t.prevPrice24h),
      bid: parseFloat(t.bid1Price), ask: parseFloat(t.ask1Price),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Candles from Supabase (stored) ────────────────────────────────────────────
router.get("/market/candles/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetCandlesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { data, error } = await supabase.from("market_candles").select("*")
    .eq("symbol",params.data.symbol).eq("timeframe",params.data.timeframe)
    .order("timestamp",{ascending:false}).limit(100);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(c => ({
    id:c.id, symbol:c.symbol, timeframe:c.timeframe,
    open:c.open, high:c.high, low:c.low, close:c.close, volume:c.volume, timestamp:c.timestamp,
  })));
});

// ── Indicators from Supabase ──────────────────────────────────────────────────
router.get("/market/indicators/:symbol/:timeframe", async (req, res): Promise<void> => {
  const params = GetIndicatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { data } = await supabase.from("indicators").select("*")
    .eq("symbol",params.data.symbol).eq("timeframe",params.data.timeframe)
    .order("updated_at",{ascending:false}).limit(1).maybeSingle();
  res.json({
    symbol:params.data.symbol, timeframe:params.data.timeframe,
    ema20:data?.ema20??null, ema50:data?.ema50??null, ema200:data?.ema200??null,
    rsi:data?.rsi??null, macd:data?.macd??null, macdSignal:data?.macd_signal??null,
    atr:data?.atr??null, vwap:data?.vwap??null,
    bollingerUpper:data?.bollinger_upper??null, bollingerLower:data?.bollinger_lower??null,
    adx:data?.adx??null, updatedAt:data?.updated_at??new Date().toISOString(),
  });
});

// ── AI Market Scanner ─────────────────────────────────────────────────────────
router.get("/market/scanner", async (_req, res): Promise<void> => {
  try {
    const json = await bybitFetch("/v5/market/tickers", { category:"spot" });
    const all: any[] = json.result?.list ?? [];
    const results: any[] = [];
    for (const t of all) {
      const pct = parseFloat(t.price24hPcnt) * 100;
      const price = parseFloat(t.lastPrice);
      const vol = parseFloat(t.turnover24h);
      const high = parseFloat(t.highPrice24h);
      const low = parseFloat(t.lowPrice24h);
      if (!price || !vol) continue;

      const range = high > 0 ? ((high - low) / low) * 100 : 0;
      let signal = "", confidence = 0, reason = "";

      if (pct > 5 && vol > 5_000_000) { signal = "Breakout"; confidence = 75 + Math.min(Math.abs(pct), 20); reason = `+${pct.toFixed(1)}% with $${(vol/1e6).toFixed(0)}M volume`; }
      else if (pct < -5 && vol > 5_000_000) { signal = "Breakdown"; confidence = 70 + Math.min(Math.abs(pct), 20); reason = `${pct.toFixed(1)}% sell-off with high volume`; }
      else if (range > 8 && Math.abs(pct) < 2) { signal = "High Volatility"; confidence = 65; reason = `${range.toFixed(1)}% range, consolidating`; }
      else if (pct > 2 && pct <= 5) { signal = "Bullish Momentum"; confidence = 60 + pct * 3; reason = `+${pct.toFixed(1)}% momentum building`; }

      if (signal && confidence > 60) {
        results.push({
          symbol: t.symbol, signal, confidence: Math.min(Math.round(confidence), 98),
          price, change: Math.round(pct * 100) / 100,
          volume: Math.round(vol), reason,
          entry: price, sl: price * (signal.includes("Bullish") || signal === "Breakout" ? 0.97 : 1.03),
          tp: price * (signal.includes("Bullish") || signal === "Breakout" ? 1.06 : 0.94),
          rr: "2.0",
        });
      }
    }
    results.sort((a,b) => b.confidence - a.confidence);
    res.json(results.slice(0, 30));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
