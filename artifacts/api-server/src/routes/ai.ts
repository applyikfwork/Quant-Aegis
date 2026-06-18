import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

router.post("/ai/analyze", async (req, res): Promise<void> => {
  const { symbol = "BTCUSDT", timeframe = "4h" } = req.body ?? {};

  const [{ data: indRow }, { data: recentTrades }] = await Promise.all([
    supabase.from("indicators").select("*").eq("symbol", symbol).eq("timeframe", timeframe).maybeSingle(),
    supabase.from("trades").select("profit_loss, profit_percent, status").eq("symbol", symbol).order("entry_time", { ascending: false }).limit(20),
  ]);

  const indicators = indRow;
  const closed = (recentTrades ?? []).filter(t => t.status === "closed");
  const wins = closed.filter(t => (t.profit_loss ?? 0) > 0);
  const historicalWinRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgReturn = closed.length > 0 ? closed.reduce((s, t) => s + (t.profit_percent ?? 0), 0) / closed.length : 0;

  const ema20 = indicators?.ema20 ?? 0;
  const ema50 = indicators?.ema50 ?? 0;
  const ema200 = indicators?.ema200 ?? 0;
  const rsi = indicators?.rsi ?? 50;
  const adx = indicators?.adx ?? 20;
  const macd = indicators?.macd ?? 0;
  const macdSignal = indicators?.macd_signal ?? 0;

  const emaBullish = ema200 > 0 ? ema20 > ema50 && ema50 > ema200 : ema20 > ema50;
  const rsiBullish = rsi >= 45 && rsi <= 68;
  const rsiOverbought = rsi > 72;
  const rsiOversold = rsi < 30;
  const strongTrend = adx > 25;
  const macdBullish = macd > macdSignal;

  const agentVotes = {
    "Market Analyst": emaBullish ? { verdict: "bullish", detail: `EMA bullish (${ema20.toFixed(0)} > ${ema50.toFixed(0)})` } : { verdict: "bearish", detail: `EMA bearish (${ema20.toFixed(0)} < ${ema50.toFixed(0)})` },
    "Strategy Analyst": strongTrend && emaBullish ? { verdict: "pass", detail: `Trend strong (ADX ${adx?.toFixed(1)})` } : { verdict: "neutral", detail: `Weak trend — ADX ${adx?.toFixed(1)}` },
    "Risk Analyst": rsiOverbought ? { verdict: "rejected", detail: `RSI overbought ${rsi.toFixed(1)}` } : { verdict: "approved", detail: `RSI healthy ${rsi.toFixed(1)}` },
    "Research Agent": { verdict: historicalWinRate >= 60 ? "bullish" : historicalWinRate >= 45 ? "neutral" : "bearish", detail: `${closed.length} trades — ${historicalWinRate}% win rate, avg ${avgReturn.toFixed(1)}%` },
  };

  let score = 50;
  if (emaBullish) score += 10; if (rsiBullish) score += 8; if (strongTrend) score += 8;
  if (macdBullish) score += 6; if (historicalWinRate >= 65) score += 10; else if (historicalWinRate >= 50) score += 4;
  if (rsiOverbought) score -= 15; if (!strongTrend) score -= 5;
  const confidence = Math.min(95, Math.max(20, score));

  let decision = "HOLD";
  if (emaBullish && rsiBullish && strongTrend && !rsiOverbought) decision = "BUY";
  else if (!emaBullish && rsiOverbought) decision = "SELL";
  else if (rsiOversold && historicalWinRate >= 55) decision = "BUY";

  const evidence: string[] = [];
  if (emaBullish) evidence.push(`EMA alignment bullish — ${ema20.toFixed(0)} > ${ema50.toFixed(0)} > ${ema200.toFixed(0)}`);
  if (strongTrend) evidence.push(`Strong trend — ADX ${adx?.toFixed(1)} > 25`);
  if (rsiBullish) evidence.push(`RSI healthy at ${rsi.toFixed(1)}`);
  if (macdBullish) evidence.push(`MACD bullish crossover`);
  if (historicalWinRate > 0) evidence.push(`Historical ${historicalWinRate}% win rate (${closed.length} trades)`);
  if (rsiOverbought) evidence.push(`⚠️ RSI overbought (${rsi.toFixed(1)})`);

  const reasoning = { summary: `${decision} — ${symbol} ${timeframe} @ ${confidence}% confidence`, evidence, marketCondition: emaBullish ? "bullish" : "bearish_or_neutral" };

  const { data: saved } = await supabase.from("ai_decisions").insert({
    symbol, decision, confidence, reasoning, agent_votes: agentVotes,
  }).select().single();

  await supabase.from("ai_memory").insert({
    symbol, timeframe,
    market_condition: { trend: emaBullish ? "bullish" : "bearish", adx, ema_aligned: ema20 > ema50 },
    features: { rsi, ema20, ema50, ema200, macd, macd_signal: macdSignal },
  });

  res.json({ ...saved, agentVotes, reasoning });
});

router.get("/ai/decisions", async (_req, res): Promise<void> => {
  const { data } = await supabase.from("ai_decisions").select("*").order("created_at", { ascending: false }).limit(50);
  res.json(data ?? []);
});

router.get("/ai/feedback", async (_req, res): Promise<void> => {
  const { data } = await supabase.from("ai_feedback").select("*").order("created_at", { ascending: false }).limit(50);
  res.json(data ?? []);
});

router.post("/ai/feedback", async (req, res): Promise<void> => {
  const { decisionId, tradeId, prediction, actualResult, correct, lesson } = req.body;
  const { data } = await supabase.from("ai_feedback").insert({ decision_id: decisionId, trade_id: tradeId, prediction, actual_result: actualResult, correct, lesson }).select().single();
  res.json(data);
});

router.get("/strategies/:id/versions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { data } = await supabase.from("strategy_versions").select("*").eq("strategy_id", id).order("version", { ascending: false });
  res.json(data ?? []);
});

router.post("/strategies/:id/versions", async (req, res): Promise<void> => {
  const strategyId = parseInt(req.params.id);
  const { entryRules, exitRules, parameters, changeReason, performanceBefore } = req.body;
  const { data: existing } = await supabase.from("strategy_versions").select("version").eq("strategy_id", strategyId).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = existing ? existing.version + 1 : 1;
  const { data } = await supabase.from("strategy_versions").insert({ strategy_id: strategyId, version: nextVersion, entry_rules: entryRules, exit_rules: exitRules, parameters, change_reason: changeReason, performance_before: performanceBefore }).select().single();
  res.json(data);
});

router.get("/experiments", async (_req, res): Promise<void> => {
  const { data } = await supabase.from("experiments").select("*").order("created_at", { ascending: false });
  res.json(data ?? []);
});

router.post("/experiments", async (req, res): Promise<void> => {
  const { strategyId, hypothesis, changeMade, testPeriod, backtestResult, verdict, notes } = req.body;
  const { data } = await supabase.from("experiments").insert({ strategy_id: strategyId, hypothesis, change_made: changeMade, test_period: testPeriod, backtest_result: backtestResult, verdict: verdict ?? "pending", notes }).select().single();
  res.json(data);
});

router.put("/experiments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { verdict, backtestResult, notes } = req.body;
  const { data } = await supabase.from("experiments").update({ verdict, backtest_result: backtestResult, notes }).eq("id", id).select().single();
  res.json(data);
});

router.get("/paper-trades", async (_req, res): Promise<void> => {
  const { data } = await supabase.from("paper_trades").select("*").order("entry_time", { ascending: false });
  res.json(data ?? []);
});

router.post("/paper-trades", async (req, res): Promise<void> => {
  const { symbol, side, strategyId, entryPrice, quantity, stopLoss, takeProfit, status } = req.body;
  const { data } = await supabase.from("paper_trades").insert({ symbol, side, strategy_id: strategyId, entry_price: entryPrice, quantity, stop_loss: stopLoss, take_profit: takeProfit, status: status ?? "open" }).select().single();
  res.json(data);
});

router.put("/paper-trades/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { exitPrice, status } = req.body;
  const { data: existing } = await supabase.from("paper_trades").select("*").eq("id", id).single();
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const updates: Record<string, unknown> = { status };
  if (exitPrice) {
    const ep = parseFloat(String(exitPrice));
    const diff = existing.side === "long" ? ep - existing.entry_price : existing.entry_price - ep;
    updates.exit_price = ep;
    updates.profit_loss = Math.round(diff * existing.quantity * 100) / 100;
    updates.profit_percent = Math.round((diff / existing.entry_price) * 10000) / 100;
    if (status === "closed") updates.exit_time = new Date().toISOString();
  }
  const { data } = await supabase.from("paper_trades").update(updates).eq("id", id).select().single();
  res.json(data);
});

router.post("/risk/calculate", async (req, res): Promise<void> => {
  const { account, riskPercent, entry, stopLoss } = req.body;
  const riskAmount = account * (riskPercent / 100);
  const stopDistance = Math.abs(entry - stopLoss);
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const riskReward = stopDistance > 0 ? (entry * 0.05) / stopDistance : 0;
  res.json({ positionSize: Math.round(positionSize * 10000) / 10000, riskAmount: Math.round(riskAmount * 100) / 100, stopDistance: Math.round(stopDistance * 100) / 100, riskReward: Math.round(riskReward * 100) / 100 });
});

export default router;
