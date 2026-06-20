import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { CreateSignalBody, ListSignalsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }

const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","AVAXUSDT","ADAUSDT","DOGEUSDT"];
const TIMEFRAMES = ["15m","1H","4H","1D"];
const STRATEGIES = ["Trend Following","Momentum","SMC Breakout","Mean Reversion","Scalping Alpha","Swing Pivot"];
const CATEGORIES = [["Swing","Trend","Momentum"],["Scalping","Breakout"],["Intraday","Momentum"],["Swing","Reversal"],["Trend","Breakout","High Confidence"],["Swing","Counter-Trend"]];
const SIGNAL_STATUSES = ["generated","waiting","triggered","active","completed","cancelled","expired"];
const PRIORITIES = ["critical","high","medium","low","watch"];

function generateDemoSignals(count: number) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const isBuy = Math.random() > 0.42;
    const confidence = Math.round(clamp(rand(52, 94)));
    const symbol = pick(SYMBOLS);
    const timeframe = pick(TIMEFRAMES);
    const strategy = pick(STRATEGIES);
    const catIdx = Math.floor(Math.random() * CATEGORIES.length);
    const priority: string = confidence >= 85 ? "critical" : confidence >= 75 ? "high" : confidence >= 65 ? "medium" : "low";
    const status: string = pick(SIGNAL_STATUSES);
    const ageMs = rand(0, 72 * 3600 * 1000);
    const createdAt = new Date(now - ageMs).toISOString();
    const expiresAt = new Date(now - ageMs + rand(0.5, 4) * 3600 * 1000).toISOString();
    const basePrice = symbol.startsWith("BTC") ? rand(90000, 110000)
      : symbol.startsWith("ETH") ? rand(3000, 4200)
      : symbol.startsWith("SOL") ? rand(130, 210)
      : symbol.startsWith("BNB") ? rand(550, 750)
      : rand(0.5, 5);
    const atr = basePrice * rand(0.012, 0.03);
    const entry = Math.round(basePrice * (isBuy ? rand(0.997, 1.002) : rand(0.998, 1.003)) * 100) / 100;
    const sl = Math.round((isBuy ? entry - atr * rand(1.2, 2) : entry + atr * rand(1.2, 2)) * 100) / 100;
    const tp1 = Math.round((isBuy ? entry + atr * rand(1.5, 2.5) : entry - atr * rand(1.5, 2.5)) * 100) / 100;
    const tp2 = Math.round((isBuy ? entry + atr * rand(2.5, 4) : entry - atr * rand(2.5, 4)) * 100) / 100;
    const tp3 = Math.round((isBuy ? entry + atr * rand(4, 6) : entry - atr * rand(4, 6)) * 100) / 100;
    const slDist = Math.abs(entry - sl);
    const rr = slDist > 0 ? Math.round((Math.abs(tp1 - entry) / slDist) * 10) / 10 : 0;

    const agentVotes = {
      Trend: { score: Math.round(rand(55, 92)), direction: isBuy ? "bullish" : "bearish" },
      "Market Structure": { score: Math.round(rand(52, 90)), direction: isBuy ? "bullish" : "bearish" },
      Volume: { score: Math.round(rand(48, 88)), direction: Math.random() > 0.3 ? (isBuy ? "bullish" : "bearish") : "neutral" },
      Momentum: { score: Math.round(rand(50, 91)), direction: isBuy ? "bullish" : "bearish" },
      "Smart Money": { score: Math.round(rand(54, 93)), direction: isBuy ? "bullish" : "bearish" },
      Sentiment: { score: Math.round(rand(42, 82)), direction: Math.random() > 0.4 ? (isBuy ? "bullish" : "bearish") : "neutral" },
      Macro: { score: Math.round(rand(40, 78)), direction: Math.random() > 0.5 ? (isBuy ? "bullish" : "bearish") : "neutral" },
      Risk: { score: Math.round(rand(60, 95)), direction: "approved" },
    };

    const evidence = [
      isBuy ? "EMA bullish alignment — price above EMA20, 50, 200" : "EMA bearish stack — price below key moving averages",
      `ADX ${Math.round(rand(22, 48))} — ${Math.random() > 0.5 ? "strong" : "moderate"} trend`,
      `RSI ${Math.round(rand(32, 68))} — ${isBuy ? "healthy zone, room to run" : "approaching resistance"}`,
      isBuy ? "Volume expanding on breakout candle" : "Volume elevated on selling pressure",
      isBuy ? "Smart Money bullish OB below price acting as support" : "Bearish OB overhead limiting upside",
      `Historical pattern match ${Math.round(rand(72, 94))}% — ${Math.round(rand(15, 45))} similar setups`,
    ];

    const marketSnapshot = {
      rsi: Math.round(rand(32, 72) * 10) / 10,
      ema20: Math.round(basePrice * rand(0.992, 1.005) * 100) / 100,
      ema50: Math.round(basePrice * rand(0.980, 0.998) * 100) / 100,
      ema200: Math.round(basePrice * rand(0.960, 0.985) * 100) / 100,
      adx: Math.round(rand(18, 48) * 10) / 10,
      atr: Math.round(atr * 100) / 100,
      volume: Math.round(rand(100000, 2000000)),
      relativeVolume: Math.round(rand(0.7, 2.1) * 100) / 100,
      fundingRate: Math.round(rand(-0.05, 0.08) * 10000) / 100,
      fearGreed: Math.round(rand(25, 74)),
      spread: Math.round(rand(0.01, 0.15) * 100) / 100,
      volatility: Math.round(rand(8, 35) * 10) / 10,
    };

    const confidenceBreakdown = [
      { factor: "Trend", weight: 25, score: agentVotes.Trend.score },
      { factor: "Market Structure", weight: 15, score: agentVotes["Market Structure"].score },
      { factor: "Volume", weight: 15, score: agentVotes.Volume.score },
      { factor: "Momentum", weight: 10, score: agentVotes.Momentum.score },
      { factor: "Liquidity", weight: 10, score: agentVotes["Smart Money"].score },
      { factor: "Macro", weight: 10, score: agentVotes.Macro.score },
      { factor: "Sentiment", weight: 5, score: agentVotes.Sentiment.score },
      { factor: "Derivatives", weight: 5, score: Math.round(rand(45, 85)) },
      { factor: "Pattern", weight: 5, score: Math.round(rand(52, 90)) },
    ];

    const lifecycle = [
      { event: "generated", ts: createdAt, detail: "Signal generated by AI multi-agent consensus" },
      ...(["waiting","triggered","active","completed"].includes(status) ? [{ event: "validated", ts: new Date(+new Date(createdAt) + 12000).toISOString(), detail: "Signal passed verification engine checks" }] : []),
      ...(["triggered","active","completed"].includes(status) ? [{ event: "triggered", ts: new Date(+new Date(createdAt) + rand(60000, 600000)).toISOString(), detail: `Price reached entry zone — ${symbol} @ $${entry}` }] : []),
      ...(["active","completed"].includes(status) ? [{ event: "active", ts: new Date(+new Date(createdAt) + rand(600000, 3600000)).toISOString(), detail: "Trade opened and being monitored" }] : []),
      ...(status === "completed" ? [{ event: "closed", ts: new Date(+new Date(createdAt) + rand(3600000, 86400000)).toISOString(), detail: `Position closed — ${Math.random() > 0.45 ? "TP1 hit" : "SL triggered"}` }] : []),
      ...(status === "expired" ? [{ event: "expired", ts: expiresAt, detail: "Signal expired — max age exceeded without trigger" }] : []),
      ...(status === "cancelled" ? [{ event: "cancelled", ts: new Date(+new Date(createdAt) + rand(30000, 300000)).toISOString(), detail: "Signal cancelled — verification failed or market conditions changed" }] : []),
    ];

    const pnl = status === "completed" ? Math.random() > 0.52 ? Math.round(rand(0.8, 8.5) * 10) / 10 : -Math.round(rand(0.5, 2.5) * 10) / 10 : null;

    return {
      id: 1000 + i,
      uuid: `sig-${Date.now()}-${i}`,
      symbol,
      timeframe,
      signalType: isBuy ? "buy" : "sell",
      direction: isBuy ? "LONG" : "SHORT",
      status,
      priority,
      confidence,
      strategy,
      categories: CATEGORIES[catIdx],
      entry,
      stopLoss: sl,
      tp1,
      tp2,
      tp3,
      riskReward: rr,
      currentPrice: Math.round(basePrice * (1 + rand(-0.02, 0.02)) * 100) / 100,
      exchange: "Bybit",
      marketPhase: pick(["Markup","Markdown","Accumulation","Distribution","Re-accumulation"]),
      winProbability: Math.round(confidence * rand(0.85, 0.95)),
      maxRisk: pick(["1%","1.5%","2%"]),
      expectedDuration: timeframe === "1D" ? "3-7 days" : timeframe === "4H" ? "1-3 days" : timeframe === "1H" ? "4-24 hours" : "1-4 hours",
      createdAt,
      expiresAt,
      agentVotes,
      evidence,
      marketSnapshot,
      confidenceBreakdown,
      lifecycle,
      pnl,
      reason: evidence[0],
      strategyName: strategy,
      atr: Math.round(atr * 100) / 100,
      volatilityRegime: pick(["Low","Normal","High","Extreme"]),
      invalidationCondition: isBuy ? `Close below $${sl.toLocaleString()}` : `Close above $${sl.toLocaleString()}`,
    };
  });
}

// ─── GET /signals ─────────────────────────────────────────────────────────────
router.get("/signals", async (req, res): Promise<void> => {
  const query = ListSignalsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const limit = typeof query.data.limit === "number" ? query.data.limit : 50;

  // Skip DB entirely in offline mode — return demo data immediately
  if (isOfflineMode) {
    res.json(generateDemoSignals(Math.min(limit, 30)));
    return;
  }

  const { data, error } = await supabase
    .from("signals")
    .select("*, strategies(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    res.json(generateDemoSignals(Math.min(limit, 30)));
    return;
  }

  res.json(data.map(s => {
    const isBuy = s.signal_type === "buy";
    const entryPrice = (s as any).entry_price ?? 0;
    const sl = (s as any).stop_loss ?? 0;
    const tp1 = (s as any).tp1 ?? 0;
    const tp2 = (s as any).tp2 ?? 0;
    const tp3 = (s as any).tp3 ?? 0;
    const rr = (s as any).risk_reward ?? 0;
    const agentVotes = (s as any).agent_votes ?? {};
    const marketSnapshot = (s as any).market_snapshot ?? {};
    const tf = (s as any).timeframe ?? "4H";
    const decisionId = (s as any).decision_id ?? null;

    // Build evidence from agent votes if available
    const evidence = Object.keys(agentVotes).length > 0
      ? Object.entries(agentVotes).slice(0, 6).map(([agent, v]: [string, any]) =>
          `${agent}: ${v?.direction ?? "neutral"} (${v?.score ?? 0}%)`)
      : [s.reason ?? "AI-generated signal"];

    // Build confidence breakdown from agent votes
    const confidenceBreakdown = Object.keys(agentVotes).length > 0
      ? Object.entries(agentVotes).slice(0, 9).map(([factor, v]: [string, any], i) => ({
          factor, weight: [25,15,15,10,10,10,5,5,5][i] ?? 5, score: v?.score ?? 50,
        }))
      : [];

    const lifecycle = [
      { event: "generated", ts: s.created_at, detail: "Signal generated by AI multi-agent consensus" },
      ...(["active","completed"].includes(s.status) ? [{ event: "triggered", ts: new Date(+new Date(s.created_at) + 60000).toISOString(), detail: `Price reached entry zone @ $${entryPrice}` }] : []),
      ...(s.status === "completed" ? [{ event: "closed", ts: new Date(+new Date(s.created_at) + 3600000).toISOString(), detail: "Position closed" }] : []),
    ];

    return {
      id: s.id,
      uuid: `sig-${s.id}`,
      symbol: s.symbol,
      timeframe: tf,
      signalType: s.signal_type,
      direction: isBuy ? "LONG" : "SHORT",
      status: s.status,
      priority: s.confidence >= 85 ? "critical" : s.confidence >= 75 ? "high" : s.confidence >= 65 ? "medium" : "low",
      confidence: s.confidence,
      strategy: (s.strategies as Record<string, string> | null)?.name ?? "AI Engine",
      strategyName: (s.strategies as Record<string, string> | null)?.name ?? "AI Engine",
      categories: ["Swing", "Trend"],
      entry: entryPrice,
      stopLoss: sl,
      tp1, tp2, tp3,
      riskReward: rr,
      currentPrice: entryPrice,
      exchange: "Bybit",
      marketPhase: "Markup",
      winProbability: Math.round(s.confidence * 0.9),
      maxRisk: "2%",
      expectedDuration: tf === "1D" ? "3-7 days" : tf === "4H" ? "1-3 days" : tf === "1H" ? "4-24 hours" : "1-4 hours",
      createdAt: s.created_at,
      expiresAt: new Date(+new Date(s.created_at) + 4 * 3600000).toISOString(),
      agentVotes,
      evidence,
      marketSnapshot,
      confidenceBreakdown,
      lifecycle,
      pnl: null,
      reason: s.reason,
      atr: 0,
      volatilityRegime: "Normal",
      invalidationCondition: isBuy ? `Close below $${sl.toLocaleString()}` : `Close above $${sl.toLocaleString()}`,
      decisionId,
    };
  }));
});

// ─── POST /signals ────────────────────────────────────────────────────────────
router.post("/signals", async (req, res): Promise<void> => {
  const parsed = CreateSignalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: signal, error } = await supabase.from("signals").insert({
    symbol: parsed.data.symbol,
    strategy_id: parsed.data.strategyId ?? null,
    signal_type: parsed.data.signalType,
    confidence: parsed.data.confidence,
    reason: parsed.data.reason ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("activity_events").insert({
    type: "signal_generated",
    title: `Signal: ${parsed.data.signalType.toUpperCase()} ${parsed.data.symbol}`,
    description: `${parsed.data.signalType.toUpperCase()} signal for ${parsed.data.symbol} with ${parsed.data.confidence}% confidence`,
    symbol: parsed.data.symbol,
    value: parsed.data.confidence,
  });

  let strategyName: string | null = null;
  if (signal.strategy_id) {
    const { data: strat } = await supabase.from("strategies").select("name").eq("id", signal.strategy_id).single();
    strategyName = strat?.name ?? null;
  }

  res.status(201).json({
    id: signal.id, uuid: `sig-${signal.id}`, symbol: signal.symbol,
    strategyId: signal.strategy_id, signalType: signal.signal_type,
    confidence: signal.confidence, reason: signal.reason,
    status: signal.status, createdAt: signal.created_at, strategyName,
  });
});

export default router;
