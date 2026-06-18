import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  aiMemoryTable,
  aiDecisionsTable,
  aiFeedbackTable,
  strategyVersionsTable,
  experimentsTable,
  paperTradesTable,
  indicatorsTable,
  tradesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ── AI ANALYZE ────────────────────────────────────────────────────────────────
router.post("/ai/analyze", async (req, res): Promise<void> => {
  const { symbol = "BTCUSDT", timeframe = "4h" } = req.body ?? {};

  // Fetch latest indicators from DB for context
  const [indicators] = await db
    .select()
    .from(indicatorsTable)
    .where(eq(indicatorsTable.symbol, symbol))
    .limit(1);

  // Fetch recent closed trades for historical context
  const recentTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.symbol, symbol))
    .orderBy(desc(tradesTable.entryTime))
    .limit(20);

  const closed = recentTrades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.profitLoss ?? 0) > 0);
  const historicalWinRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgReturn = closed.length > 0 ? closed.reduce((s, t) => s + (t.profitPercent ?? 0), 0) / closed.length : 0;

  // Build market condition snapshot
  const ema20 = indicators?.ema20 ?? 0;
  const ema50 = indicators?.ema50 ?? 0;
  const ema200 = indicators?.ema200 ?? 0;
  const rsi = indicators?.rsi ?? 50;
  const adx = indicators?.adx ?? 20;
  const macd = indicators?.macd ?? 0;
  const macdSignal = indicators?.macdSignal ?? 0;

  const emaAligned = ema20 > 0 && ema50 > 0 && ema20 > ema50;
  const emaBullish = ema200 > 0 ? ema20 > ema50 && ema50 > ema200 : ema20 > ema50;
  const rsiBullish = rsi >= 45 && rsi <= 68;
  const rsiOverbought = rsi > 72;
  const rsiOversold = rsi < 30;
  const strongTrend = adx > 25;
  const macdBullish = macd > macdSignal;

  // Agent analysis
  const marketAnalyst = emaBullish
    ? { verdict: "bullish", detail: `EMA alignment bullish (${ema20.toFixed(0)} > ${ema50.toFixed(0)})` }
    : ema20 < ema50
    ? { verdict: "bearish", detail: `EMA alignment bearish (${ema20.toFixed(0)} < ${ema50.toFixed(0)})` }
    : { verdict: "neutral", detail: "EMA alignment neutral — no clear trend" };

  const strategyAnalyst = strongTrend && (emaBullish || macdBullish)
    ? { verdict: "pass", detail: `Trend strength confirmed (ADX ${adx?.toFixed(1)})` }
    : !strongTrend
    ? { verdict: "neutral", detail: `Weak trend — ADX ${adx?.toFixed(1)} below 25` }
    : { verdict: "fail", detail: "Strategy conditions not met" };

  const riskAnalyst = rsiOverbought
    ? { verdict: "rejected", detail: `RSI overbought at ${rsi.toFixed(1)} — high reversal risk` }
    : rsiOversold
    ? { verdict: "neutral", detail: `RSI oversold at ${rsi.toFixed(1)} — potential bounce` }
    : { verdict: "approved", detail: `RSI healthy at ${rsi.toFixed(1)} — risk acceptable` };

  const researchAgent = closed.length > 0
    ? { verdict: historicalWinRate >= 60 ? "bullish" : historicalWinRate >= 45 ? "neutral" : "bearish", detail: `${closed.length} historical trades — ${historicalWinRate}% win rate, avg ${avgReturn.toFixed(1)}%` }
    : { verdict: "neutral", detail: "Insufficient historical data for this symbol" };

  // Calculate confidence
  let score = 50;
  if (emaBullish) score += 10;
  if (rsiBullish) score += 8;
  if (strongTrend) score += 8;
  if (macdBullish) score += 6;
  if (historicalWinRate >= 65) score += 10;
  else if (historicalWinRate >= 50) score += 4;
  if (rsiOverbought) score -= 15;
  if (!strongTrend) score -= 5;
  const confidence = Math.min(95, Math.max(20, score));

  // Determine decision
  let decision = "HOLD";
  if (emaBullish && rsiBullish && strongTrend && !rsiOverbought) decision = "BUY";
  else if (!emaBullish && rsiOverbought) decision = "SELL";
  else if (rsiOversold && historicalWinRate >= 55) decision = "BUY";

  // Build evidence list
  const evidence: string[] = [];
  if (emaBullish) evidence.push(`EMA alignment bullish — ${ema20.toFixed(0)} > ${ema50.toFixed(0)} > ${ema200.toFixed(0)}`);
  if (strongTrend) evidence.push(`Strong trend confirmed — ADX ${adx?.toFixed(1)} > 25`);
  if (rsiBullish) evidence.push(`RSI healthy at ${rsi.toFixed(1)} — momentum building without overextension`);
  if (macdBullish) evidence.push(`MACD bullish crossover — momentum confirming`);
  if (historicalWinRate > 0) evidence.push(`Historical win rate on ${symbol}: ${historicalWinRate}% (${closed.length} trades)`);
  if (rsiOverbought) evidence.push(`⚠️ RSI overbought (${rsi.toFixed(1)}) — increased reversal risk`);
  if (!strongTrend) evidence.push(`⚠️ Weak trend (ADX ${adx?.toFixed(1)}) — wait for directional confirmation`);

  const agentVotes = {
    "Market Analyst": marketAnalyst,
    "Strategy Analyst": strategyAnalyst,
    "Risk Analyst": riskAnalyst,
    "Research Agent": researchAgent,
    "Decision Agent": { verdict: decision === "BUY" ? "bullish" : decision === "SELL" ? "bearish" : "neutral", detail: `Final: ${decision} — ${confidence}% confidence` },
  };

  const reasoning = {
    summary: `${decision} signal for ${symbol} on ${timeframe} with ${confidence}% confidence`,
    evidence,
    marketCondition: emaBullish ? "bullish" : "bearish_or_neutral",
    rsiState: rsiOverbought ? "overbought" : rsiOversold ? "oversold" : "neutral",
  };

  // Store decision
  const [saved] = await db.insert(aiDecisionsTable).values({
    symbol,
    decision,
    confidence,
    reasoning,
    agentVotes,
  }).returning();

  // Store memory snapshot
  await db.insert(aiMemoryTable).values({
    symbol,
    timeframe,
    marketCondition: { trend: emaBullish ? "bullish" : "bearish", adx, emaAligned },
    features: { rsi, ema20, ema50, ema200, macd, macdSignal },
  });

  res.json({ ...saved, agentVotes, reasoning });
});

// ── AI DECISIONS ──────────────────────────────────────────────────────────────
router.get("/ai/decisions", async (_req, res): Promise<void> => {
  const decisions = await db
    .select()
    .from(aiDecisionsTable)
    .orderBy(desc(aiDecisionsTable.createdAt))
    .limit(50);
  res.json(decisions);
});

// ── AI FEEDBACK ───────────────────────────────────────────────────────────────
router.get("/ai/feedback", async (_req, res): Promise<void> => {
  const feedback = await db
    .select()
    .from(aiFeedbackTable)
    .orderBy(desc(aiFeedbackTable.createdAt))
    .limit(50);
  res.json(feedback);
});

router.post("/ai/feedback", async (req, res): Promise<void> => {
  const { decisionId, tradeId, prediction, actualResult, correct, lesson } = req.body;
  const [row] = await db.insert(aiFeedbackTable).values({ decisionId, tradeId, prediction, actualResult, correct, lesson }).returning();
  res.json(row);
});

// ── STRATEGY VERSIONS ─────────────────────────────────────────────────────────
router.get("/strategies/:id/versions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const versions = await db
    .select()
    .from(strategyVersionsTable)
    .where(eq(strategyVersionsTable.strategyId, id))
    .orderBy(desc(strategyVersionsTable.version));
  res.json(versions);
});

router.post("/strategies/:id/versions", async (req, res): Promise<void> => {
  const strategyId = parseInt(req.params.id);
  const { entryRules, exitRules, parameters, changeReason, performanceBefore } = req.body;

  // Auto-increment version
  const existing = await db.select().from(strategyVersionsTable).where(eq(strategyVersionsTable.strategyId, strategyId)).orderBy(desc(strategyVersionsTable.version)).limit(1);
  const nextVersion = existing.length > 0 ? (existing[0].version + 1) : 1;

  const [row] = await db.insert(strategyVersionsTable).values({ strategyId, version: nextVersion, entryRules, exitRules, parameters, changeReason, performanceBefore }).returning();
  res.json(row);
});

// ── EXPERIMENTS ───────────────────────────────────────────────────────────────
router.get("/experiments", async (_req, res): Promise<void> => {
  const rows = await db.select().from(experimentsTable).orderBy(desc(experimentsTable.createdAt));
  res.json(rows);
});

router.post("/experiments", async (req, res): Promise<void> => {
  const { strategyId, hypothesis, changeMade, testPeriod, backtestResult, verdict, notes } = req.body;
  const [row] = await db.insert(experimentsTable).values({ strategyId, hypothesis, changeMade, testPeriod, backtestResult, verdict: verdict ?? "pending", notes }).returning();
  res.json(row);
});

router.put("/experiments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { verdict, backtestResult, notes } = req.body;
  const [row] = await db.update(experimentsTable).set({ verdict, backtestResult, notes }).where(eq(experimentsTable.id, id)).returning();
  res.json(row);
});

// ── PAPER TRADES ──────────────────────────────────────────────────────────────
router.get("/paper-trades", async (_req, res): Promise<void> => {
  const rows = await db.select().from(paperTradesTable).orderBy(desc(paperTradesTable.entryTime));
  res.json(rows);
});

router.post("/paper-trades", async (req, res): Promise<void> => {
  const { symbol, side, strategyId, entryPrice, quantity, stopLoss, takeProfit, status } = req.body;
  const [row] = await db.insert(paperTradesTable).values({ symbol, side, strategyId, entryPrice, quantity, stopLoss, takeProfit, status: status ?? "open" }).returning();
  res.json(row);
});

router.put("/paper-trades/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { exitPrice, status } = req.body;

  const [existing] = await db.select().from(paperTradesTable).where(eq(paperTradesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let profitLoss: number | undefined;
  let profitPercent: number | undefined;
  const exitTime = status === "closed" ? new Date() : undefined;

  if (exitPrice && existing.entryPrice && existing.quantity) {
    const ep = parseFloat(String(exitPrice));
    const diff = existing.side === "long" ? ep - existing.entryPrice : existing.entryPrice - ep;
    profitLoss = Math.round(diff * existing.quantity * 100) / 100;
    profitPercent = Math.round((diff / existing.entryPrice) * 10000) / 100;
  }

  const [row] = await db.update(paperTradesTable)
    .set({ exitPrice: exitPrice ? parseFloat(String(exitPrice)) : undefined, status, profitLoss, profitPercent, exitTime })
    .where(eq(paperTradesTable.id, id))
    .returning();
  res.json(row);
});

// ── RISK CALCULATOR ───────────────────────────────────────────────────────────
router.post("/risk/calculate", async (req, res): Promise<void> => {
  const { account, riskPercent, entry, stopLoss } = req.body;
  const riskAmount = account * (riskPercent / 100);
  const stopDistance = Math.abs(entry - stopLoss);
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const riskReward = stopDistance > 0 ? (entry * 0.05) / stopDistance : 0; // default TP at ~5% move

  res.json({
    positionSize: Math.round(positionSize * 10000) / 10000,
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopDistance: Math.round(stopDistance * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
  });
});

export default router;
